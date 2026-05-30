import { submitConversationFeedbackApi } from "@/lib/feedback"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("feedback API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("submitConversationFeedbackApi", () => {
    it("should POST /api/feedback with the feedback body", async () => {
      const input = {
        meetingId: "m1",
        talkAgain: "yes" as const,
        doorOpen: true,
        matchRating: 5,
      }
      const saved = { id: "fb1", ...input }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(saved))

      const result = await submitConversationFeedbackApi(input)

      expect(authFetch).toHaveBeenCalledWith("/api/feedback", {
        method: "POST",
        body: JSON.stringify(input),
      })
      expect(result).toEqual(saved)
    })
  })
})
