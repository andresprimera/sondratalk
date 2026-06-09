import {
  updateProfileApi,
  changePasswordApi,
  updateTimezoneApi,
  updateMyLanguagesApi,
  updateMyApplicationApi,
} from "@/lib/profile"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("updateProfileApi", () => {
    it("should PATCH /api/users/me with name and email", async () => {
      const user = { id: "u1", name: "New Name", email: "new@test.com", role: "user" }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(user))

      const result = await updateProfileApi("New Name", "new@test.com")

      expect(authFetch).toHaveBeenCalledWith("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name", email: "new@test.com" }),
      })
      expect(result).toEqual(user)
    })
  })

  describe("changePasswordApi", () => {
    it("should PATCH /api/users/me/password with current and new password", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(undefined))

      await changePasswordApi("oldpass", "newpass")

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: "oldpass", newPassword: "newpass" }),
      })
    })
  })

  describe("updateTimezoneApi", () => {
    it("should PATCH /api/users/me/timezone with the timezone string", async () => {
      const user = {
        id: "u1",
        name: "Test",
        email: "t@test.com",
        role: "user",
        timezone: "Europe/Madrid",
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(user))

      const result = await updateTimezoneApi("Europe/Madrid")

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/timezone", {
        method: "PATCH",
        body: JSON.stringify({ timezone: "Europe/Madrid" }),
      })
      expect(result).toEqual(user)
    })
  })

  describe("updateMyLanguagesApi", () => {
    it("PATCHes /api/users/me/languages with the languages array and locale", async () => {
      const languages = [
        { code: "es", fluency: "Native" as const },
        { code: "en", fluency: "Fluent" as const },
      ]
      const user = {
        id: "u1",
        name: "Test",
        email: "t@test.com",
        role: "user",
        timezone: "UTC",
        languages,
        locale: "es",
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(user))

      const result = await updateMyLanguagesApi({ languages, locale: "es" })

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/languages", {
        method: "PATCH",
        body: JSON.stringify({ languages, locale: "es" }),
      })
      expect(result).toEqual(user)
    })
  })

  describe("updateMyApplicationApi", () => {
    it("PATCHes /api/users/me/application with the applicationText", async () => {
      const user = {
        id: "u1",
        name: "Test",
        email: "t@test.com",
        role: "user",
        timezone: "UTC",
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(user))

      const result = await updateMyApplicationApi({ applicationText: "I want to connect" })

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/application", {
        method: "PATCH",
        body: JSON.stringify({ applicationText: "I want to connect" }),
      })
      expect(result).toEqual(user)
    })
  })
})
