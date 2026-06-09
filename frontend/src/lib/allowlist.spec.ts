import {
  fetchAllowlistApi,
  createAllowlistEntryApi,
  updateAllowlistEntryApi,
  removeAllowlistEntryApi,
} from "@/lib/allowlist"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

const mockEntry = {
  id: "e1",
  value: "alice@example.com",
  note: "Founder",
  createdAt: "2026-01-01T00:00:00.000Z",
}

describe("allowlist API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchAllowlistApi", () => {
    it("GETs /api/allowlist with page and limit", async () => {
      const data = {
        data: [mockEntry],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(data))

      const result = await fetchAllowlistApi(1, 10)

      expect(authFetch).toHaveBeenCalledWith("/api/allowlist?page=1&limit=10")
      expect(result).toEqual(data)
    })
  })

  describe("createAllowlistEntryApi", () => {
    it("POSTs /api/allowlist with the entry body", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(mockEntry))

      const result = await createAllowlistEntryApi({
        value: "alice@example.com",
        note: "Founder",
      })

      expect(authFetch).toHaveBeenCalledWith("/api/allowlist", {
        method: "POST",
        body: JSON.stringify({ value: "alice@example.com", note: "Founder" }),
      })
      expect(result).toEqual(mockEntry)
    })
  })

  describe("updateAllowlistEntryApi", () => {
    it("PATCHes /api/allowlist/:id with the updated fields", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(mockEntry))

      const result = await updateAllowlistEntryApi("e1", { note: "Updated" })

      expect(authFetch).toHaveBeenCalledWith("/api/allowlist/e1", {
        method: "PATCH",
        body: JSON.stringify({ note: "Updated" }),
      })
      expect(result).toEqual(mockEntry)
    })
  })

  describe("removeAllowlistEntryApi", () => {
    it("DELETEs /api/allowlist/:id", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(undefined))

      await removeAllowlistEntryApi("e1")

      expect(authFetch).toHaveBeenCalledWith("/api/allowlist/e1", {
        method: "DELETE",
      })
    })
  })
})
