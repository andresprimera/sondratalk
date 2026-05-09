import {
  fetchMyAvailabilityApi,
  updateMyAvailabilityApi,
  type Availability,
} from "@/lib/availability"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("availability API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchMyAvailabilityApi", () => {
    it("should GET /api/users/me/availability", async () => {
      const data: Availability = { windows: [], isAvailableNow: false }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(data))

      const result = await fetchMyAvailabilityApi()

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/availability")
      expect(result).toEqual(data)
    })
  })

  describe("updateMyAvailabilityApi", () => {
    it("should PATCH /api/users/me/availability with the input body", async () => {
      const updated: Availability = {
        windows: [{ period: "morning", day: "mon" }],
        isAvailableNow: true,
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(updated))

      const input = { isAvailableNow: true }
      const result = await updateMyAvailabilityApi(input)

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/availability", {
        method: "PATCH",
        body: JSON.stringify(input),
      })
      expect(result).toEqual(updated)
    })

    it("should serialize windows arrays in the body", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({ windows: [], isAvailableNow: false }),
      )

      const input = {
        windows: [
          { period: "morning" as const, day: "mon" as const },
          { period: "evening" as const, day: "sat" as const },
        ],
      }
      await updateMyAvailabilityApi(input)

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/availability", {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    })
  })
})
