# Commissions — Frontend Plan

**Prerequisite:** the shared contract from [overview.md](overview.md) is implemented and the backend endpoint `GET /api/commissions/report?from=&to=` from [backend.md](backend.md) is live and admin-gated.

## File layout

- `frontend/src/lib/commissions.ts` — API function.
- `frontend/src/lib/commissions.spec.ts` — API function test.
- `frontend/src/pages/commissions.tsx` — page component (default export).
- `frontend/src/components/app-sidebar.tsx` — append a sidebar entry to the admin nav.
- `frontend/src/router.tsx` — register the route under `<AdminRoute>`.
- `frontend/src/locales/en.json` and `frontend/src/locales/es.json` — new strings (full list in Step 6).

> CLAUDE.md: "default exports outside `pages/` and Vite entry points" are banned by ESLint — the page is a default export, the API file and component module use named exports.

## Step 1 — API function

**File:** `frontend/src/lib/commissions.ts`

```ts
import {
  type CommissionReportResponse,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchCommissionReportApi(
  from: string,
  to: string,
): Promise<CommissionReportResponse> {
  const params = new URLSearchParams({ from, to })
  const res = await authFetch(`/api/commissions/report?${params}`)
  return res.json()
}
```

`from` / `to` are ISO datetime strings (e.g. `"2026-04-01T00:00:00.000Z"`). The page is responsible for producing them.

> CLAUDE.md: "Authenticated endpoints use `authFetch` — tokens are auto-attached and 401s trigger a silent refresh + retry. API functions should **never** accept an access token parameter."
> CLAUDE.md: "API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads, `create`, `update`, `remove`) with an `Api` suffix. E.g., `fetchUsersApi()`."
> CLAUDE.md: "When adding a new feature, create a new `src/lib/<feature>.ts` file rather than adding functions to an existing file."

**Reference:** [frontend/src/lib/users.ts](frontend/src/lib/users.ts) for the `authFetch` + URLSearchParams pattern.

## Step 2 — API test

**File:** `frontend/src/lib/commissions.spec.ts`

Mock `@/lib/api` with `vi.mock("@/lib/api")` and assert one test:

- `fetchCommissionReportApi("2026-04-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z")` calls `authFetch("/api/commissions/report?from=2026-04-01T00%3A00%3A00.000Z&to=2026-05-01T00%3A00%3A00.000Z")` (or assert via `expect.stringContaining("from=")` and `expect.stringContaining("to=")` to be tolerant of `URLSearchParams` ordering) and returns the parsed JSON unchanged.

> CLAUDE.md: "API functions (`src/lib/`): Correct URL, HTTP method, request body, and response parsing. One test per function."
> CLAUDE.md: "For feature API files (`auth.ts`, `users.ts`, `profile.ts`), mock the `@/lib/api` module with `vi.mock(\"@/lib/api\")` and use `vi.mocked(authFetch)` / `vi.mocked(publicFetch)` to control behavior."

**Reference:** [frontend/src/lib/users.spec.ts](frontend/src/lib/users.spec.ts).

## Step 3 — Page component

**File:** `frontend/src/pages/commissions.tsx`

Default export: `export default function CommissionsPage()`.

### Layout

Mirror [frontend/src/pages/users.tsx](frontend/src/pages/users.tsx) and [frontend/src/pages/sales.tsx](frontend/src/pages/sales.tsx) — heading + description, then a date-range filter row, then the report `Table`. **No `Card`**, no decoration — this is an internal report page.

### Date range state

Default to the current calendar month, computed once with `useMemo`:

```tsx
function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: from.toISOString(), to: to.toISOString() }
}
```

Store the picker values as **date strings (`YYYY-MM-DD`)** in `useState` for editing convenience, and convert to ISO datetime on submit. The picker uses two `<Input type="date">` (shadcn `Input`). On submit, convert with `new Date(dateStr).toISOString()` for `from`, and for `to` add one day so the user's "to" is interpreted as inclusive in the UX while staying half-open on the wire (`from <= createdAt < to`).

> CLAUDE.md: "**Date & Time:** Use native `Date` and `Intl` APIs."
> CLAUDE.md: "**Local UI state → `useState`** in the component that owns it. Pagination controls, form input, modal open/closed, selected tabs — these are local to the component."

