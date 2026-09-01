import {
  submitRegistrationSurveyApi,
  fetchRegistrationSurveysApi,
} from "@/lib/registration-surveys"
import { authFetch } from "@/lib/api"
import type { SubmitRegistrationSurveyInput } from "@base-dashboard/shared"

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
}))

const mockJsonResponse = (data: unknown): Response =>
  ({ json: () => Promise.resolve(data) }) as unknown as Response

const SAMPLE_INPUT: SubmitRegistrationSurveyInput = {
  intent: "deeper",
  ageRange: "35-44",
  realConversations: "no",
  daysSpent: "At home",
  distanceFromHome: "another-country",
  circles: ["Parenthood", "Building something"],
  blocker: "It'll be awkward",
}

describe("registration-survey API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("submitRegistrationSurveyApi", () => {
    it("should POST to /api/registration-surveys with the answers", async () => {
      vi.mocked(authFetch).mockResolvedValue(
        mockJsonResponse({ id: "rs-1", ...SAMPLE_INPUT }),
      )

      const result = await submitRegistrationSurveyApi(SAMPLE_INPUT)

      expect(authFetch).toHaveBeenCalledWith("/api/registration-surveys", {
        method: "POST",
        body: JSON.stringify(SAMPLE_INPUT),
      })
      expect(result).toMatchObject({ id: "rs-1" })
    })
  })

  describe("fetchRegistrationSurveysApi", () => {
    it("should GET /api/registration-surveys with pagination params", async () => {
      const page = { data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } }
      vi.mocked(authFetch).mockResolvedValue(mockJsonResponse(page))

      const result = await fetchRegistrationSurveysApi(2, 20)

      expect(authFetch).toHaveBeenCalledWith(
        "/api/registration-surveys?page=2&limit=20",
      )
      expect(result).toEqual(page)
    })
  })
})
