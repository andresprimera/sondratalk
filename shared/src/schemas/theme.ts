import { z } from "zod/v4";

const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

const themeLabelsSchema = z.object({
  en: z.string().min(1, "Label is required"),
  es: z.string().min(1, "Label is required"),
});

export const themeSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  labels: themeLabelsSchema,
  sortOrder: z.number(),
});

export type Theme = z.infer<typeof themeSchema>;

export const createThemeSchema = z.object({
  slug: slugSchema,
  labels: themeLabelsSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateThemeInput = z.infer<typeof createThemeSchema>;

export const updateThemeSchema = createThemeSchema.partial();

export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
