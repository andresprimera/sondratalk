import { z } from "zod/v4";

// An allowlist entry is either a full email address or a domain prefixed with
// "@" (e.g. "@sondratalk.com"). Stored normalized: trimmed and lowercased.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const domainPattern = /^@[^\s@]+\.[^\s@]+$/;

const allowlistValueSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (value) => emailPattern.test(value) || domainPattern.test(value),
    "Must be a valid email or @domain",
  );

export const allowlistEntrySchema = z.object({
  id: z.string(),
  value: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type AllowlistEntry = z.infer<typeof allowlistEntrySchema>;

export const createAllowlistEntrySchema = z.object({
  value: allowlistValueSchema,
  note: z.string().trim().max(200, "Note is too long").optional(),
});

export type CreateAllowlistEntryInput = z.infer<
  typeof createAllowlistEntrySchema
>;

export const updateAllowlistEntrySchema = createAllowlistEntrySchema.partial();

export type UpdateAllowlistEntryInput = z.infer<
  typeof updateAllowlistEntrySchema
>;
