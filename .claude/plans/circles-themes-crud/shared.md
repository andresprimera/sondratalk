# Themes + Circles — Shared Contract Plan

**Goal:** Add Zod schemas and inferred types to `@base-dashboard/shared` for both `Theme` and `Circle` entities, plus their create/update inputs and the circle search query. Backend DTOs and frontend API functions both consume this directly.

**Reference files to mirror:**

- [shared/src/schemas/user.ts](shared/src/schemas/user.ts) — entity + role enum pattern.
- [shared/src/schemas/auth.ts](shared/src/schemas/auth.ts) — multi-schema-per-file pattern (login, signup, etc.).
- [shared/src/schemas/pagination.ts](shared/src/schemas/pagination.ts) — `paginationQuerySchema` and `PaginatedResponse<T>` re-used here.
- [shared/src/index.ts](shared/src/index.ts) — re-export pattern.

**Conventions that apply (CLAUDE.md):**

> "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."

> "Every schema uses **Zod v4** (`import { z } from "zod/v4"`) and exports both the schema and its inferred type (`z.infer<typeof schema>`)."

> "Zod validation messages stay in English — schemas live in `shared/` and are used by backend too."

> "Backend DTO files (`backend/src/<feature>/dto/`) **re-export** from shared — they never redefine the same schema."

---

## Step 1 — Theme schemas

**File to create:** `shared/src/schemas/theme.ts`

Required exports:

| Export | Kind | Shape |
|---|---|---|
| `themeSchema` | `z.object` | `{ id: string, slug: string, label: string, sortOrder: number }` |
| `Theme` | `z.infer` of `themeSchema` | — |
| `createThemeSchema` | `z.object` | `{ slug, label, sortOrder? }` |
| `CreateThemeInput` | `z.infer` of `createThemeSchema` | — |
| `updateThemeSchema` | `createThemeSchema.partial()` | All optional |
| `UpdateThemeInput` | `z.infer` of `updateThemeSchema` | — |

Validation rules to encode in the schema (errors in **English**):

- `slug`: `z.string().min(1, "Slug is required").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")` — drives the unique-key contract.
- `label`: `z.string().min(1, "Label is required")`.
- `sortOrder`: `z.number().int().min(0).default(0)` on `createThemeSchema`. On the entity (`themeSchema`), it's `z.number()` (always present from the API).

`themeSchema` is the **API response shape** — `id` is the Mongoose `_id` stringified. `createThemeSchema` is the **request body** — no `id`.

---

## Step 2 — Locale tuple + helpers (one place to add a new locale)

**File to create:** `shared/src/schemas/circle.ts`

Top of file, before any circle schema:

```ts
import { z } from "zod/v4";
import { paginationQuerySchema } from "./pagination";

// Single source of truth for which locales are supported by Circle labels/aliases.
// Adding a new locale: append the key here. Backend `buildSearchTerms` and the
// frontend's locale picker should both derive from this.
export const LOCALE_KEYS = ["en", "es"] as const;
export type LocaleKey = (typeof LOCALE_KEYS)[number];

// Builds a Zod object schema with one required string field per locale.
// Used for the `labels` shape (each locale required, non-empty).
function localeStringObject() {
  const shape = Object.fromEntries(
    LOCALE_KEYS.map((k) => [k, z.string().min(1, "Label is required")]),
  ) as Record<LocaleKey, z.ZodString>;
  return z.object(shape);
}

// Same shape but each value is an array of strings (aliases). Defaults to [].
function localeStringArrayObject() {
  const shape = Object.fromEntries(
    LOCALE_KEYS.map((k) => [k, z.array(z.string()).default([])]),
  ) as Record<LocaleKey, z.ZodDefault<z.ZodArray<z.ZodString>>>;
  return z.object(shape);
}
```

These two helpers are **the only place** that knows the locale list maps to schema fields. The rest of the file just composes them.

---

## Step 3 — Circle schemas

Same file: `shared/src/schemas/circle.ts`.

Required exports (in addition to `LOCALE_KEYS` and `LocaleKey` from Step 2):

