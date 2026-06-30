import {
  fetchCirclesApi,
  fetchAdminCirclesApi,
  fetchAllCirclesApi,
  fetchCircleByIdApi,
  createCircleApi,
  updateCircleApi,
  removeCircleApi,
  verifyCirclePasswordApi,
} from "@/lib/circles"
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
  type: "what-you-love",
  labels: { en: "German Shepherd", es: "Pastor Alemán" },
  aliases: { en: ["GSD"], es: [] },
  popularity: 0,
  isPrivate: false,
}

describe("circles API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchCirclesApi", () => {
    it("includes only page and limit when no filters", async () => {
      const data = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(data))

      await fetchCirclesApi({ page: 1, limit: 10 })

      expect(authFetch).toHaveBeenCalledWith("/api/circles?page=1&limit=10")
    })

    it("includes q when provided", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({
          data: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      )

      await fetchCirclesApi({ q: "pastor", page: 1, limit: 10 })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles?q=pastor&page=1&limit=10",
      )
    })

    it("includes themeId when provided", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({
          data: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      )

      await fetchCirclesApi({ themeId: "t1", page: 1, limit: 10 })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles?themeId=t1&page=1&limit=10",
      )
    })

    it("includes both q and themeId when provided", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({
          data: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      )

      await fetchCirclesApi({ q: "gsd", themeId: "t1", page: 2, limit: 20 })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles?q=gsd&themeId=t1&page=2&limit=20",
      )
    })

    it("includes locale when provided", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({
          data: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      )

      await fetchCirclesApi({ locale: "es", page: 1, limit: 10 })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles?locale=es&page=1&limit=10",
      )
    })

    it("includes q, themeId, and locale together when all provided", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({
          data: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      )

      await fetchCirclesApi({
        q: "ger",
        themeId: "t1",
        locale: "en",
        page: 1,
        limit: 10,
      })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles?q=ger&themeId=t1&locale=en&page=1&limit=10",
      )
    })
  })

  describe("fetchAllCirclesApi", () => {
    it("GETs /api/circles/all and returns the list", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse([sampleCircle]))

      const result = await fetchAllCirclesApi()

      expect(authFetch).toHaveBeenCalledWith("/api/circles/all")
      expect(result).toEqual([sampleCircle])
    })
  })

  describe("fetchCircleByIdApi", () => {
    it("GETs /api/circles/:id", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(sampleCircle))

      const result = await fetchCircleByIdApi("c1")

      expect(authFetch).toHaveBeenCalledWith("/api/circles/c1")
      expect(result).toEqual(sampleCircle)
    })
  })

  describe("createCircleApi", () => {
    it("POSTs /api/circles with the body", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(sampleCircle))

      const dto = {
        slug: "german-shepherd",
        themeId: "t1",
        type: "what-you-love" as const,
        labels: { en: "German Shepherd", es: "Pastor Alemán" },
        aliases: { en: ["GSD"], es: [] },
      }
      const result = await createCircleApi(dto)

      expect(authFetch).toHaveBeenCalledWith("/api/circles", {
        method: "POST",
        body: JSON.stringify(dto),
      })
      expect(result).toEqual(sampleCircle)
    })
  })

  describe("fetchAdminCirclesApi", () => {
    it("includes only page and limit when no filters", async () => {
      const data = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(data))

      await fetchAdminCirclesApi({ page: 1, limit: 10 })

      expect(authFetch).toHaveBeenCalledWith("/api/circles/admin?page=1&limit=10")
    })

    it("includes sortBy and sortDir when provided", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({ data: [], meta: {} }),
      )

      await fetchAdminCirclesApi({
        sortBy: "popularity",
        sortDir: "desc",
        page: 1,
        limit: 10,
      })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles/admin?sortBy=popularity&sortDir=desc&page=1&limit=10",
      )
    })

    it("includes q and themeId when provided", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({ data: [], meta: {} }),
      )

      await fetchAdminCirclesApi({ q: "ger", themeId: "t1", page: 1, limit: 10 })

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles/admin?q=ger&themeId=t1&page=1&limit=10",
      )
    })
  })


  describe("updateCircleApi", () => {
    it("PATCHes /api/circles/:id with the body", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(sampleCircle))

      const dto = { labels: { en: "New Label", es: "Nuevo Label" } }
      const result = await updateCircleApi("c1", dto)

      expect(authFetch).toHaveBeenCalledWith("/api/circles/c1", {
        method: "PATCH",
        body: JSON.stringify(dto),
      })
      expect(result).toEqual(sampleCircle)
    })
  })

  describe("removeCircleApi", () => {
    it("DELETEs /api/circles/:id", async () => {
      vi.mocked(authFetch).mockResolvedValue({} as Response)

      await removeCircleApi("c1")

      expect(authFetch).toHaveBeenCalledWith("/api/circles/c1", {
        method: "DELETE",
      })
    })
  })

  describe("verifyCirclePasswordApi", () => {
    it("POSTs /api/circles/:id/verify-password with the password", async () => {
      vi.mocked(authFetch).mockResolvedValue({} as Response)

      await verifyCirclePasswordApi("c1", "secret123")

      expect(authFetch).toHaveBeenCalledWith(
        "/api/circles/c1/verify-password",
        {
          method: "POST",
          body: JSON.stringify({ password: "secret123" }),
        },
      )
    })
  })
})
