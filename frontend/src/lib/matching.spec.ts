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

const sampleSlot = {
  startsAt: "2026-05-12T07:00:00.000Z",
  requesterDate: "2026-05-12",
  requesterTime: "03:00",
}

describe("matching API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("findTalkMatchApi", () => {
    it("POSTs the circle id filter and returns the parsed candidates", async () => {
      const response = {
        candidates: [
          {
            id: "u1",
            firstName: "Ana",
            sharedCircles: [sampleCircle],
            availableNow: true,
            slots: [],
          },
          {
            id: "u2",
            firstName: "Bea",
            sharedCircles: [sampleCircle],
            availableNow: false,
            slots: [sampleSlot],
          },
        ],
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(response))

      const result = await findTalkMatchApi({ circleIds: ["c1", "c2"] })

      expect(authFetch).toHaveBeenCalledWith("/api/matching/talk", {
        method: "POST",
        body: JSON.stringify({ circleIds: ["c1", "c2"] }),
      })
      expect(result).toEqual(response)
    })
  })

  describe("findHeardMatchApi", () => {
    it("POSTs to /api/matching/heard and returns parsed candidates with hostExp", async () => {
      const response = {
        candidates: [
          {
            id: "u3",
            firstName: "Marta",
            hostExp: 12,
            sharedCircles: [sampleCircle],
            availableNow: true,
            slots: [],
          },
        ],
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(response))

      const result = await findHeardMatchApi({ circleIds: ["c1"] })

      expect(authFetch).toHaveBeenCalledWith("/api/matching/heard", {
        method: "POST",
        body: JSON.stringify({ circleIds: ["c1"] }),
      })
      expect(result).toEqual(response)
    })
  })
})
