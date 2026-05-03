# Themes + Circles Admin CRUD

## Goal

Give admins a back-office UI to manage two new collections: **Themes** (broad umbrella categories like `dogs`, `cars`) and **Circles** (granular topics like `german-shepherd`, `dog-walking`, with multilingual labels and aliases). A user-facing picker to attach circles to users/groups/conversations is **out of scope** — this plan only delivers the admin catalog and a search endpoint that proves out the multilingual indexing strategy.

The deliverable is:

- A `themes` collection with admin CRUD.
- A `circles` collection (FK → `themes`) with admin CRUD plus a `?q=` search endpoint that supports search in any supported locale (currently `en` and `es`) and returns results ranked by text-match score then `popularity`.
- Admin pages at `/dashboard/themes` and `/dashboard/circles` that mirror the patterns of the existing [pages/users.tsx](frontend/src/pages/users.tsx).

## Surface area

- [x] **Shared contract** — see [shared.md](shared.md). Zod schemas for `Theme`, `Circle`, create/update inputs, and circle search query.
- [x] **Backend** — see [backend.md](backend.md). Two NestJS modules (`themes/`, `circles/`) with paginated CRUD, admin guards, and the search endpoint.
- [x] **Frontend** — see [frontend.md](frontend.md). Two admin pages, four dialog components, two API files, routing/sidebar updates, i18n strings.

## Execution order

The implementing agent should ship the slices in this order, running `pnpm lint && pnpm typecheck && pnpm test` at the end of each step before moving to the next:

1. **Shared schemas** — both `theme.ts` and `circle.ts` (and re-exports). Unblocks everything else.
   > CLAUDE.md: "When adding a new feature, define the schemas and types in shared **first**, then build the backend and frontend against them."
2. **Backend `themes/`** module — simpler, no FK, no search. Establishes the CRUD shape that `circles/` will reuse.
3. **Backend `circles/`** module — adds the FK to `themes`, the `searchTerms` denormalization helper, and the indexed search endpoint.
4. **Frontend `lib/themes.ts` + `pages/themes.tsx` + `components/add-theme-dialog.tsx` + `components/edit-theme-dialog.tsx`** — admin UI for themes. Add `/dashboard/themes` route + sidebar entry.
5. **Frontend `lib/circles.ts` + `pages/circles.tsx` + `components/add-circle-dialog.tsx` + `components/edit-circle-dialog.tsx`** — admin UI for circles. Add `/dashboard/circles` route + sidebar entry.

Each frontend slice ends with a manual browser pass:

> CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete."

## Data model (locked — do not re-litigate)

```
themes
  _id, slug (unique, lowercase, kebab-case),
  label,                   // admin-only display string, no translation
  sortOrder: number,       // default 0; controls list order
  timestamps

circles
  _id, slug (unique, lowercase, kebab-case),
  themeId (ObjectId, ref: 'Theme', required),
  labels:    { en: string, es: string },          // required for every supported locale
  aliases:   { en: string[], es: string[] },      // optional; alternate names users might search
  searchTerms: string[],                          // denormalized: lowercased + accent-stripped, includes labels + aliases for ALL locales. Rebuilt by the service whenever labels/aliases change.
  popularity: number,                             // default 0; bumped over time as circles get used
  timestamps
```

### Why `searchTerms` is denormalized

MongoDB's `$text` index supports one language analyzer per index, which would force us to either pick a winner or maintain N indexes. Instead, we precompute a flat `searchTerms` array of lowercased, accent-stripped strings (Unicode NFD + strip combining marks) covering every locale's labels and aliases. A single text index over that array gives uniform substring/prefix matching across all locales — Spanish "Pastor Alemán" becomes searchable as "pastor aleman" without language-specific tokenizers.

The cost is one rebuild on every write, done in the service. The `circles` document shape stays stable, so if quality becomes a problem later (typo tolerance, stemming) we can swap the storage layer for Atlas Search or Meilisearch without changing the API surface.

## MongoDB indexes on `circles`

- Unique on `slug`.
- Single-field on `themeId`.
- **Text index on `searchTerms`** (one index, all locales).
- Compound on `{ themeId: 1, popularity: -1 }` for "list circles in theme by popularity."

## Locale source of truth

The supported locales for `labels` / `aliases` / `searchTerms` are pinned in **one place** in shared, exported as a const tuple:

```ts
// shared/src/schemas/circle.ts
export const LOCALE_KEYS = ["en", "es"] as const;
export type LocaleKey = (typeof LOCALE_KEYS)[number];
```

Adding a new locale = adding a string to that tuple. The Zod `labels` / `aliases` shape, the `circleSearchQuerySchema.locale` field, and the backend `buildSearchTerms()` helper all derive from `LOCALE_KEYS`.

This deliberately tracks the same locales as `VITE_SUPPORTED_LOCALES` on the frontend; if you ever decouple them, do it in this one place.

## Lint and TypeScript enforcement

The repo's ESLint and TypeScript configs already block the most common mistakes ([frontend/eslint.config.js](frontend/eslint.config.js), [backend/eslint.config.mjs](backend/eslint.config.mjs)):

- No `any`, no `as` (warning, except `as const`), no `console.*`.
- No `"use client"` / `"use server"`.
- No `axios`, `date-fns`, `dayjs`, `moment`, `zustand`, `redux`, `jotai`, bare `zod` (must be `zod/v4`), `@hookform/resolvers/zod` (must be `standard-schema`).
- No `../` parent imports on the frontend (use `@/` alias).
- Default exports only in `src/pages/**` and the canonical entry points.
- kebab-case filenames everywhere.

The implementing agent does not need to remember those rules — `pnpm lint` will fail if they're broken. The sub-plans cite specific rules only where the lint config can't catch them (naming patterns, query-key shape, file organization, test coverage requirements, etc.).

## Decisions and assumptions

- **Themes are admin-managed via collection** (not enum) so adding/renaming themes doesn't require a code deploy.
- **Themes have no translation** — they're admin-facing only.
- **Circles are admin-only** for now. End users do not create circles in this plan; that's deferred.
- **One theme per circle** (single FK, not tags array). Adding `secondaryThemes` later is non-breaking.
- **No "popularity" auto-increment yet** — `popularity` is settable from the admin UI but the system that bumps it (when users attach to circles) is out of scope.
- **No moderation status** — admins create finished records.

## Open questions

None — all model, scope, and indexing decisions are locked.

## Next step

Hand `shared.md` to the implementing agent. After shared lands, hand them `backend.md`, then `frontend.md`. Each sub-plan is self-contained and quotes the CLAUDE.md rules its steps depend on.
