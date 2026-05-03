import {
  fetchThemesApi,
  fetchAllThemesApi,
  fetchThemeByIdApi,
  createThemeApi,
  updateThemeApi,
  removeThemeApi,
} from "@/lib/themes"
import { authFetch } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

describe("themes API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchThemesApi", () => {
    it("GETs /api/themes with page and limit", async () => {
      const data = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(data))

      const result = await fetchThemesApi(1, 10)

      expect(authFetch).toHaveBeenCalledWith("/api/themes?page=1&limit=10")
      expect(result).toEqual(data)
    })
  })

  describe("fetchAllThemesApi", () => {
    it("GETs /api/themes/all", async () => {
      const themes = [{ id: "t1", slug: "dogs", label: "Dogs", sortOrder: 0 }]
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(themes))

      const result = await fetchAllThemesApi()

      expect(authFetch).toHaveBeenCalledWith("/api/themes/all")
      expect(result).toEqual(themes)
    })
  })

  describe("fetchThemeByIdApi", () => {
    it("GETs /api/themes/:id", async () => {
      const theme = { id: "t1", slug: "dogs", label: "Dogs", sortOrder: 0 }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(theme))

      const result = await fetchThemeByIdApi("t1")

      expect(authFetch).toHaveBeenCalledWith("/api/themes/t1")
      expect(result).toEqual(theme)
    })
  })

  describe("createThemeApi", () => {
    it("POSTs /api/themes with the body", async () => {
      const theme = { id: "t1", slug: "dogs", label: "Dogs", sortOrder: 0 }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(theme))

      const dto = { slug: "dogs", label: "Dogs", sortOrder: 0 }
      const result = await createThemeApi(dto)

      expect(authFetch).toHaveBeenCalledWith("/api/themes", {
        method: "POST",
        body: JSON.stringify(dto),
      })
      expect(result).toEqual(theme)
    })
  })

  describe("updateThemeApi", () => {
    it("PATCHes /api/themes/:id with the body", async () => {
      const theme = { id: "t1", slug: "dogs", label: "Doggos", sortOrder: 0 }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(theme))

      const result = await updateThemeApi("t1", { label: "Doggos" })

      expect(authFetch).toHaveBeenCalledWith("/api/themes/t1", {
        method: "PATCH",
        body: JSON.stringify({ label: "Doggos" }),
      })
      expect(result).toEqual(theme)
    })
  })

  describe("removeThemeApi", () => {
    it("DELETEs /api/themes/:id", async () => {
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(undefined))

      await removeThemeApi("t1")

      expect(authFetch).toHaveBeenCalledWith("/api/themes/t1", {
        method: "DELETE",
      })
    })
  })
})
