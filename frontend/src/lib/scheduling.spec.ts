import {
  fetchSchedulingThreadApi,
  proposeTimeApi,
  respondToProposalApi,
} from "@/lib/scheduling"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

const thread = {
  messages: [],
  scheduledAt: "2026-06-02T09:30:00.000Z",
  peer: { id: "u2", firstName: "Marta" },
}

describe("scheduling API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchSchedulingThreadApi", () => {
    it("GETs the scheduling thread for a meeting", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(thread))

      const result = await fetchSchedulingThreadApi("m1")

      expect(authFetch).toHaveBeenCalledWith("/api/meetings/m1/scheduling")
      expect(result).toEqual(thread)
    })
  })

  describe("proposeTimeApi", () => {
    it("POSTs a proposed time to the proposals endpoint", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(thread))

      const result = await proposeTimeApi("m1", {
        proposedAt: "2026-06-02T09:30:00.000Z",
      })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/meetings/m1/scheduling/proposals",
        {
          method: "POST",
          body: JSON.stringify({ proposedAt: "2026-06-02T09:30:00.000Z" }),
        },
      )
      expect(result).toEqual(thread)
    })
  })

  describe("respondToProposalApi", () => {
    it("POSTs a yes/no response to the responses endpoint", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(thread))

      const result = await respondToProposalApi("m1", {
        replyToId: "p1",
        accept: true,
      })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/meetings/m1/scheduling/responses",
        {
          method: "POST",
          body: JSON.stringify({ replyToId: "p1", accept: true }),
        },
      )
      expect(result).toEqual(thread)
    })
  })
})
