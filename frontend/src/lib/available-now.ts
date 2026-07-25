import {
  type AvailableNowUser,
  type PaginatedResponse,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchAvailableNowUsersApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<AvailableNowUser>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const res = await authFetch(`/api/users/available-now?${params}`)
  return res.json()
}
