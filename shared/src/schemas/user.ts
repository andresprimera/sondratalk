import { z } from "zod/v4";
import { LOCALE_KEYS } from "./circle";

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
  languages: z.array(userLanguageSchema).default([]),
  locale: localeKeyEnum.default("en"),
  createdAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const updateTimezoneSchema = z.object({
  timezone: timezoneSchema,
});
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;

export const updateLanguagesSchema = z.object({
  languages: z
    .array(userLanguageSchema)
    .max(20, "Too many languages"),
  locale: localeKeyEnum,
});
export type UpdateLanguagesInput = z.infer<typeof updateLanguagesSchema>;

export const updateApplicationSchema = z.object({
  applicationText: z.string().min(1, "Please tell us why you want to join").max(1000, "Keep it under 1000 characters"),
});
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
