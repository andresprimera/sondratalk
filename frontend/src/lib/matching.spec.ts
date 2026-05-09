import { findHeardMatchApi, findTalkMatchApi } from "@/lib/matching"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

const sampleCircle = {
  id: "c1",
  slug: "catalan",
  themeId: "t1",
  labels: { en: "Catalan", es: "Catalán" },
  aliases: { en: [], es: [] },
  popularity: 0,
}

describe("matching API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("findTalkMatchApi", () => {
    it("POSTs the circle id filter and returns the parsed match", async () => {
      const match = {
        id: "u1",
        firstName: "Ana",
        sharedCircles: [sampleCircle],
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(match))

      const result = await findTalkMatchApi({ circleIds: ["c1", "c2"] })

      expect(authFetch).toHaveBeenCalledWith("/api/matching/talk", {
        method: "POST",
        body: JSON.stringify({ circleIds: ["c1", "c2"] }),
      })
      expect(result).toEqual(match)
    })
  })

  describe("findHeardMatchApi", () => {
    it("POSTs to /api/matching/heard and returns the parsed match including hostExp", async () => {
      const match = {
        id: "u2",
        firstName: "Marta",
        hostExp: 12,
        sharedCircles: [sampleCircle],
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(match))

      const result = await findHeardMatchApi({ circleIds: ["c1"] })

      expect(authFetch).toHaveBeenCalledWith("/api/matching/heard", {
        method: "POST",
        body: JSON.stringify({ circleIds: ["c1"] }),
      })
      expect(result).toEqual(match)
    })
  })
})
