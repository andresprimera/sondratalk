// Lightweight, unverified decoding of a JWT's expiry claim. The frontend never
// trusts these tokens for authorization — the backend verifies signatures — it
// only reads `exp` to decide when to proactively renew the access token.

// Decode a JWT's `exp` claim into an absolute epoch-millisecond timestamp.
// Returns null when the token is malformed or carries no numeric `exp`, which
// callers treat as "unknown" rather than "never expires".
export function getTokenExpiry(token: string): number | null {
  const payloadPart = token.split(".")[1]
  if (!payloadPart) return null

  try {
    // JWTs are base64url-encoded; atob expects standard base64.
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const decoded: unknown = JSON.parse(atob(normalized))
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "exp" in decoded &&
      typeof decoded.exp === "number"
    ) {
      return decoded.exp * 1000
    }
    return null
  } catch {
    return null
  }
}

// A token counts as "expiring soon" once it is within `thresholdMs` of expiry
// (default one minute, matching the proactive refresh lead time). A token we
// cannot decode is treated as stale so callers renew rather than fire a request
// that is guaranteed to 401.
export function isTokenExpiringSoon(token: string, thresholdMs = 60_000): boolean {
  const expiry = getTokenExpiry(token)
  if (expiry === null) return true
  return expiry - Date.now() <= thresholdMs
}
