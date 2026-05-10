import { z } from "zod/v4";

export const roleEnum = z.enum(["admin", "user"]);
export type Role = z.infer<typeof roleEnum>;

export const timezoneSchema = z
  .string()
  .min(1)
  .refine(
    (v) => {
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: v });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid timezone" },
  );

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: roleEnum,
  timezone: timezoneSchema,
});

export type User = z.infer<typeof userSchema>;

export const updateTimezoneSchema = z.object({
  timezone: timezoneSchema,
});
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;
