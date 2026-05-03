import {
  type Theme,
  type PaginatedResponse,
  type CreateThemeInput,
  type UpdateThemeInput,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchThemesApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<Theme>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const res = await authFetch(`/api/themes?${params}`)
  return res.json()
}

export async function fetchAllThemesApi(): Promise<Theme[]> {
  const res = await authFetch("/api/themes/all")
  return res.json()
}

export async function fetchThemeByIdApi(id: string): Promise<Theme> {
  const res = await authFetch(`/api/themes/${id}`)
  return res.json()
}

export async function createThemeApi(data: CreateThemeInput): Promise<Theme> {
  const res = await authFetch("/api/themes", {
    method: "POST",
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateThemeApi(
  id: string,
  data: UpdateThemeInput,
): Promise<Theme> {
  const res = await authFetch(`/api/themes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function removeThemeApi(id: string): Promise<void> {
  await authFetch(`/api/themes/${id}`, { method: "DELETE" })
}
