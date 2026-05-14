import {
  cancelMeetingApi,
  createMeetingApi,
  fetchMeetingByIdApi,
  fetchUpcomingMeetingsApi,
} from "@/lib/meetings"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

const sampleMeeting = {
  id: "m1",
  participants: ["u1", "u2"],
  initiatorId: "u1",
  scheduledAt: "2026-05-13T10:00:00.000Z",
  expiresAt: "2026-05-13T11:00:00.000Z",
  cancelled: false,
  instant: false,
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
}

const sampleMeetingWithPeer = {
  ...sampleMeeting,
  peer: { id: "u2", firstName: "Beatriz" },
}

describe("meetings API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createMeetingApi", () => {
    it("POSTs the input and returns the created meeting", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(sampleMeeting))

      const result = await createMeetingApi({
        peerUserId: "u2",
        instant: true,
      })

      expect(authFetch).toHaveBeenCalledWith("/api/meetings", {
        method: "POST",
        body: JSON.stringify({ peerUserId: "u2", instant: true }),
      })
      expect(result).toEqual(sampleMeeting)
    })
  })

  describe("fetchUpcomingMeetingsApi", () => {
    it("GETs /api/meetings/upcoming and returns the parsed response", async () => {
      const response = { meetings: [sampleMeetingWithPeer] }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(response))

      const result = await fetchUpcomingMeetingsApi()

      expect(authFetch).toHaveBeenCalledWith("/api/meetings/upcoming")
      expect(result).toEqual(response)
    })
  })

  describe("fetchMeetingByIdApi", () => {
    it("GETs /api/meetings/:id and returns the meeting with peer", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse(sampleMeetingWithPeer),
      )

      const result = await fetchMeetingByIdApi("m1")

      expect(authFetch).toHaveBeenCalledWith("/api/meetings/m1")
      expect(result).toEqual(sampleMeetingWithPeer)
    })
  })

  describe("cancelMeetingApi", () => {
    it("POSTs /api/meetings/:id/cancel without parsing JSON", async () => {
      const response = mockJsonResponse(undefined)
      const jsonSpy = vi.spyOn(response, "json")
      vi.mocked(authFetch).mockResolvedValue(response)

      const result = await cancelMeetingApi("m1")

      expect(authFetch).toHaveBeenCalledWith("/api/meetings/m1/cancel", {
        method: "POST",
      })
      expect(jsonSpy).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })
  })
})
