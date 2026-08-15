import { z } from "zod/v4";
import { LOCALE_KEYS, circleSchema } from "./circle";
import { paginationQuerySchema } from "./pagination";

export const roleEnum = z.enum(["admin", "user", "founding_member"]);
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

export const fluencyEnum = z.enum(["Conversational", "Fluent", "Native"]);
export type Fluency = z.infer<typeof fluencyEnum>;

export const userLanguageSchema = z.object({
  code: z.string().min(2).max(8),
  fluency: fluencyEnum,
});
export type UserLanguage = z.infer<typeof userLanguageSchema>;

export const localeKeyEnum = z.enum(LOCALE_KEYS);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: roleEnum,
  timezone: timezoneSchema,
  city: z.string().default(""),
  languages: z.array(userLanguageSchema).default([]),
  locale: localeKeyEnum.default("en"),
  applicationText: z.string().optional(),
  createdAt: z.string(),
  hostExpPoints: z.number().int().default(0),
});

export type User = z.infer<typeof userSchema>;

export const adminUserSchema = userSchema.extend({
  conversationCount: z.number().int().default(0),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

// An admin-facing view of a user who is reachable for a Talk Now conversation
// right now — the toggle is on and their presence heartbeat is still fresh.
// Bundles the circles they belong to so admins can see the live pool at a glance.
export const availableNowUserSchema = userSchema
  .pick({
    id: true,
    name: true,
    email: true,
    role: true,
    timezone: true,
  })
  .extend({ circles: z.array(circleSchema) });
export type AvailableNowUser = z.infer<typeof availableNowUserSchema>;

export const usersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  sortBy: z.enum(["name", "role"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});
export type UsersQuery = z.infer<typeof usersQuerySchema>;

export const updateTimezoneSchema = z.object({
  timezone: timezoneSchema,
  city: z.string().optional(),
});
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;

export const updateLanguagesSchema = z.object({
  languages: z
    .array(userLanguageSchema)
    .max(20, "Too many languages"),
  locale: localeKeyEnum,
});
export type UpdateLanguagesInput = z.infer<typeof updateLanguagesSchema>;

export const foundingMembersCountSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type FoundingMembersCount = z.infer<typeof foundingMembersCountSchema>;

export const updateApplicationSchema = z.object({
  applicationText: z.string().min(1, "Please tell us why you want to join").max(1000, "Keep it under 1000 characters"),
});
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
