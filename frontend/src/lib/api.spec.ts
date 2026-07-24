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
    vi.unstubAllGlobals()
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

      const err = (await api
        .publicFetch("/api/test")
        .catch((e: unknown) => e)) as { name: string; statusCode: number; message: string }
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

      const err = (await api
        .publicFetch("/api/test")
        .catch((e: unknown) => e)) as { name: string; statusCode: number; errors: unknown[] }
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

    it("should NOT log out on a transient refresh failure during 401 recovery", async () => {
      api.storeTokens("expired", "valid-refresh")

      const fetchMock = vi.mocked(fetch)
      // Original request 401s (expired access token).
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))
      // The refresh itself hits a transient 503.
      fetchMock.mockResolvedValueOnce(
        mockResponse(
          { statusCode: 503, message: "Service unavailable" },
          { status: 503 },
        ),
      )

      const locationMock = { ...window.location, href: "" }
      vi.stubGlobal("location", locationMock)

      const err = (await api
        .authFetch("/api/secure")
        .catch((e: unknown) => e)) as { statusCode?: number }

      // Session preserved: tokens intact, no redirect, real error surfaced.
      expect(localStorage.getItem("refreshToken")).toBe("valid-refresh")
      expect(locationMock.href).toBe("")
      expect(err.statusCode).toBe(503)
    })

    it("should surface a retried-request 401 as an error without logging out", async () => {
      api.storeTokens("expired", "valid-refresh")

      const fetchMock = vi.mocked(fetch)
      // Original request 401s.
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))
      // Refresh succeeds.
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          accessToken: "fresh",
          refreshToken: "fresh-r",
          user: { id: "1", email: "a@b.com", name: "Test", role: "user" },
        }),
      )
      // The retried request 401s (e.g. a wrong current password) — a business
      // error, not a dead session, so it must surface without a forced logout.
      fetchMock.mockResolvedValueOnce(
        mockResponse({ statusCode: 401, message: "Wrong password" }, { status: 401 }),
      )

      const locationMock = { ...window.location, href: "" }
      vi.stubGlobal("location", locationMock)

      const err = (await api
        .authFetch("/api/secure")
        .catch((e: unknown) => e)) as { statusCode?: number }

      expect(err.statusCode).toBe(401)
      expect(localStorage.getItem("accessToken")).toBe("fresh")
      expect(locationMock.href).toBe("")
    })

    it("should surface a business 403 from the retried request without logging out", async () => {
      api.storeTokens("expired", "valid-refresh")

      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce(mockResponse({}, { status: 401 }))
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          accessToken: "fresh",
          refreshToken: "fresh-r",
          user: { id: "1", email: "a@b.com", name: "Test", role: "user" },
        }),
      )
      // The retried request is rejected for a business reason (wrong password).
      fetchMock.mockResolvedValueOnce(
        mockResponse(
          { statusCode: 403, message: "Incorrect password" },
          { status: 403 },
        ),
      )

      const locationMock = { ...window.location, href: "" }
      vi.stubGlobal("location", locationMock)

      const err = (await api
        .authFetch("/api/secure")
        .catch((e: unknown) => e)) as { statusCode?: number }

      // Not a session failure: session preserved, no redirect, 403 surfaced.
      expect(err.statusCode).toBe(403)
      expect(localStorage.getItem("accessToken")).toBe("fresh")
      expect(locationMock.href).toBe("")
    })

    it("should throw ApiError on non-401 error", async () => {
      api.storeTokens("valid-token", "valid-refresh")

      vi.mocked(fetch).mockResolvedValue(
        mockResponse(
          { statusCode: 403, message: "Forbidden" },
          { status: 403 },
        ),
      )

      const err = (await api
        .authFetch("/api/secure")
        .catch((e: unknown) => e)) as { name: string; statusCode: number }
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

  describe("refreshTokens", () => {
    const refreshBody = {
      accessToken: "new-access",
      refreshToken: "new-refresh",
      user: { id: "1", email: "a@b.com", name: "Test", role: "user" },
    }

    it("serializes through the Web Locks API when available", async () => {
      localStorage.setItem("refreshToken", "r1")
      const request = vi.fn(
        (_name: string, cb: (lock: unknown) => Promise<unknown>) => cb(null),
      )
      vi.stubGlobal("navigator", { locks: { request } })
      vi.mocked(fetch).mockResolvedValue(mockResponse(refreshBody))

      const data = await api.refreshTokens()

      expect(request).toHaveBeenCalledWith(
        "token-refresh",
        expect.any(Function),
      )
      expect(data.accessToken).toBe("new-access")
      expect(localStorage.getItem("refreshToken")).toBe("new-refresh")
    })

    it("reads the refresh token inside the lock so a rotation elsewhere is honored", async () => {
      localStorage.setItem("refreshToken", "stale")
      // Simulate another tab rotating the token while we waited for the lock:
      // by the time our critical section runs, storage holds the fresh value.
      const request = vi.fn(
        (_name: string, cb: (lock: unknown) => Promise<unknown>) => {
          localStorage.setItem("refreshToken", "rotated-by-other-tab")
          return cb(null)
        },
      )
      vi.stubGlobal("navigator", { locks: { request } })
      vi.mocked(fetch).mockResolvedValue(mockResponse(refreshBody))

      await api.refreshTokens()

      const [, init] = vi.mocked(fetch).mock.calls[0]
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBe("Bearer rotated-by-other-tab")
    })

    it("falls back to a direct call when the Web Locks API is absent", async () => {
      vi.stubGlobal("navigator", {})
      localStorage.setItem("refreshToken", "r1")
      vi.mocked(fetch).mockResolvedValue(mockResponse(refreshBody))

      const data = await api.refreshTokens()

      expect(data.refreshToken).toBe("new-refresh")
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/refresh",
        expect.objectContaining({ method: "POST" }),
      )
    })

    it("clears tokens on a definitive 401 auth failure", async () => {
      localStorage.setItem("accessToken", "a1")
      localStorage.setItem("refreshToken", "r1")
      vi.mocked(fetch).mockResolvedValue(
        mockResponse(
          { statusCode: 401, message: "Access denied" },
          { status: 401 },
        ),
      )

      const err = (await api.refreshTokens().catch((e: unknown) => e)) as {
        name: string
        statusCode: number
      }
      expect(err.name).toBe("ApiError")
      expect(err.statusCode).toBe(401)
      expect(localStorage.getItem("refreshToken")).toBeNull()
    })

    it("preserves tokens on a transient 5xx so a later retry can recover", async () => {
      localStorage.setItem("accessToken", "a1")
      localStorage.setItem("refreshToken", "r1")
      vi.mocked(fetch).mockResolvedValue(
        mockResponse(
          { statusCode: 503, message: "Service unavailable" },
          { status: 503 },
        ),
      )

      await expect(api.refreshTokens()).rejects.toBeTruthy()
      expect(localStorage.getItem("refreshToken")).toBe("r1")
    })

    it("does not write the new tokens back if the session ends mid-refresh", async () => {
      localStorage.setItem("refreshToken", "r1")
      let resolveFetch: (res: Response) => void = () => {}
      vi.mocked(fetch).mockReturnValue(
        new Promise<Response>((r) => {
          resolveFetch = r
        }),
      )

      const pending = api.refreshTokens()
      // A logout ends the session generation while the request is in flight.
      api.endSession()
      resolveFetch(mockResponse(refreshBody))

      await expect(pending).rejects.toBeTruthy()
      // The rotated tokens must NOT be persisted...
      expect(localStorage.getItem("accessToken")).toBeNull()
      // ...but the guard must NOT delete storage either — it may already belong
      // to a newer session (here the pre-existing value is left untouched).
      expect(localStorage.getItem("refreshToken")).toBe("r1")
    })
  })
})
