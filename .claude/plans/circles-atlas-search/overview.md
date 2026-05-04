# Atlas Search for Circles (Locale-Scoped)

> **Supersedes** [.claude/plans/circles-meili-search/](../circles-meili-search/). The implementing agent should delete that directory as part of step 1 (see backend.md). The Meilisearch design was reversed because (a) the user is on MongoDB Atlas everywhere — `mongodb+srv://...` — making Atlas Search a zero-infra option, and (b) the flattened multilingual `searchTerms` array used in the Meili plan bled across languages, surfacing "Pastor Alemán" rows when a user typed "pastor" with English UI active. Atlas Search lets us index the structured `labels.{locale}` and `aliases.{locale}` paths and scope every query to the user's locale.

## Goal

Upgrade the existing `GET /api/circles?q=` endpoint so users can find circles with **prefix-as-you-type** (`ger` → `german shepherd`) and **typo tolerance** (`shephard` → `shepherd`), with results **strictly scoped to the user's locale** — no cross-language matches, ever. The single Circle entity stays as it is today (one document per concept, with `labels: { en, es }` and `aliases: { en, es }`); cross-language identity is preserved.

The user-visible deltas:

- Endpoint shape: `PaginatedResponse<Circle>` — unchanged.
- Behavior: prefix match + typo tolerance, locale-scoped via a `?locale=` query param (with `Accept-Language` header fallback, defaulting to `en`).
- Code shape: `searchTerms` denormalization is removed; `buildSearchTerms`/`normalize` helpers and their tests are deleted; `searchPaginated` is rewritten as a `$search` aggregation; `fetchCirclesApi` gains a `locale` field.

## Surface area

- [x] Shared contract — see [shared.md](shared.md). Single edit: add `locale: z.enum(LOCALE_KEYS).optional()` to `circleSearchQuerySchema`.
- [x] Backend — see [backend.md](backend.md). Schema delta (drop `searchTerms`), service rewrite (`$search` aggregation), controller locale resolution, and the Atlas index JSON file.
- [x] Frontend — see [frontend.md](frontend.md). Pass `i18n.language` through `fetchCirclesApi`; update API tests.

## Execution order

The implementing agent ships in this order, running `pnpm lint && pnpm typecheck && pnpm test` from the repo root at the end of each step before moving on:

1. **Delete the superseded Meilisearch plan** — `rm -rf .claude/plans/circles-meili-search/`. This is just plan documentation, no code, but it documents an approach we explicitly reversed and should not be confusing future readers.
2. **Shared schema change** ([shared.md](shared.md)) — adds `locale` to `circleSearchQuerySchema`. Unblocks backend and frontend.
3. **Backend schema delta** — remove `searchTerms` from the Mongoose schema and remove the text index. Run typecheck and tests. The tests will fail at this point because `circles.service.ts` still references `buildSearchTerms`. That's expected — fix in the next step.
4. **Backend service rewrite** — drop the `buildSearchTerms` import and calls in `create()` / `update()`, rewrite `searchPaginated()` to use `$search`. Update `circles.service.spec.ts`.
5. **Backend controller locale resolution** — read locale from query param, then `Accept-Language` header, default `en`. Pass to service.
6. **Atlas index JSON file** — `backend/src/circles/atlas-search-index.json`. Manual paste into the Atlas console (see appendix below). The implementing agent **does not** push this programmatically.
7. **Frontend wire-up** ([frontend.md](frontend.md)) — extend `fetchCirclesApi`, update the page to source locale from `i18n.language`, update tests.
8. **Manual smoke** — start dev server, use the search in the admin page, verify prefix and typo work in both English and Spanish UI without bleeding across languages.

## Locked decisions (do not re-litigate)

- **Backend: MongoDB Atlas Search**, queried via the `$search` aggregation stage on the existing Mongoose connection. No SDK or external service.
- **Hosting: Atlas everywhere** (dev + prod). User confirmed `mongodb+srv://...`. No `$regex` fallback for non-Atlas environments.
- **Single circle entity.** No per-language documents. Cross-language identity preserved.
- **Search is locale-scoped.** Each query touches only `labels.{locale}` and `aliases.{locale}`. Cross-language matches are an explicit non-goal.
- **`searchTerms` field is removed entirely.** Atlas indexes the structured paths directly, so the denormalized array is dead weight. Drop it from the Mongoose schema, the service, the helpers, and the tests.
- **Index management: option (a) — manual one-time Atlas console setup.** The index definition lives in `backend/src/circles/atlas-search-index.json`. It is the source of truth; the Atlas console must be kept in sync. The implementing agent does **not** push this file programmatically.
- **Index name: `default`.** Atlas convention; the `$search` stage uses this name implicitly when `index` is omitted.
- **Locale resolution at the API boundary**: `?locale=` query param if provided, else `Accept-Language` first-tag, else `'en'`. Validate the resolved locale is in `LOCALE_KEYS` (`["en", "es"]`) — reject anything else.
- **Search query shape**: `compound.should` with three branches: (1) `autocomplete` on `labels.{locale}` (prefix on the canonical name), (2) `autocomplete` on `aliases.{locale}` (prefix on alternate names), (3) `text` with `fuzzy: { maxEdits: 1 }` on `labels.{locale}` (typo tolerance on the canonical name only — not on aliases, which are by definition variants and don't need fuzzy on top of fuzzy). Optional `compound.filter: [{ equals: { path: 'themeId', value: <ObjectId> } }]` when `themeId` is supplied.
- **Sort**: `{ score: { $meta: 'searchScore' }, popularity: -1 }` — relevance first, popularity tiebreaker.
- **Total count strategy**: a parallel `$searchMeta` stage in the same aggregation (Atlas's recommended way to get totals alongside `$search` results). Returns approximate counts at scale; for thousands of circles, exact for all practical purposes.
- **No new endpoint.** `/api/circles?q=` upgrades in place. Response shape unchanged.

## Appendix: Atlas Search console setup

This is the manual one-time step the file in step 6 documents. **Required once per environment** (dev cluster, prod cluster).

1. Open Atlas → your cluster → **Search** tab.
2. Click **Create Search Index**.
3. Choose **JSON Editor** (not the visual editor).
4. Database: the one your `MONGO_URI` points at. Collection: `circles`.
5. Index name: `default`.
6. Paste the contents of `backend/src/circles/atlas-search-index.json`.
7. **Save**. Atlas builds the index in the background. Status starts as `BUILDING`, transitions to `ACTIVE` (typically under a minute for a small collection).

After save, verify:

- Status is `ACTIVE` (not `STALE`, `FAILED`, or `BUILDING` indefinitely).
- Run a sample query in the **Atlas Data Explorer** (or `mongosh`):
  ```js
  db.circles.aggregate([
    { $search: { autocomplete: { query: "ger", path: "labels.en" } } },
    { $limit: 5 },
  ])
  ```
- If you get results, the index is wired up. If you get an error like `$search stage not allowed on this collection`, the index is not yet active.

When the schema changes (e.g., a new locale gets added to `LOCALE_KEYS`):

- Update `backend/src/circles/atlas-search-index.json`.
- Re-paste it into the Atlas console (overwrite the existing definition). Atlas will reindex automatically.
- Update the deploy runbook to remind operators to do this.

If the index gets out of sync or corrupted (rare): delete it in the console, recreate from the JSON file. Atlas reindexes from the source collection automatically — no separate "reindex" script is needed (this is the major operational win versus Meilisearch).

## Open questions

None — every decision is locked above. Hand [shared.md](shared.md), then [backend.md](backend.md), then [frontend.md](frontend.md) to an implementing agent.
