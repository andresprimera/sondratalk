import { type User } from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function updateProfileApi(
  name: string,
  email: string,
): Promise<User> {
  const res = await authFetch("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify({ name, email }),
  })
  return res.json()
}

export async function changePasswordApi(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await authFetch("/api/users/me/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
