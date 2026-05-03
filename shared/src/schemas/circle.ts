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

export const circleSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  themeId: z.string(),
  labels: labelsSchema,
  aliases: aliasesSchemaRequired,
  popularity: z.number(),
});

export type Circle = z.infer<typeof circleSchema>;

export const createCircleSchema = z.object({
  slug: slugSchema,
  themeId: z.string().min(1, "Theme is required"),
  labels: labelsSchema,
  aliases: aliasesSchemaRequired.optional(),
  popularity: z.number().int().min(0).optional(),
});

export type CreateCircleInput = z.infer<typeof createCircleSchema>;

export const updateCircleSchema = createCircleSchema.partial();

export type UpdateCircleInput = z.infer<typeof updateCircleSchema>;

export const circleSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  themeId: z.string().optional(),
});

export type CircleSearchQuery = z.infer<typeof circleSearchQuerySchema>;
