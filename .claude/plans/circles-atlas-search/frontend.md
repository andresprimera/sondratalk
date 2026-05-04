# Atlas Search for Circles — Frontend Plan

**Prerequisite:** [shared.md](shared.md) and [backend.md](backend.md) are complete; the backend is responding to `?locale=...` and the Atlas Search index is `ACTIVE` in the dev cluster.

**Reference files to mirror:**

- [frontend/src/lib/circles.ts](frontend/src/lib/circles.ts) — current `fetchCirclesApi` signature.
- [frontend/src/lib/circles.spec.ts](frontend/src/lib/circles.spec.ts) — Vitest pattern that this plan extends.
- [frontend/src/pages/circles.tsx](frontend/src/pages/circles.tsx) — the admin page that consumes the API.
- [frontend/src/lib/i18n.ts](frontend/src/lib/i18n.ts) — i18next setup; `i18n.language` is the canonical "user's current locale" value.

**Conventions that apply (CLAUDE.md):**

> "Authenticated endpoints use `authFetch` … API functions should **never** accept an access token parameter."

> "API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads, `create`, `update`, `remove`) with an `Api` suffix."

> "Query keys are arrays — resource name first, then params: `['users', page, pageSize]`, `['users', userId]`."

> "Use `placeholderData: keepPreviousData` for paginated queries to avoid flash on page change."

> "When adding new UI strings: Add the key to both `en.json` and `es.json`, then use `t('key')` in the component."

The lint baseline (no `any`, no `as`, no relative parent imports, etc.) is auto-enforced by `pnpm --filter frontend lint`. Plan does not restate every rule.

---

## Step 1 — Extend `fetchCirclesApi` to pass `locale`

**File to modify:** `frontend/src/lib/circles.ts`

`fetchCirclesApi` already takes a single `query: CircleSearchQuery` object. With the shared schema update from [shared.md](shared.md), `CircleSearchQuery` now includes `locale?: 'en' | 'es'`. The API function appends it to the URL search params when present.

**Before**:

```ts
export async function fetchCirclesApi(
  query: CircleSearchQuery,
): Promise<PaginatedResponse<Circle>> {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.themeId) params.set("themeId", query.themeId)
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  const res = await authFetch(`/api/circles?${params}`)
  return res.json()
}
```

**After**:

```ts
export async function fetchCirclesApi(
  query: CircleSearchQuery,
): Promise<PaginatedResponse<Circle>> {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.themeId) params.set("themeId", query.themeId)
  if (query.locale) params.set("locale", query.locale)
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  const res = await authFetch(`/api/circles?${params}`)
  return res.json()
}
```

The other API functions (`fetchCircleByIdApi`, `createCircleApi`, etc.) are unchanged.

> CLAUDE.md: "Authenticated endpoints use `authFetch` — tokens are auto-attached and 401s trigger a silent refresh + retry. API functions should **never** accept an access token parameter."

---

## Step 2 — Update `circles.spec.ts` to cover `locale`

**File to modify:** `frontend/src/lib/circles.spec.ts`

The existing four `fetchCirclesApi` test cases assert URL shape for various combinations of `q` / `themeId`. Update each to optionally include `locale`, and add **two new cases** specifically covering the locale param.

### 2a — Update existing cases to thread `locale: undefined`

For each of the four existing cases (`includes only page and limit when no filters`, `includes q when provided`, etc.), the call sites currently look like:

```ts
await fetchCirclesApi({ page: 1, limit: 10 })
await fetchCirclesApi({ q: "pastor", page: 1, limit: 10 })
await fetchCirclesApi({ themeId: "t1", page: 1, limit: 10 })
await fetchCirclesApi({ q: "gsd", themeId: "t1", page: 2, limit: 20 })
```

Leave them as-is — `locale` is optional and the test verifies the URL does **not** contain `locale=` when it's omitted. Each existing assertion is already exact (`expect(authFetch).toHaveBeenCalledWith("/api/circles?page=1&limit=10")`), which means accidentally adding `locale=` would fail those tests. Good — those assertions don't need changing.

### 2b — Add two new cases

After the existing `fetchCirclesApi` `describe` block (or inside it, at the bottom), add:

```ts
it("includes locale when provided", async () => {
  vi.mocked(authFetch).mockResolvedValue(
    mockJsonResponse({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    }),
  )

  await fetchCirclesApi({ locale: "es", page: 1, limit: 10 })

  expect(authFetch).toHaveBeenCalledWith(
    "/api/circles?locale=es&page=1&limit=10",
  )
})

it("includes q, themeId, and locale together when all provided", async () => {
  vi.mocked(authFetch).mockResolvedValue(
    mockJsonResponse({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    }),
  )

  await fetchCirclesApi({
    q: "ger",
    themeId: "t1",
    locale: "en",
    page: 1,
    limit: 10,
  })

  expect(authFetch).toHaveBeenCalledWith(
    "/api/circles?q=ger&themeId=t1&locale=en&page=1&limit=10",
  )
})
```

