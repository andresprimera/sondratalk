import {
  type User,
  type PaginatedResponse,
  type CreateUserInput,
  type FoundingMembersCount,
  foundingMembersCountSchema,
} from "@base-dashboard/shared"
import { authFetch, publicFetch } from "@/lib/api"

export async function fetchFoundingMembersCountApi(): Promise<FoundingMembersCount> {
  const res = await publicFetch("/api/users/count")
  return foundingMembersCountSchema.parse(await res.json())
}

export async function fetchUsersApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<User>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
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
