# Atlas Search for Circles — Shared Plan

**Goal:** Add a single optional field to `circleSearchQuerySchema` so the API can accept the user's locale on the `GET /api/circles?q=` endpoint.

**Reference file to mirror:** [shared/src/schemas/circle.ts](shared/src/schemas/circle.ts) — the file already exports `LOCALE_KEYS` and `circleSearchQuerySchema`; this edit just extends the latter using the former.

**Conventions that apply (CLAUDE.md):**

> "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."

> "Every schema uses **Zod v4** (`import { z } from "zod/v4"`) and exports both the schema and its inferred type (`z.infer<typeof schema>`)."

> "Zod validation messages stay in English — schemas live in `shared/` and are used by backend too."

---

## Step 1 — Extend `circleSearchQuerySchema`

**File to modify:** `shared/src/schemas/circle.ts`

Current shape (do not touch the rest of the file):

```ts
export const circleSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  themeId: z.string().optional(),
});
```

Updated shape:

```ts
export const circleSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  themeId: z.string().optional(),
  locale: z.enum(LOCALE_KEYS).optional(),
});
```

The `locale` field is **optional** at the schema level because the backend resolves it from the `Accept-Language` header when the query param is missing (see backend.md step 4). Validation should reject any locale string outside `LOCALE_KEYS` — `z.enum(LOCALE_KEYS)` does exactly that, refusing values like `"fr"` with a Zod-standard "Invalid enum value" error.

The inferred type `CircleSearchQuery` updates automatically — no manual type edit needed.

---

## Step 2 — Verify the barrel export already covers it

**File:** `shared/src/index.ts`

`circleSearchQuerySchema` and the `CircleSearchQuery` type are already re-exported. Check the existing block looks like this and **leave it alone**:

```ts
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

> CLAUDE.md: "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."

No new export needed.

---

## Step 3 — Verify both consumers compile

The shared package has no build step (raw TS via `"main": "src/index.ts"`), so verification is via the consumers:

```sh
pnpm --filter base-dashboard-backend typecheck
pnpm --filter frontend typecheck
```

Both must pass. If either fails:

- **Backend** likely needs the controller updated (covered in [backend.md](backend.md) step 4) — OK to defer that fix until you start backend.md.
- **Frontend** needs the API function updated (covered in [frontend.md](frontend.md)) — OK to defer.

> CLAUDE.md: "The shared package has no build step — it exports raw TS via `"main": "src/index.ts"`."

---

## What ships from this sub-plan

After Step 1, both `circleSearchQuerySchema` and `CircleSearchQuery` accept (and the inferred type includes) the `locale?: 'en' | 'es'` field. The backend can validate it via `ZodValidationPipe(circleSearchQuerySchema)`; the frontend can pass it through `URLSearchParams`.

No other shared changes. Move on to [backend.md](backend.md).
