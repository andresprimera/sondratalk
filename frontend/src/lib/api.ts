import { type AuthResponse, type ApiErrorResponse } from "@base-dashboard/shared"
import { ApiError } from "@/lib/api-error"

export const TOKEN_KEYS = {
  access: "accessToken",
  refresh: "refreshToken",
} as const

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")

function buildUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE}${path}`
}

export function getStoredTokens(): {
  accessToken: string | null
  refreshToken: string | null
} {
  return {
    accessToken: localStorage.getItem(TOKEN_KEYS.access),
    refreshToken: localStorage.getItem(TOKEN_KEYS.refresh),
  }
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEYS.access, accessToken)
  localStorage.setItem(TOKEN_KEYS.refresh, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.access)
  localStorage.removeItem(TOKEN_KEYS.refresh)
}

// --- Error handling ---

async function throwApiError(res: Response): Promise<never> {
  const body: ApiErrorResponse = await res.json().catch(() => ({
    statusCode: res.status,
    message: res.statusText || "Request failed",
  }))
  // Fall back to the HTTP status when the body omits it, so callers can always
  // classify the error (e.g. distinguish a 401 from a transient 5xx).
  throw new ApiError(
    body.statusCode ?? res.status,
    body.message ?? (res.statusText || "Request failed"),
    body.errors,
  )
}

// --- Refresh queue ---
//
// Two layers of coordination protect the refresh call:
//
//   1. `refreshPromise` dedupes concurrent refreshes *within* a single tab, so
//      a burst of 401s triggers only one network round-trip.
//   2. `withRefreshLock` serializes refreshes *across* tabs via the Web Locks
//      API. The backend rotates the refresh token on every call, so without a
//      cross-tab lock two tabs could refresh at once — the first rotates the
//      token and the second is left holding an invalidated one, forcing a
//      spurious logout. Only one tab runs the critical section at a time, and
//      it re-reads the (possibly already-rotated) token from storage before
//      hitting the network. Browsers without the API — or non-secure contexts
//      and the jsdom test env — fall back to the per-tab dedup alone.
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("token-refresh", fn)
  }
  return fn()
}

// A refresh that stalls on the network would hold the cross-tab lock (and this
// tab's `refreshPromise`) open, blocking every other tab's renewal until the
// browser's own multi-minute timeout. Bounding the request keeps the critical
// section short; the abort surfaces as a transient failure that leaves the
// session intact for a later retry rather than a spurious logout.
const REFRESH_TIMEOUT_MS = 15_000

function refreshAbortSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(REFRESH_TIMEOUT_MS)
  }
  return undefined
}

// Session guards that keep *every* refreshTokens() caller — including the call
// socket, which refreshes outside React — from persisting tokens for a session
// the user has left. Two complementary checks, both flipped only at true session
// boundaries (endSession / beginSession), never by an ordinary refresh commit:
//   - sessionEpoch (a counter) catches a refresh whose generation changed while
//     it was outstanding — an in-flight refresh at logout, OR a refresh that
//     started during logout and is then outlived by a re-login (which advances
//     the generation, making the stale refresh's captured epoch mismatch).
//   - sessionEnded (a flag) catches a refresh that STARTS AFTER a logout with no
//     re-login (e.g. a socket connect_error during logout's await window) — the
//     counter can't, because that refresh captures the already-bumped epoch.
// A refresh refuses to storeTokens() while either says the session is gone.
let sessionEpoch = 0
let sessionEnded = false
let refreshPromise: Promise<AuthResponse> | null = null

export function getSessionEpoch(): number {
  return sessionEpoch
}

// Ends the current session: marks it ended (so even a refresh that starts later
// won't persist), bumps the generation (so an in-flight refresh declines its
// result), and drops the shared refresh promise (so a brand-new session never
// dedupes onto a pre-logout refresh). Does NOT clear storage — callers decide
// that, since a logout request may still need the current token.
export function endSession(): void {
  sessionEpoch++
  sessionEnded = true
  refreshPromise = null
}

// Starts a new session generation on a real login/signup. Advancing the epoch
// (not just clearing the flag) is essential: a refresh that started during the
// previous logout captured the post-logout epoch, so only a fresh generation
// makes its captured epoch stale and keeps it from overwriting the new tokens.
export function beginSession(): void {
  sessionEpoch++
  sessionEnded = false
  refreshPromise = null
}

export async function refreshTokens(): Promise<AuthResponse> {
  if (refreshPromise) return refreshPromise

  const epochAtStart = sessionEpoch
  const pending = withRefreshLock(async () => {
    // Waiting for the cross-tab lock can take a while; the session may have
    // ended or rotated in the meantime. Re-check BEFORE hitting the network so
    // we don't fire a refresh (which rotates the server token) for a session we
    // have already left — the post-fetch guards would discard the result, but
    // the needless rotation could desync a freshly-logged-in session.
    if (sessionEnded || sessionEpoch !== epochAtStart) {
      throw new Error("Refresh superseded by a newer session")
    }

    // Read inside the lock: another tab may have rotated the token while we
    // waited our turn, so capturing it earlier would send a stale value.
    const { refreshToken } = getStoredTokens()
    if (!refreshToken) {
      clearTokens()
      throw new ApiError(401, "No refresh token")
    }

    const res = await fetch(buildUrl("/api/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      signal: refreshAbortSignal(),
    })

    if (!res.ok) {
      if (sessionEnded || sessionEpoch !== epochAtStart) {
        // The session ended, or was superseded by a newer one, while this
        // refresh was outstanding — don't surface as an auth failure (a plain
        // Error keeps callers from signing out) and don't touch storage, which
        // now belongs to that newer session (or was cleared by the logout).
        throw new Error("Refresh superseded by a newer session")
      }
      // A definitive auth rejection ends the session; transient 5xx / network
      // failures keep the tokens so a later attempt can recover.
      if (res.status === 401 || res.status === 403) {
        clearTokens()
      }
      await throwApiError(res)
    }

    const data: AuthResponse = await res.json()
    if (sessionEnded || sessionEpoch !== epochAtStart) {
      // Same guard on the success path: decline to persist the rotated tokens
      // for a session the user has left (or that a newer session superseded).
      throw new Error("Refresh superseded by a newer session")
    }
    storeTokens(data.accessToken, data.refreshToken)
    return data
  })

  refreshPromise = pending
  try {
    return await pending
  } finally {
    // Only clear the shared slot if it's still ours — endSession() or a newer
    // refresh may have already replaced it.
    if (refreshPromise === pending) refreshPromise = null
  }
}

// --- Fetch helpers ---

export async function publicFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(buildUrl(url), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  if (!res.ok) {
    await throwApiError(res)
  }
  return res
}

// Signs the user out on a genuinely dead session: drop tokens, redirect to the
// login page, and throw an ApiError (so React Query's retry predicate
// short-circuits rather than re-firing the query during the redirect).
function endSessionAndRedirect(): never {
  clearTokens()
  window.location.href = "/login"
  throw new ApiError(401, "Session expired")
}

export async function authFetch(
  url: string,
  options: RequestInit = {},
  // Logout opts out of the refresh-on-401 dance: a refresh mid-logout would
  // rotate the token and broadcast fresh credentials to other tabs.
  { retryOnAuthFailure = true }: { retryOnAuthFailure?: boolean } = {},
): Promise<Response> {
  const { accessToken } = getStoredTokens()
  const fullUrl = buildUrl(url)

  const makeRequest = (token: string | null): Promise<Response> =>
    fetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  const res = await makeRequest(accessToken)

  if (res.status === 401 && retryOnAuthFailure) {
    let newToken: string | null
    try {
      newToken = (await refreshTokens()).accessToken
    } catch (err) {
      // The *refresh* failed. Only a definitive auth failure (dead refresh
      // token) ends the session; a transient failure (5xx / network / the 15s
      // abort, or a "superseded" plain Error) must surface without logging out.
      if (
        err instanceof ApiError &&
        (err.statusCode === 401 || err.statusCode === 403)
      ) {
        endSessionAndRedirect()
      }
      throw err
    }

    // The refresh succeeded — the retried request's own errors are business
    // errors (a 401 for a wrong current password, a 403 from a guard, ...) and
    // surface as-is. They must not force a logout, or a normal validation
    // failure would sign the user out.
    const retryRes = await makeRequest(newToken)
    if (!retryRes.ok) {
      await throwApiError(retryRes)
    }
    return retryRes
  }

  if (!res.ok) {
    await throwApiError(res)
  }

  return res
}
