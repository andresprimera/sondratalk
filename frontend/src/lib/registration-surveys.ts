import {
  type AdminRegistrationSurvey,
  type PaginatedResponse,
  type RegistrationSurvey,
  type SubmitRegistrationSurveyInput,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function submitRegistrationSurveyApi(
  input: SubmitRegistrationSurveyInput,
): Promise<RegistrationSurvey> {
  const res = await authFetch("/api/registration-surveys", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function fetchRegistrationSurveysApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<AdminRegistrationSurvey>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const res = await authFetch(`/api/registration-surveys?${params}`)
  return res.json()
}
