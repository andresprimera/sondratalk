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
  // No refresh on 401: a refresh mid-logout would rotate the token and
  // broadcast fresh credentials to other tabs (a cross-tab resurrection race).
  // Best-effort with the current token; the timeout bounds how long a hung
  // endpoint can delay clearing local tokens. If the access token is already
  // expired the server session isn't removed here — see logout() in use-auth.
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(10_000)
      : undefined
  await authFetch(
    "/api/auth/logout",
    { method: "POST", signal },
    { retryOnAuthFailure: false },
  )
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
