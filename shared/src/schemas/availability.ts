import { z } from "zod/v4";

export const periodEnum = z.enum(["morning", "afternoon", "evening"]);
export type Period = z.infer<typeof periodEnum>;

export const dayEnum = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);
export type Day = z.infer<typeof dayEnum>;

export const availabilityWindowSchema = z.object({
  period: periodEnum,
  day: dayEnum,
});
export type AvailabilityWindow = z.infer<typeof availabilityWindowSchema>;

export const availabilitySchema = z.object({
  windows: z.array(availabilityWindowSchema).max(21),
  isAvailableNow: z.boolean(),
});
export type Availability = z.infer<typeof availabilitySchema>;

export const updateAvailabilitySchema = availabilitySchema
  .partial()
  .refine((v) => v.windows !== undefined || v.isAvailableNow !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
