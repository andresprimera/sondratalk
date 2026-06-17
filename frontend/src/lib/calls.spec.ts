import { declineCallApi, fetchCallTokenApi } from "@/lib/calls"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("calls API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchCallTokenApi", () => {
    it("POSTs the meeting id and returns the parsed token payload", async () => {
      const response = {
        token: "jwt.payload.signature",
        url: "wss://example.livekit.cloud",
        roomName: "mtg:m1",
        identity: "abc",
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(response))

      const result = await fetchCallTokenApi({ meetingId: "m1" })

      expect(authFetch).toHaveBeenCalledWith("/api/calls/token", {
        method: "POST",
        body: JSON.stringify({ meetingId: "m1" }),
      })
      expect(result).toEqual(response)
    })
  })

  describe("declineCallApi", () => {
    it("POSTs to the decline endpoint for the given meeting", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(undefined))

      await declineCallApi("m1")

      expect(authFetch).toHaveBeenCalledWith("/api/calls/m1/decline", {
        method: "POST",
      })
    })
  })
})
