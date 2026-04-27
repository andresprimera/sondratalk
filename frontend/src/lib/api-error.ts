import { type FieldError } from "@base-dashboard/shared"

export class ApiError extends Error {
  readonly statusCode: number
  readonly errors: FieldError[] | undefined

  constructor(statusCode: number, message: string, errors?: FieldError[]) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.errors = errors
  }

  get isValidation(): boolean {
    return this.statusCode === 400 && Array.isArray(this.errors)
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401
  }

  get isNotFound(): boolean {
    return this.statusCode === 404
  }
}
