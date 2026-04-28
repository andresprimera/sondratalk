import { loginApi, signupApi, refreshApi, logoutApi, forgotPasswordApi, resetPasswordApi } from "@/lib/auth"
import { publicFetch, authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  publicFetch: vi.fn(),
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("loginApi", () => {
    it("should POST to /api/auth/login with credentials", async () => {
      vi.mocked(publicFetch).mockResolvedValue(
        mockJsonResponse({ accessToken: "t", refreshToken: "r", user: {} }),
      )

      const result = await loginApi("a@b.com", "pass")

      expect(publicFetch).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "pass" }),
      })
      expect(result).toEqual({ accessToken: "t", refreshToken: "r", user: {} })
    })
  })

  describe("signupApi", () => {
    it("should POST to /api/auth/signup with name, email, password", async () => {
      vi.mocked(publicFetch).mockResolvedValue(
        mockJsonResponse({ accessToken: "t", refreshToken: "r", user: {} }),
      )

      await signupApi("John", "j@b.com", "pass")

      expect(publicFetch).toHaveBeenCalledWith("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name: "John", email: "j@b.com", password: "pass" }),
      })
    })
  })

  describe("refreshApi", () => {
    it("should POST to /api/auth/refresh with Bearer token", async () => {
      vi.mocked(publicFetch).mockResolvedValue(
        mockJsonResponse({ accessToken: "new", refreshToken: "new", user: {} }),
      )

      await refreshApi("my-refresh-token")

      expect(publicFetch).toHaveBeenCalledWith("/api/auth/refresh", {
        method: "POST",
        headers: { Authorization: "Bearer my-refresh-token" },
      })
    })
  })

  describe("logoutApi", () => {
    it("should POST to /api/auth/logout via authFetch", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(undefined))

      await logoutApi()

      expect(authFetch).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
      })
    })
  })

  describe("forgotPasswordApi", () => {
    it("should POST to /api/auth/forgot-password with email", async () => {
      vi.mocked(publicFetch).mockResolvedValue(mockJsonResponse(undefined))

      await forgotPasswordApi("a@b.com")

      expect(publicFetch).toHaveBeenCalledWith("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com" }),
      })
    })
  })

  describe("resetPasswordApi", () => {
    it("should POST to /api/auth/reset-password with token, email, password", async () => {
      vi.mocked(publicFetch).mockResolvedValue(mockJsonResponse(undefined))

      await resetPasswordApi("tok", "a@b.com", "newpass")

      expect(publicFetch).toHaveBeenCalledWith("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: "tok", email: "a@b.com", password: "newpass" }),
      })
    })
  })
})
