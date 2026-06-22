import {
  type AdminCircle,
  type Circle,
  type PaginatedResponse,
  type CreateCircleInput,
  type CircleSearchQuery,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchCirclesApi(
  query: CircleSearchQuery,
): Promise<PaginatedResponse<Circle>> {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.themeId) params.set("themeId", query.themeId)
  if (query.locale) params.set("locale", query.locale)
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  const res = await authFetch(`/api/circles?${params}`)
  return res.json()
}

export async function fetchAdminCirclesApi(
  query: CircleSearchQuery,
): Promise<PaginatedResponse<AdminCircle>> {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.themeId) params.set("themeId", query.themeId)
  if (query.locale) params.set("locale", query.locale)
  if (query.sortBy) params.set("sortBy", query.sortBy)
  if (query.sortDir) params.set("sortDir", query.sortDir)
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  const res = await authFetch(`/api/circles/admin?${params}`)
  return res.json()
}

export async function fetchAllCirclesApi(): Promise<Circle[]> {
  const res = await authFetch("/api/circles/all")
  return res.json()
}

export async function fetchCircleByIdApi(id: string): Promise<Circle> {
  const res = await authFetch(`/api/circles/${id}`)
  return res.json()
}

export async function createCircleApi(
  data: CreateCircleInput,
): Promise<Circle> {
  const res = await authFetch("/api/circles", {
    method: "POST",
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function verifyCirclePasswordApi(
  id: string,
  password: string,
): Promise<void> {
  await authFetch(`/api/circles/${id}/verify-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  })
}
