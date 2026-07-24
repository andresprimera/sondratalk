import {
  getTokenExpiry,
  getTokenSubject,
  isTokenExpiringSoon,
} from "@/lib/jwt"

// Build a token whose payload segment decodes to the given object. Only the
// payload (second segment) matters to these helpers.
function makeToken(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
  return `header.${encoded}.signature`
}

describe("jwt", () => {
  describe("getTokenExpiry", () => {
    it("returns the exp claim converted to epoch milliseconds", () => {
      const expSeconds = 1_800_000_000
      expect(getTokenExpiry(makeToken({ exp: expSeconds }))).toBe(
        expSeconds * 1000,
      )
    })

    it("returns null when the payload has no exp claim", () => {
      expect(getTokenExpiry(makeToken({ sub: "abc" }))).toBeNull()
    })

    it("returns null when exp is not a number", () => {
      expect(getTokenExpiry(makeToken({ exp: "soon" }))).toBeNull()
    })

    it("returns null for a malformed token", () => {
      expect(getTokenExpiry("not-a-jwt")).toBeNull()
      expect(getTokenExpiry("")).toBeNull()
      expect(getTokenExpiry("a..c")).toBeNull()
    })
  })

  describe("getTokenSubject", () => {
    it("returns the sub claim", () => {
      expect(getTokenSubject(makeToken({ sub: "user-123" }))).toBe("user-123")
    })

    it("returns null when sub is missing or not a string", () => {
      expect(getTokenSubject(makeToken({ exp: 1 }))).toBeNull()
      expect(getTokenSubject(makeToken({ sub: 42 }))).toBeNull()
    })

    it("returns null for a malformed token", () => {
      expect(getTokenSubject("nope")).toBeNull()
    })
  })

  describe("isTokenExpiringSoon", () => {
    it("is false when the token has comfortable runway", () => {
      const exp = Math.floor(Date.now() / 1000) + 15 * 60
      expect(isTokenExpiringSoon(makeToken({ exp }))).toBe(false)
    })

    it("is true when the token is within the threshold of expiry", () => {
      const exp = Math.floor(Date.now() / 1000) + 30
      expect(isTokenExpiringSoon(makeToken({ exp }))).toBe(true)
    })

    it("is true for an already-expired token", () => {
      const exp = Math.floor(Date.now() / 1000) - 60
      expect(isTokenExpiringSoon(makeToken({ exp }))).toBe(true)
    })

    it("respects a custom threshold", () => {
      const exp = Math.floor(Date.now() / 1000) + 120
      expect(isTokenExpiringSoon(makeToken({ exp }), 60_000)).toBe(false)
      expect(isTokenExpiringSoon(makeToken({ exp }), 5 * 60_000)).toBe(true)
    })

    it("treats an undecodable token as stale", () => {
      expect(isTokenExpiringSoon("garbage")).toBe(true)
    })
  })
})
