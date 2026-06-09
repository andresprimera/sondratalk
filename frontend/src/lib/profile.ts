import {
  type User,
  type UpdateTimezoneInput,
  type UpdateLanguagesInput,
  type UpdateApplicationInput,
} from "@base-dashboard/shared"
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

export async function updateTimezoneApi(input: UpdateTimezoneInput): Promise<User> {
  const res = await authFetch("/api/users/me/timezone", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function updateMyLanguagesApi(
  input: UpdateLanguagesInput,
): Promise<User> {
  const res = await authFetch("/api/users/me/languages", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function updateMyApplicationApi(
  input: UpdateApplicationInput,
): Promise<User> {
  const res = await authFetch("/api/users/me/application", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return res.json()
}
