import { fetchUsersApi, updateUserRoleApi, removeUserApi, createUserApi } from "@/lib/users"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("users API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchUsersApi", () => {
    it("should GET /api/users with page and limit query params", async () => {
      const responseData = { data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(responseData))

      const result = await fetchUsersApi(2, 10)

      expect(authFetch).toHaveBeenCalledWith("/api/users?page=2&limit=10")
      expect(result).toEqual(responseData)
    })
  })

  describe("updateUserRoleApi", () => {
    it("should PATCH /api/users/:id/role with role body", async () => {
      const user = { id: "u1", name: "Test", email: "t@t.com", role: "admin" }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(user))

      const result = await updateUserRoleApi("u1", "admin")

      expect(authFetch).toHaveBeenCalledWith("/api/users/u1/role", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      })
      expect(result).toEqual(user)
    })
  })

  describe("removeUserApi", () => {
    it("should DELETE /api/users/:id", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(undefined))

      await removeUserApi("u1")

      expect(authFetch).toHaveBeenCalledWith("/api/users/u1", {
        method: "DELETE",
      })
    })
  })

  describe("createUserApi", () => {
    it("should POST /api/users with user data", async () => {
      const user = { id: "u2", name: "New User", email: "new@test.com", role: "user" }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(user))

      const data = { name: "New User", email: "new@test.com", password: "password123", role: "user" as const }
      const result = await createUserApi(data)

      expect(authFetch).toHaveBeenCalledWith("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
      })
      expect(result).toEqual(user)
    })
  })
})