| Export | Kind | Shape |
|---|---|---|
| `circleSchema` | `z.object` | `{ id, slug, themeId, labels: {en,es}, aliases: {en,es}, popularity }` |
| `Circle` | `z.infer` of `circleSchema` | — |
| `createCircleSchema` | `z.object` | `{ slug, themeId, labels, aliases?, popularity? }` |
| `CreateCircleInput` | `z.infer` of `createCircleSchema` | — |
| `updateCircleSchema` | `createCircleSchema.partial()` | All optional |
| `UpdateCircleInput` | `z.infer` of `updateCircleSchema` | — |
| `circleSearchQuerySchema` | extends `paginationQuerySchema` with `q?`, `themeId?` | — |
| `CircleSearchQuery` | `z.infer` of `circleSearchQuerySchema` | — |

Field validation:

- `slug`: same regex as theme — `z.string().min(1, "Slug is required").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")`.
- `themeId`: `z.string().min(1, "Theme is required")` — Mongoose `ObjectId` stringified. Don't try to validate ObjectId shape in shared; that's a backend concern.
- `labels`: `localeStringObject()` from Step 2 — every locale required, every value non-empty.
- `aliases`: `localeStringArrayObject().optional()` on create — defaults handled per-locale by the helper. On `circleSchema` (the response), `localeStringArrayObject()` directly (always present, possibly empty arrays).
- `popularity`: `z.number().int().min(0).default(0)` on create; `z.number()` on the response schema.

The `searchTerms` field is **NOT in any shared schema** — it's a backend-only concern (the service builds it; the controller never returns it because the frontend doesn't need it).

`circleSearchQuerySchema`:

```ts
export const circleSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  themeId: z.string().optional(),
});
```

The frontend will hit `GET /api/circles?q=&themeId=&page=&limit=` with whichever filters apply. When `q` is empty/missing, the backend returns plain paginated results sorted by `popularity desc`. When `q` is present, results are sorted by `$text` score then `popularity desc`.

---

## Step 4 — Re-export from the package barrel

**File to modify:** `shared/src/index.ts`

Append two new export blocks (keep the existing exports untouched):

```ts
export {
  themeSchema,
  type Theme,
  createThemeSchema,
  type CreateThemeInput,
  updateThemeSchema,
  type UpdateThemeInput,
} from "./schemas/theme";

export {
  LOCALE_KEYS,
  type LocaleKey,
  circleSchema,
  type Circle,
  createCircleSchema,
  type CreateCircleInput,
  updateCircleSchema,
  type UpdateCircleInput,
  circleSearchQuerySchema,
  type CircleSearchQuery,
} from "./schemas/circle";
```

Order doesn't matter; place them after the existing user/auth/pagination/api blocks.

---

## Step 5 — Verify the shared package compiles

The shared package has no build step (raw TS via `"main": "src/index.ts"`), so verification is via the consumers:

```bash
pnpm --filter base-dashboard-backend typecheck
pnpm --filter frontend typecheck
```

Both must pass. If either fails with `Cannot find module '@base-dashboard/shared'` for the new exports, you forgot to update `shared/src/index.ts`.

> CLAUDE.md: "The shared package has no build step — it exports raw TS via `"main": "src/index.ts"`."

---

## Step 6 — Sanity test (optional, recommended)

Shared schemas don't currently have tests, and a Zod schema mostly tests itself via the consumers. But if you want one round-trip sanity check, drop a quick test under `shared/src/schemas/circle.test.ts` (or wherever fits the package; check if there's an existing test config). Not strictly required for this plan.

---

## What ships from this sub-plan

After Step 4, the implementing agent has imported into both backend and frontend the following from `@base-dashboard/shared`:

- `themeSchema`, `Theme`, `createThemeSchema`, `CreateThemeInput`, `updateThemeSchema`, `UpdateThemeInput`
- `circleSchema`, `Circle`, `createCircleSchema`, `CreateCircleInput`, `updateCircleSchema`, `UpdateCircleInput`
- `circleSearchQuerySchema`, `CircleSearchQuery`
- `LOCALE_KEYS`, `LocaleKey`

These names are referenced by file path and exact spelling in [backend.md](backend.md) and [frontend.md](frontend.md). Don't rename them.
