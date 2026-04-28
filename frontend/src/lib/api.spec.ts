function mockResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {},
): Response {
  const { status = 200, statusText = "" } = init
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response
}

describe("api", () => {
  let api: typeof import("@/lib/api")

  beforeEach(async () => {
    localStorage.clear()
    vi.stubGlobal("fetch", vi.fn())
    vi.resetModules()
    api = await import("@/lib/api")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getStoredTokens", () => {
    it("should return null tokens when storage is empty", () => {
      const tokens = api.getStoredTokens()
      expect(tokens.accessToken).toBeNull()
      expect(tokens.refreshToken).toBeNull()
    })

    it("should return stored tokens", () => {
      localStorage.setItem("accessToken", "abc")
      localStorage.setItem("refreshToken", "xyz")
      const tokens = api.getStoredTokens()
      expect(tokens.accessToken).toBe("abc")
      expect(tokens.refreshToken).toBe("xyz")
    })
  })

  describe("storeTokens", () => {
    it("should save both tokens to localStorage", () => {
      api.storeTokens("access-1", "refresh-1")
      expect(localStorage.getItem("accessToken")).toBe("access-1")
      expect(localStorage.getItem("refreshToken")).toBe("refresh-1")
    })
  })

  describe("clearTokens", () => {
    it("should remove both tokens from localStorage", () => {
      api.storeTokens("a", "b")
      api.clearTokens()
      expect(localStorage.getItem("accessToken")).toBeNull()
      expect(localStorage.getItem("refreshToken")).toBeNull()
    })
  })

  describe("publicFetch", () => {
    it("should add Content-Type header and return response on success", async () => {
      const body = { id: 1 }
      vi.mocked(fetch).mockResolvedValue(mockResponse(body))

      const res = await api.publicFetch("/api/test")
      const data = await res.json()

      expect(fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      )
      expect(data).toEqual(body)
    })

    it("should throw ApiError on non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse(
          { statusCode: 404, message: "Not found" },
          { status: 404 },
        ),
      )

      const err: any = await api.publicFetch("/api/test").catch((e: unknown) => e)
      expect(err.name).toBe("ApiError")
      expect(err.statusCode).toBe(404)
      expect(err.message).toBe("Not found")
    })

    it("should preserve validation errors from response body", async () => {
      const errors = [{ field: "email", message: "Invalid" }]
      vi.mocked(fetch).mockResolvedValue(
        mockResponse(
          { statusCode: 400, message: "Validation failed", errors },
          { status: 400 },
        ),
      )

      const err: any = await api.publicFetch("/api/test").catch((e: unknown) => e)
      expect(err.name).toBe("ApiError")
      expect(err.statusCode).toBe(400)
      expect(err.errors).toEqual(errors)
    })

    it("should merge custom headers with Content-Type", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}))

      await api.publicFetch("/api/test", {
        headers: { "X-Custom": "value" },
      })

      expect(fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Custom": "value",
          }),
        }),
      )
    })
  })

  describe("authFetch", () => {
    it("should attach Bearer token from localStorage", async () => {
      api.storeTokens("my-token", "my-refresh")
      vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true }))

      await api.authFetch("/api/secure")

      expect(fetch).toHaveBeenCalledWith(
        "/api/secure",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-token",
          }),
        }),
      )
    })

    it("should omit Authorization header when no token stored", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}))

      await api.authFetch("/api/secure")

      const callHeaders = vi.mocked(fetch).mock.calls[0][1]?.headers as
        | Record<string, string>
        | undefined
      expect(callHeaders?.["Authorization"]).toBeUndefined()
    })

    it("should refresh token and retry on 401", async () => {
      api.storeTokens("expired-token", "valid-refresh")

      const fetchMock = vi.mocked(fetch)
      // First call: 401
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))
      // Refresh call: success
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          accessToken: "new-access",
          refreshToken: "new-refresh",
          user: { id: "1", email: "a@b.com", name: "Test", role: "user" },
        }),
      )
      // Retry call: success
      fetchMock.mockResolvedValueOnce(mockResponse({ data: "secret" }))

      const res = await api.authFetch("/api/secure")
      const data = await res.json()

      expect(data).toEqual({ data: "secret" })
      expect(localStorage.getItem("accessToken")).toBe("new-access")
      expect(localStorage.getItem("refreshToken")).toBe("new-refresh")
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("should clear tokens and redirect on refresh failure", async () => {
      api.storeTokens("expired", "bad-refresh")

      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))

      // Mock window.location.href setter
      const locationMock = { ...window.location, href: "" }
      vi.stubGlobal("location", locationMock)

      await expect(api.authFetch("/api/secure")).rejects.toThrow(
        "Session expired",
      )
      expect(localStorage.getItem("accessToken")).toBeNull()
      expect(locationMock.href).toBe("/login")
    })

    it("should throw ApiError on non-401 error", async () => {
      api.storeTokens("valid-token", "valid-refresh")

      vi.mocked(fetch).mockResolvedValue(
        mockResponse(
          { statusCode: 403, message: "Forbidden" },
          { status: 403 },
        ),
      )

      const err: any = await api.authFetch("/api/secure").catch((e: unknown) => e)
      expect(err.name).toBe("ApiError")
      expect(err.statusCode).toBe(403)
    })

    it("should deduplicate concurrent refresh calls", async () => {
      api.storeTokens("expired", "valid-refresh")

      const fetchMock = vi.mocked(fetch)
      // Both initial requests return 401
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))
      // Single refresh call
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          accessToken: "new",
          refreshToken: "new",
          user: { id: "1", email: "a@b.com", name: "Test", role: "user" },
        }),
      )
      // Both retries succeed
      fetchMock.mockResolvedValueOnce(mockResponse({ a: 1 }))
      fetchMock.mockResolvedValueOnce(mockResponse({ b: 2 }))

      await Promise.all([
        api.authFetch("/api/a"),
        api.authFetch("/api/b"),
      ])

      const refreshCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/api/auth/refresh",
      )
      expect(refreshCalls).toHaveLength(1)
    })
  })
})
