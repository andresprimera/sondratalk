import {
  type AllowlistEntry,
  type PaginatedResponse,
  type CreateAllowlistEntryInput,
  type UpdateAllowlistEntryInput,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchAllowlistApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<AllowlistEntry>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const res = await authFetch(`/api/allowlist?${params}`)
  return res.json()
}

export async function createAllowlistEntryApi(
  data: CreateAllowlistEntryInput,
): Promise<AllowlistEntry> {
  const res = await authFetch("/api/allowlist", {
    method: "POST",
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateAllowlistEntryApi(
  id: string,
  data: UpdateAllowlistEntryInput,
): Promise<AllowlistEntry> {
  const res = await authFetch(`/api/allowlist/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function removeAllowlistEntryApi(id: string): Promise<void> {
  await authFetch(`/api/allowlist/${id}`, { method: "DELETE" })
}