The URL ordering matches the `params.set` order in step 1 (`q` → `themeId` → `locale` → `page` → `limit`). Keep the order stable so the tests don't break if `URLSearchParams` rearranges them — `URLSearchParams` preserves insertion order in modern browsers and Node, which is what the tests rely on.

> CLAUDE.md: "API functions (`src/lib/`): Correct URL, HTTP method, request body, and response parsing. One test per function."

---

## Step 3 — Source `locale` from `i18n.language` in the page

**File to modify:** `frontend/src/pages/circles.tsx`

The page already calls `useTranslation()` for `t(...)`. Pull `i18n` from the same hook to access the current language, then thread it through the React Query key and the `fetchCirclesApi` call.

### 3a — Destructure `i18n` from `useTranslation`

**Before** (top of the component):

```tsx
const { t } = useTranslation()
```

**After**:

```tsx
const { t, i18n } = useTranslation()
```

### 3b — Compute the resolved locale

Right below the existing `useState` calls, add a memoized locale value. `i18n.language` can return either `"en"` or `"en-US"` depending on detector results — narrow it to the supported set:

```tsx
const locale: "en" | "es" =
  i18n.language?.split("-")[0] === "es" ? "es" : "en"
```

This mirrors the backend's locale resolver (split on `-`, take the primary subtag, fallback to `en`). For two supported locales it's overkill to import a helper; inline is fine. When a third locale gets added, factor this into a `lib/locale.ts` helper.

### 3c — Add `locale` to the React Query key and the API call

**Before**:

```tsx
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: [
    "circles",
    { q: debouncedQ, themeId, page, pageSize },
  ] as const,
  queryFn: () =>
    fetchCirclesApi({
      q: debouncedQ || undefined,
      themeId,
      page,
      limit: pageSize,
    }),
  placeholderData: keepPreviousData,
})
```

**After**:

```tsx
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: [
    "circles",
    { q: debouncedQ, themeId, locale, page, pageSize },
  ] as const,
  queryFn: () =>
    fetchCirclesApi({
      q: debouncedQ || undefined,
      themeId,
      locale,
      page,
      limit: pageSize,
    }),
  placeholderData: keepPreviousData,
})
```

Including `locale` in the query key ensures React Query re-fetches when the user toggles UI language — otherwise stale results from the previous locale would show until the cache expires.

> CLAUDE.md: "Query keys are arrays — resource name first, then params: `['users', page, pageSize]`, `['users', userId]`."

> CLAUDE.md: "Use `placeholderData: keepPreviousData` for paginated queries to avoid flash on page change."

---

## Step 4 — No new i18n strings

This slice does not introduce new user-visible strings. The `locale` value is plumbing, not display. No additions to `en.json` or `es.json`.

---

## Step 5 — Verify

```sh
pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm --filter frontend test
pnpm --filter frontend build
```

All four must pass.

### Manual smoke (required)

The backend's manual smoke (in [backend.md](backend.md) step 8) verifies the API contract; this verifies the page wiring.

1. Start the dev server (`pnpm dev` from repo root).
2. Log in as admin.
3. Visit `/dashboard/circles`.
4. With UI in English, type `ger` in the search box. Verify the german-shepherd row appears (prefix match, English locale).
5. Type `shephard` (typo). Verify the row still appears.
6. Type `pastor`. Verify **zero results** — English UI should not surface Spanish-only matches.
7. Switch UI to Spanish (language toggle in the header).
8. Type `pastor`. Verify the row appears (Spanish label match).
9. Type `ger`. Verify zero results — Spanish UI should not surface English-only matches.
10. Open browser DevTools → Network tab. Inspect the `/api/circles?...` request URL on each search. Confirm the URL includes `locale=en` or `locale=es` matching the UI state.

> CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete."

> CLAUDE.md: "Make sure to test the golden path and edge cases for the feature and monitor for regressions in other features."

If any of the cross-language tests (steps 6 or 9) leak — i.e., return results from the other locale — there's a backend-side issue with the `path:` interpolation. Debug before reporting the slice complete.

---

## What this slice ships

- `fetchCirclesApi` accepts and forwards `locale`.
- The admin circles page sources locale from `i18n.language` and re-fetches on language toggle.
- `lib/circles.spec.ts` covers `locale` in the URL contract.

No new UI components, no new strings, no new routes. The frontend delta is small but mandatory for the locale-scoped search to actually work end-to-end.
