import { z } from "zod/v4";

// The pre-account registration survey ("account-last" flow). Seven short
// questions answered before the account exists, then persisted against the
// freshly created user. Fixed-choice questions use enums; the two questions
// that also accept free text (daysSpent, blocker) and the circles prompt are
// stored as plain strings.

export const registrationIntentEnum = z.enum([
  "curiosity",
  "deeper",
  "new-city",
  "other-lives",
  "personal",
]);
export type RegistrationIntent = z.infer<typeof registrationIntentEnum>;

export const ageRangeEnum = z.enum([
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
]);
export type AgeRange = z.infer<typeof ageRangeEnum>;

export const realConversationsEnum = z.enum(["yes", "no"]);
export type RealConversations = z.infer<typeof realConversationsEnum>;

export const distanceFromHomeEnum = z.enum([
  "still-there",
  "another-country",
  "lost-count",
]);
export type DistanceFromHome = z.infer<typeof distanceFromHomeEnum>;

export const submitRegistrationSurveySchema = z.object({
  intent: registrationIntentEnum,
  ageRange: ageRangeEnum,
  realConversations: realConversationsEnum,
  daysSpent: z.string().trim().min(1, "This field is required").max(300),
  distanceFromHome: distanceFromHomeEnum,
  circles: z
    .array(z.string().trim().min(1).max(100))
    .min(1, "Pick at least one")
    .max(20, "Too many selected"),
  blocker: z.string().trim().min(1, "This field is required").max(500),
});
export type SubmitRegistrationSurveyInput = z.infer<
  typeof submitRegistrationSurveySchema
>;

export const registrationSurveySchema = z.object({
  id: z.string(),
  userId: z.string(),
  intent: registrationIntentEnum,
  ageRange: ageRangeEnum,
  realConversations: realConversationsEnum,
  daysSpent: z.string(),
  distanceFromHome: distanceFromHomeEnum,
  circles: z.array(z.string()),
  blocker: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RegistrationSurvey = z.infer<typeof registrationSurveySchema>;

export const adminRegistrationSurveySchema = registrationSurveySchema.extend({
  userName: z.string(),
  userEmail: z.string(),
});
export type AdminRegistrationSurvey = z.infer<
  typeof adminRegistrationSurveySchema
>;
