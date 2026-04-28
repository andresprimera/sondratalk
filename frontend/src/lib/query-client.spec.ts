import { queryClient } from "@/lib/query-client"
import { ApiError } from "@/lib/api-error"

describe("queryClient", () => {
  const retry = queryClient.getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: Error,
  ) => boolean

  describe("staleTime", () => {
    it("should default to 5 minutes", () => {
      const defaults = queryClient.getDefaultOptions()
      expect(defaults.queries?.staleTime).toBe(1000 * 60 * 5)
    })
  })

  describe("retry", () => {
    it("should not retry on client errors (4xx)", () => {
      expect(retry(0, new ApiError(400, "Bad request"))).toBe(false)
      expect(retry(0, new ApiError(404, "Not found"))).toBe(false)
      expect(retry(0, new ApiError(422, "Unprocessable"))).toBe(false)
    })

    it("should retry once on server errors (5xx)", () => {
      expect(retry(0, new ApiError(500, "Server error"))).toBe(true)
      expect(retry(1, new ApiError(500, "Server error"))).toBe(false)
    })

    it("should retry once on network errors (non-ApiError)", () => {
      expect(retry(0, new Error("Network error"))).toBe(true)
      expect(retry(1, new Error("Network error"))).toBe(false)
    })
  })
})
