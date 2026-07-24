import { fetchAvailableNowUsersApi } from "@/lib/available-now"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("available-now API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchAvailableNowUsersApi", () => {
    it("GETs /api/users/available-now with page and limit query params", async () => {
      const responseData = {
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(responseData))

      const result = await fetchAvailableNowUsersApi(2, 10)

      expect(authFetch).toHaveBeenCalledWith(
        "/api/users/available-now?page=2&limit=10",
      )
      expect(result).toEqual(responseData)
    })
  })
})
