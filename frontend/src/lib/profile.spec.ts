import { updateProfileApi, changePasswordApi } from "@/lib/profile"
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
})