### Apply button

A simple `Button` labelled `t("Apply")` updates a separate `appliedRange` state used as the React Query key. This decouples typing from refetching.

### Query

```ts
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ["commissions", "report", appliedRange.from, appliedRange.to],
  queryFn: () =>
    fetchCommissionReportApi(appliedRange.from, appliedRange.to),
})
```

> CLAUDE.md: "**Query keys are arrays** — resource name first, then params: `[\"users\", page, pageSize]`, `[\"users\", userId]`. Never use plain strings."
> CLAUDE.md: "**Key naming matches the API resource** — `\"users\"` for `/api/users`, `\"projects\"` for `/api/projects`. No prefixes, no camelCase variations." — we use `"commissions"` (matches `/api/commissions`) and `"report"` as the second key segment.
> CLAUDE.md: "**Server state → React Query.** All data from the API lives in the query cache. No duplicating server data into local state."

### States

- **Loading:** render a `Skeleton` table with ~5 rows matching the column count (Sales person / Currency / Total sales / Commission % / Commission amount = 5 columns).
  > CLAUDE.md: "**Loading:** Show the shadcn `Skeleton` component matching the shape of the expected content — not bare 'Loading...' text. For tables, render skeleton rows."
- **Error:** centered `AlertCircleIcon` + `t(error.message) || t("Failed to load commission report.")` + retry `Button` calling `refetch()`.
  > CLAUDE.md: "Use `toast.error()` only for mutation failures, not for query errors (the user didn't trigger those)."
- **Empty:** when `data.rows.length === 0`, show a centered "No commissions in this period." message inside the table body (use the existing pattern from [users.tsx](frontend/src/pages/users.tsx) — `<TableCell colSpan={5} className="h-24 text-center">`).

### Table columns

| Column header (i18n key) | Cell value |
|---|---|
| `t("Sales Person")` | `row.salesPersonName` |
| `t("Currency")` | `row.currency` |
| `t("Total Sales")` | `formatAmount(row.totalAmount, row.currency)` |
| `t("Commission %")` | `${row.commissionPercentage}%` |
| `t("Commission Amount")` | `formatAmount(row.commissionAmount, row.currency)` |

Reuse the same `formatAmount` helper that [sales.tsx](frontend/src/pages/sales.tsx) already defines:

```tsx
function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat(i18n.language, { style: "currency", currency })
    .format(value)
}
```

> CLAUDE.md: "**Locale-aware formatting:** Use `toLocaleDateString(i18n.language)` on the frontend, never hardcoded `\"en-US\"`."

> The helper is small enough that copying it into `commissions.tsx` is fine — only extract a shared util if a third page needs it.
> CLAUDE.md: "Three similar lines is better than a premature abstraction."

### Components allowed

- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`.
- `Input` from `@/components/ui/input` (for the two date pickers).
- `Button` from `@/components/ui/button`.
- `Skeleton` from `@/components/ui/skeleton`.
- `AlertCircleIcon` from `lucide-react`.
- `i18n` from `@/lib/i18n` (for the language passed to `Intl.NumberFormat`).
- `useTranslation` from `react-i18next`.

> CLAUDE.md: "**Use shadcn/ui for everything.** Only build custom components when shadcn has no equivalent."
> CLAUDE.md: "**Search before creating.** Before building any new component, search `components/` for an existing one that already does what you need."
> CLAUDE.md: "Use **lucide-react**. Import specific icons by name."
> CLAUDE.md: "**Tailwind CSS only.** No CSS modules or styled-components." — all spacing/layout via `className` Tailwind utilities, no inline `style` prop.

### Pattern reference

Read these before writing:

- [frontend/src/pages/users.tsx](frontend/src/pages/users.tsx) — heading, table layout, skeleton/error/empty states, query setup.
- [frontend/src/pages/sales.tsx](frontend/src/pages/sales.tsx) — `formatAmount` helper, `i18n.language` usage.

## Step 4 — Routing

**File:** `frontend/src/router.tsx`

Add the import:

```tsx
import CommissionsPage from "@/pages/commissions"
```

Add a new child of the `/dashboard` route, alongside the other admin-only entries (e.g. between `users` and `products`):

```tsx
{
  path: "commissions",
  element: (
    <AdminRoute>
      <CommissionsPage />
    </AdminRoute>
  ),
},
```

> CLAUDE.md: "Admin-only routes (e.g., `/dashboard/users`) wrap with `<AdminRoute>` which checks `user.role === \"admin\"`."

