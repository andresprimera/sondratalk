import { z } from "zod/v4";
import { paginationQuerySchema } from "./pagination";

export const LOCALE_KEYS = ["en", "es"] as const;
export type LocaleKey = (typeof LOCALE_KEYS)[number];

const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

const labelsSchema = z.object({
  en: z.string().min(1, "Label is required"),
  es: z.string().min(1, "Label is required"),
});

const aliasesSchemaRequired = z.object({
  en: z.array(z.string()),
  es: z.array(z.string()),
});

export const circleTypeEnum = z.enum([
  "who-you-are",
  "what-you-love",
  "where-you-are",
]);
export type CircleType = z.infer<typeof circleTypeEnum>;

export const circleSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  themeId: z.string().nullable(),
  type: circleTypeEnum,
  labels: labelsSchema,
  aliases: aliasesSchemaRequired,
  popularity: z.number(),
  isPrivate: z.boolean(),
});

export type Circle = z.infer<typeof circleSchema>;

export const adminCircleSchema = circleSchema.extend({
  membershipCount: z.number().int().default(0),
});
export type AdminCircle = z.infer<typeof adminCircleSchema>;

const createCircleBaseSchema = z.object({
  slug: slugSchema,
  themeId: z.string().min(1).nullish(),
  type: circleTypeEnum,
  labels: labelsSchema,
  aliases: aliasesSchemaRequired.optional(),
  popularity: z.number().int().min(0).optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().min(1, "Password is required").optional(),
});

export const createCircleSchema = createCircleBaseSchema.refine(
  (data) => !data.isPrivate || Boolean(data.password),
  { message: "Password is required for private circles", path: ["password"] },
);

export type CreateCircleInput = z.infer<typeof createCircleSchema>;

// Not refined like createCircleSchema: a partial update can't know from the
// payload alone whether the circle already has a password set (e.g.
// renaming an already-private circle without resending the password). The
// backend checks isPrivate/password consistency against the existing
// document instead — see CirclesService.update().
export const updateCircleSchema = createCircleBaseSchema.partial();

export type UpdateCircleInput = z.infer<typeof updateCircleSchema>;

export const verifyCirclePasswordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});
export type VerifyCirclePasswordInput = z.infer<
  typeof verifyCirclePasswordSchema
>;

export const circleSortByEnum = z.enum([
  "slug",
  "labelEn",
  "labelEs",
  "theme",
  "type",
  "popularity",
]);
export type CircleSortBy = z.infer<typeof circleSortByEnum>;

export const circleSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  themeId: z.string().optional(),
  // Filters to circles with no theme assigned at all. Mutually exclusive
  // with themeId in practice — callers pass one or the other.
  noTheme: z.stringbool().optional(),
  locale: z.enum(LOCALE_KEYS).optional(),
  sortBy: circleSortByEnum.optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type CircleSearchQuery = z.infer<typeof circleSearchQuerySchema>;
