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

// Wall-clock times (HH:mm, 24h) suggested within each period, in the
// candidate user's local timezone. The matching service projects these
// into concrete future date+time slots translated to the requester's tz.
export const PERIOD_SLOTS: Record<Period, readonly string[]> = {
  morning: ["09:00", "10:30", "12:00"],
  afternoon: ["13:00", "15:00", "17:00"],
  evening: ["18:00", "20:00", "22:00"],
};

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
