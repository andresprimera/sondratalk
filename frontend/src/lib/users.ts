import {
  type User,
  type AdminUser,
  type PaginatedResponse,
  type CreateUserInput,
  type UsersQuery,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchUsersApi(
  query: UsersQuery,
): Promise<PaginatedResponse<AdminUser>> {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.sortBy) params.set("sortBy", query.sortBy)
  if (query.sortDir) params.set("sortDir", query.sortDir)
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  const res = await authFetch(`/api/users?${params}`)
  return res.json()
}

export async function updateUserRoleApi(
  userId: string,
  role: string,
): Promise<User> {
  const res = await authFetch(`/api/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  })
  return res.json()
}

export async function removeUserApi(userId: string): Promise<void> {
  await authFetch(`/api/users/${userId}`, { method: "DELETE" })
}

export async function createUserApi(data: CreateUserInput): Promise<User> {
  const res = await authFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  })
  return res.json()
}
