import { fetchCallTokenApi } from "@/lib/calls"
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
    it("POSTs the peer user id and returns the parsed token payload", async () => {
      const response = {
        token: "jwt.payload.signature",
        url: "wss://example.livekit.cloud",
        roomName: "abc--xyz",
        identity: "abc",
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(response))

      const result = await fetchCallTokenApi({ peerUserId: "xyz" })

      expect(authFetch).toHaveBeenCalledWith("/api/calls/token", {
        method: "POST",
        body: JSON.stringify({ peerUserId: "xyz" }),
      })
      expect(result).toEqual(response)
    })
  })
})
