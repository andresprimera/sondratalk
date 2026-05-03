import {
  type Circle,
  type PaginatedResponse,
  type CreateCircleInput,
  type UpdateCircleInput,
  type CircleSearchQuery,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchCirclesApi(
  query: CircleSearchQuery,
): Promise<PaginatedResponse<Circle>> {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.themeId) params.set("themeId", query.themeId)
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  const res = await authFetch(`/api/circles?${params}`)
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

export async function updateCircleApi(
  id: string,
  data: UpdateCircleInput,
): Promise<Circle> {
  const res = await authFetch(`/api/circles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function removeCircleApi(id: string): Promise<void> {
  await authFetch(`/api/circles/${id}`, { method: "DELETE" })
}