## Step 5 — Sidebar

**File:** `frontend/src/components/app-sidebar.tsx`

Inside `adminNavMain` (admin-only — do **not** add it to `salesPersonNavMain` or `userNavMain`), add a new entry. Use `PercentIcon` from `lucide-react`:

```tsx
import { ..., PercentIcon } from "lucide-react"

// inside adminNavMain, near the bottom (after Sales is fine):
{ title: t("Commissions"), url: "/dashboard/commissions", icon: <PercentIcon /> },
```

> CLAUDE.md (lint-enforced): "icon libs other than `lucide-react` (`react-icons`, `@heroicons/react`, `phosphor-react`, `@iconify/*`)" are banned.

## Step 6 — i18n strings

Every visible string must be wrapped in `t("…")` with the **exact English string as the key**. Add the following keys to **both** `frontend/src/locales/en.json` and `frontend/src/locales/es.json`. In `en.json` value = key; in `es.json` use the Spanish translations shown below.

> CLAUDE.md: "Translation keys are the exact English string — flat structure, no nested/semantic keys."
> CLAUDE.md: "When adding new UI strings: Add the key to both `en.json` and `es.json`, then use `t(\"key\")` in the component."

| Key (English) | Spanish (es.json) |
|---|---|
| `"Commissions"` | `"Comisiones"` |
| `"View per-sales-person commissions for a date range."` | `"Ver comisiones por vendedor para un rango de fechas."` |
| `"From"` | `"Desde"` |
| `"To"` | `"Hasta"` |
| `"Apply"` | `"Aplicar"` |
| `"Sales Person"` | `"Vendedor"` *(already exists in es.json — do not duplicate)* |
| `"Currency"` | `"Moneda"` |
| `"Total Sales"` | `"Ventas totales"` |
| `"Commission %"` | `"Comisión %"` *(already exists — do not duplicate)* |
| `"Commission Amount"` | `"Monto de comisión"` |
| `"No commissions in this period."` | `"No hay comisiones en este período."` |
| `"Failed to load commission report."` | `"Error al cargar el reporte de comisiones."` |
| `"Try again"` | `"Reintentar"` *(already exists — do not duplicate)* |

**Before editing the locale files, grep both** to confirm which keys already exist (`"Sales Person"`, `"Commission %"`, `"Try again"` were added in earlier work) so you don't add duplicate JSON keys (which is a syntax error / silent overwrite).

```bash
grep -n '"Sales Person"\|"Commission %"\|"Try again"' frontend/src/locales/en.json
```

## Step 7 — Tests

**File:** `frontend/src/lib/commissions.spec.ts` — covered in Step 2.

**No page test.** The page only wires `useQuery` to a table with no conditional UI logic worth covering at the test layer.

> CLAUDE.md: "**Pages that only wire data to UI** — if a page just fetches with `useQuery` and renders a table, the logic lives in the hook/service layer. Test those instead."

## Step 8 — Verify

Run from the repo root:

- `pnpm --filter frontend lint`
- `pnpm --filter frontend test`
- `pnpm --filter frontend typecheck`
- `pnpm --filter frontend build`

> CLAUDE.md: "**Build check:** Run `pnpm run build` in both packages before considering work complete."

Then start `pnpm dev` and exercise the page in a browser as an admin user:

1. Land on `/dashboard/commissions` from the sidebar.
2. Verify the default range covers the current month.
3. Confirm the table renders rows for each sales person × currency.
4. Change the `From` / `To` inputs, click `Apply`, and confirm the table updates.
5. Pick an empty range and confirm the empty state renders.
6. Log in as a non-admin and confirm `/dashboard/commissions` redirects to `/dashboard`.

> CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete. Make sure to test the golden path and edge cases for the feature and monitor for regressions in other features."
