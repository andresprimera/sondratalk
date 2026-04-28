import { ApiError } from "@/lib/api-error"

describe("ApiError", () => {
  it("should extend Error with correct name and message", () => {
    const error = new ApiError(400, "Bad request")
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("ApiError")
    expect(error.message).toBe("Bad request")
  })

  it("should store statusCode and errors", () => {
    const errors = [{ field: "email", message: "Invalid email" }]
    const error = new ApiError(400, "Validation failed", errors)
    expect(error.statusCode).toBe(400)
    expect(error.errors).toEqual(errors)
  })

  it("should have undefined errors when not provided", () => {
    const error = new ApiError(500, "Server error")
    expect(error.errors).toBeUndefined()
  })

  describe("isValidation", () => {
    it("should return true for 400 with errors array", () => {
      const error = new ApiError(400, "Validation failed", [
        { field: "name", message: "Required" },
      ])
      expect(error.isValidation).toBe(true)
    })

    it("should return false for 400 without errors", () => {
      const error = new ApiError(400, "Bad request")
      expect(error.isValidation).toBe(false)
    })

    it("should return false for non-400 with errors", () => {
      const error = new ApiError(422, "Unprocessable", [
        { field: "x", message: "y" },
      ])
      expect(error.isValidation).toBe(false)
    })
  })

  describe("isUnauthorized", () => {
    it("should return true for 401", () => {
      expect(new ApiError(401, "Unauthorized").isUnauthorized).toBe(true)
    })

    it("should return false for non-401", () => {
      expect(new ApiError(403, "Forbidden").isUnauthorized).toBe(false)
    })
  })

  describe("isNotFound", () => {
    it("should return true for 404", () => {
      expect(new ApiError(404, "Not found").isNotFound).toBe(true)
    })

    it("should return false for non-404", () => {
      expect(new ApiError(400, "Bad request").isNotFound).toBe(false)
    })
  })
})
