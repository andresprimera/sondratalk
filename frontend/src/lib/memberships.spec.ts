import {
  fetchMyCirclesApi,
  updateMyCirclesApi,
} from "@/lib/memberships"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

const sampleCircle = {
  id: "c1",
  slug: "german-shepherd",
  themeId: "t1",
  labels: { en: "German Shepherd", es: "Pastor Alemán" },
  aliases: { en: ["GSD"], es: [] },
  popularity: 0,
}

describe("memberships API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchMyCirclesApi", () => {
    it("GETs /api/users/me/circles", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse([sampleCircle]),
      )

      const result = await fetchMyCirclesApi()

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/circles")
      expect(result).toEqual([sampleCircle])
    })
  })

  describe("updateMyCirclesApi", () => {
    it("PUTs /api/users/me/circles with circleIds body", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse([sampleCircle]),
      )

      const dto = { circleIds: ["c1", "c2"] }
      const result = await updateMyCirclesApi(dto)

      expect(authFetch).toHaveBeenCalledWith("/api/users/me/circles", {
        method: "PUT",
        body: JSON.stringify(dto),
      })
      expect(result).toEqual([sampleCircle])
    })
  })
})
