import { z } from "zod/v4";

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

export const apiErrorResponseSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
