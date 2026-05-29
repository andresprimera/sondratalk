import { type AuthResponse } from "@base-dashboard/shared"
import { publicFetch, authFetch } from "@/lib/api"

export type { AuthResponse }

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await publicFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

export async function signupApi(
  name: string,
  email: string,
  password: string,
  timezone: string,
): Promise<AuthResponse> {
  const res = await publicFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password, timezone }),
  })
  return res.json()
}

export async function logoutApi(): Promise<void> {
  await authFetch("/api/auth/logout", { method: "POST" })
}

export async function forgotPasswordApi(email: string): Promise<void> {
  await publicFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function resetPasswordApi(
  token: string,
  email: string,
  password: string,
): Promise<void> {
  await publicFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, email, password }),
  })
}
