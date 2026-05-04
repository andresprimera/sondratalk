# Dashboard — Frontend Plan

**Prerequisite:** the shared contract from [overview.md](overview.md) is implemented and the backend endpoints from [backend.md](backend.md) are live (`GET /api/dashboard/summary` and `GET /api/dashboard/sales-timeseries`).

## File layout

**Add:**

- `frontend/src/lib/dashboard.ts` — API functions (`fetchDashboardSummaryApi`, `fetchSalesTimeseriesApi`).
- `frontend/src/lib/dashboard.spec.ts` — API function tests.
- `frontend/src/components/admin-dashboard.tsx` — admin role view (named export).
- `frontend/src/components/sales-person-dashboard.tsx` — sales-person role view (named export).
- `frontend/src/components/user-dashboard.tsx` — plain-user welcome view (named export).
- `frontend/src/components/dashboard-sales-chart.tsx` — read-only sales area chart (named export).

**Modify:**

- `frontend/src/pages/dashboard.tsx` — replace its body with a thin role-router that picks one of the three sub-components.
- `frontend/src/locales/en.json` and `frontend/src/locales/es.json` — add new translation keys.

**Delete (verified orphans — only `pages/dashboard.tsx` imports them):**

- `frontend/src/data.json`
- `frontend/src/components/chart-area-interactive.tsx`
- `frontend/src/components/data-table.tsx`

> Do not delete until **after** `pages/dashboard.tsx` has been rewritten and no longer imports them. Verify with:
> ```bash
> grep -rn "data.json\|chart-area-interactive\|data-table" frontend/src --include="*.ts" --include="*.tsx"
> ```
> Expected: zero matches once the rewrite is complete (other than the files being deleted).

**Reuse (do not modify):**

- `frontend/src/components/dashboard-card.tsx` — used for KPI cards on both admin and sales-person views. Already accepts `label`, `value`, `badge`, `trend`, `footerText`, `footerDescription`. Per CLAUDE.md: "Search before creating … Prefer modifying or extending an existing component over creating a new one."
- `frontend/src/components/ui/skeleton.tsx`, `card.tsx`, `table.tsx`, `toggle-group.tsx`, `select.tsx` — shadcn primitives.
- `frontend/src/hooks/use-auth.ts` — for `user.role`.

## Step 1 — API functions

**File:** `frontend/src/lib/dashboard.ts`

```ts
import {
  type DashboardRange,
  type DashboardSalesTimeseriesResponse,
  type DashboardSummaryResponse,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchDashboardSummaryApi(): Promise<DashboardSummaryResponse> {
  const res = await authFetch("/api/dashboard/summary")
  return res.json()
}

export async function fetchDashboardSalesTimeseriesApi(
  range: DashboardRange,
): Promise<DashboardSalesTimeseriesResponse> {
  const params = new URLSearchParams({ range })
  const res = await authFetch(`/api/dashboard/sales-timeseries?${params}`)
  return res.json()
}
```

> CLAUDE.md: "API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads, `create`, `update`, `remove`) with an `Api` suffix."
> CLAUDE.md: "Authenticated endpoints use `authFetch` — tokens are auto-attached and 401s trigger a silent refresh + retry. API functions should **never** accept an access token parameter."
> CLAUDE.md: "When adding a new feature, create a new `src/lib/<feature>.ts` file rather than adding functions to an existing file."

Reference: [frontend/src/lib/users.ts](frontend/src/lib/users.ts).

## Step 2 — API tests

**File:** `frontend/src/lib/dashboard.spec.ts`

Mock `@/lib/api` with `vi.mock("@/lib/api")` and `vi.mocked(authFetch)`. Two tests, one per function:

1. **`fetchDashboardSummaryApi`** — calls `authFetch("/api/dashboard/summary")` (no body) and returns the parsed JSON.
2. **`fetchDashboardSalesTimeseriesApi`** — when called with `"30d"`, calls `authFetch("/api/dashboard/sales-timeseries?range=30d")` and returns the parsed JSON. (Add a second `it` for `"7d"` to confirm the param is interpolated, not hard-coded.)

> CLAUDE.md: "API functions (`src/lib/`): Correct URL, HTTP method, request body, and response parsing. One test per function."
> CLAUDE.md: "For feature API files (`auth.ts`, `users.ts`, `profile.ts`), mock the `@/lib/api` module with `vi.mock(\"@/lib/api\")` and use `vi.mocked(authFetch)` / `vi.mocked(publicFetch)` to control behavior."

Reference: [frontend/src/lib/users.spec.ts](frontend/src/lib/users.spec.ts).

## Step 3 — Page (role-router)

**File:** `frontend/src/pages/dashboard.tsx`

Replace the entire file with:

```tsx
import { useAuth } from "@/hooks/use-auth"
import { AdminDashboard } from "@/components/admin-dashboard"
import { SalesPersonDashboard } from "@/components/sales-person-dashboard"
import { UserDashboard } from "@/components/user-dashboard"

export default function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null // ProtectedRoute already guarantees a user; this is belt-and-suspenders for type narrowing
  if (user.role === "admin") return <AdminDashboard />
  if (user.role === "salesPerson") return <SalesPersonDashboard />
  return <UserDashboard />
}
```

> CLAUDE.md: "default exports outside `pages/` and Vite entry points" are banned — keep this file's `export default`.
> CLAUDE.md: "shadcn/ui is base-ui based — components use the `render` prop for composition, not `asChild`." (Not needed in this file but a reminder for the sub-components.)

This page no longer imports `chart-area-interactive`, `data-table`, or `data.json`. Once the new sub-components exist and tests pass, those three files can be deleted.

## Step 4 — Admin dashboard component

**File:** `frontend/src/components/admin-dashboard.tsx`

Sections, top to bottom:

1. **KPI grid** — uses [components/dashboard-card.tsx](frontend/src/components/dashboard-card.tsx). One card per currency for revenue, plus three more cards (sale count w/ delta, active clients, active sales people).
2. **`<DashboardSalesChart />`** — full width below the KPI grid.
3. **Top sales people table** — plain shadcn `<Table>` (NOT the deleted `<DataTable />`), columns: rank, sales person name, currency, sale count, total amount, commission %, commission amount.

### Data fetching

```tsx
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ["dashboard-summary"],
  queryFn: fetchDashboardSummaryApi,
})
```

Then narrow with `if (data?.role !== "admin") return null` after handling loading/error — the discriminated union keeps the rest of the function strongly typed.

> CLAUDE.md: "Query keys are arrays — resource name first, then params: `[\"users\", page, pageSize]`."
> CLAUDE.md: "Server state → React Query. All data from the API lives in the query cache."

### Loading / error / empty

- **Loading:** Render a `<Skeleton />` grid matching the four-card KPI layout, plus a `Skeleton` block where the chart will render and a `Skeleton` table.
  > CLAUDE.md: "Loading: Show the shadcn `Skeleton` component … matching the shape of the expected content — not bare 'Loading...' text. For tables, render skeleton rows."
- **Error:** Inline error block with `t("Failed to load dashboard")` + a `Button onClick={() => refetch()}` showing `t("Retry")`. Do NOT use `toast.error()` for this query.
  > CLAUDE.md: "Use `toast.error()` only for mutation failures, not for query errors (the user didn't trigger those)."
- **Empty:** When `revenueCurrent.length === 0` and `saleCountCurrent === 0`, render an empty-state message inside the table area: `t("No sales recorded this month yet.")` with a centered icon (use `BarChart3Icon` from `lucide-react`).
  > CLAUDE.md: "Empty: When data loads successfully but the list is empty, show a descriptive empty state — not just a blank area."

### KPI cards

For each currency in `revenueCurrent`, render one `<DashboardCard>`:

```tsx
{data.revenueCurrent.map((row) => {
  const previous = data.revenuePrevious.find((p) => p.currency === row.currency)?.total ?? 0
  const deltaPct = previous === 0
    ? null
    : ((row.total - previous) / previous) * 100
  return (
    <DashboardCard
      key={row.currency}
      label={t("Total Revenue ({{currency}})", { currency: row.currency })}
      value={new Intl.NumberFormat(i18n.language, {
        style: "currency",
        currency: row.currency,
      }).format(row.total)}
      badge={deltaPct === null ? "—" : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
      trend={deltaPct !== null && deltaPct < 0 ? "down" : "up"}
      footerText={t("Current month")}
      footerDescription={t("vs previous month")}
    />
  )
})}
```

Three additional cards: sale count (delta vs prev month), active clients (no delta — use `"—"` as badge), active sales people (no delta).

> CLAUDE.md: "Use `i18n.language` instead of hardcoded `\"en-US\"` in `toLocaleDateString()`." — same applies to `Intl.NumberFormat`.

### Top-sales-people table

A plain shadcn `<Table>` mirroring the structure used in [pages/users.tsx](frontend/src/pages/users.tsx). No drag-handle, no checkbox column, no inline editing, no drawer. Columns: rank (1–10), name, currency (`<Badge variant="outline">`), sale count, total amount (currency-formatted), commission % (display-only), commission amount (currency-formatted).

If `topSalesPeople.length === 0`, render a single `<TableRow>` with one cell spanning all columns: `t("No sales recorded this month yet.")`.

## Step 5 — Sales-person dashboard component

**File:** `frontend/src/components/sales-person-dashboard.tsx`

Same layout pattern as admin (KPI grid → chart → activity table), but:

- **KPI cards:** revenue per currency (with delta), sale count (with delta), my clients count, projected commission (one card per currency from `projectedCommission`).
- **Chart:** same `<DashboardSalesChart />` component — the backend already scopes to the current sales person.
- **Activity table:** the **last 10 sales** from `data.recentSales`. Columns: sale number, date (formatted with `toLocaleDateString(i18n.language)`), client name, total amount (currency-formatted), currency badge.

Same loading / error / empty handling as admin. Empty state for the recent-sales table: `t("No sales yet.")`.

After narrowing with `data?.role !== "salesPerson"`, the discriminated union gives full type safety on the rest.

## Step 6 — User dashboard component

**File:** `frontend/src/components/user-dashboard.tsx`

No data fetching. Just a centered shadcn `<Card>`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "react-i18next"

export function UserDashboard() {
  const { t } = useTranslation()
  return (
    <div className="flex justify-center px-4 py-8 lg:px-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("Welcome")}</CardTitle>
          <CardDescription>
            {t("Your account is active. Contact an administrator to be assigned a role with access to platform features.")}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
```

> CLAUDE.md: "Use shadcn/ui for everything." / "Tailwind CSS only." / "Translation keys are the exact English string."

## Step 7 — Sales chart component

**File:** `frontend/src/components/dashboard-sales-chart.tsx`

Replace the deleted [chart-area-interactive.tsx](frontend/src/components/chart-area-interactive.tsx) with a slimmer version that reads from the API. Keep the toggle-group UI for `7d / 30d / 90d` (the visual is good — only the data source changes).

```tsx
import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { i18n } from "@/lib/i18n"
import { fetchDashboardSalesTimeseriesApi } from "@/lib/dashboard"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { DashboardRange } from "@base-dashboard/shared"

const chartConfig = {
  total: {
    label: "Sales",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function DashboardSalesChart() {
  const { t } = useTranslation()
  const [range, setRange] = React.useState<DashboardRange>("30d")
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-timeseries", range],
    queryFn: () => fetchDashboardSalesTimeseriesApi(range),
    placeholderData: (prev) => prev,
  })

  // ... render Card with toggle in CardAction; show Skeleton on isLoading,
  //     inline error w/ Retry button on isError, empty state when points.every(p => p.total === 0),
  //     or the AreaChart wired to data.points
}
```

Key points for the implementing agent:

- **Query key:** `["dashboard-timeseries", range]`. CLAUDE.md: "Query keys are arrays — resource name first, then params."
- **Stale-data UX:** Use `placeholderData: (prev) => prev` so changing the toggle doesn't flash a loading state. CLAUDE.md: "Use `placeholderData: keepPreviousData` for paginated queries to avoid flash on page change." — same principle for parameterized queries.
- **Subtitle:** include `t("Showing daily sales (USD only)")` so the single-currency caveat is visible to the user.
- **X-axis tick formatter:** parse the `YYYY-MM-DD` string with `new Date(point.date + "T00:00:00Z")` so it's read as UTC, then `.toLocaleDateString(i18n.language, { month: "short", day: "numeric" })`.
- **Empty state:** if `points.every((p) => p.total === 0)`, render `t("No sales in this range.")` centered inside the card content area instead of an empty chart.
- **No inline `style` props** anywhere. CLAUDE.md: ESLint bans inline `style` (use Tailwind via `className`).

## Step 8 — Routing & sidebar (no changes needed)

- The `/dashboard` index route in [frontend/src/router.tsx](frontend/src/router.tsx) already wraps `DashboardPage` in `<ProtectedRoute>` + `<DashboardLayout>`. No change.
- The sidebar already has a "Dashboard" entry for all three roles in [components/app-sidebar.tsx](frontend/src/components/app-sidebar.tsx). No change.

## Step 9 — i18n strings

Add every new string to **both** `frontend/src/locales/en.json` and `frontend/src/locales/es.json`.

> CLAUDE.md: "When adding new UI strings: Add the key to both `en.json` and `es.json`, then use `t('key')` in the component."
> CLAUDE.md: "Translation keys are the exact English string — flat structure, no nested/semantic keys."

Strings to add (English keys; Spanish values listed for reference):

| Key (English) | Spanish |
|---|---|
| `Welcome` | `Bienvenido` |
| `Your account is active. Contact an administrator to be assigned a role with access to platform features.` | `Tu cuenta está activa. Contacta a un administrador para que te asigne un rol con acceso a las funciones de la plataforma.` |
| `Total Revenue ({{currency}})` | `Ingresos Totales ({{currency}})` |
| `Current month` | `Mes actual` |
| `vs previous month` | `vs mes anterior` |
| `Sale Count` | `Cantidad de Ventas` |
| `Active Clients` | `Clientes Activos` |
| `Active Sales People` | `Vendedores Activos` |
| `My Clients` | `Mis Clientes` |
| `Projected Commission ({{currency}})` | `Comisión Proyectada ({{currency}})` |
| `Top Sales People This Month` | `Mejores Vendedores del Mes` |
| `My Recent Sales` | `Mis Ventas Recientes` |
| `Sales Over Time` | `Ventas en el Tiempo` |
| `Showing daily sales (USD only)` | `Mostrando ventas diarias (solo USD)` |
| `Last 7 days` | `Últimos 7 días` (already exists — reuse) |
| `Last 30 days` | `Últimos 30 días` (already exists — reuse) |
| `Last 3 months` | `Últimos 3 meses` (already exists — reuse) |
| `No sales recorded this month yet.` | `Aún no hay ventas registradas este mes.` |
| `No sales yet.` | `Aún no hay ventas.` |
| `No sales in this range.` | `No hay ventas en este rango.` |
| `Failed to load dashboard` | `No se pudo cargar el panel` |
| `Retry` | `Reintentar` (check if already present; reuse if so) |
| `Rank` | `Posición` |
| `Sales Person` | `Vendedor` |
| `Currency` | `Moneda` |
| `Sale #` | `Venta #` |
| `Date` | `Fecha` |
| `Client` | `Cliente` |
| `Amount` | `Monto` |
| `Commission %` | `Comisión %` |
| `Commission` | `Comisión` |

Before adding, grep both locale files for each English string — several (`Last 7 days`, `Last 30 days`, `Last 3 months`, `Retry`, `Date`, `Client`, `Amount`) likely already exist from other features and must not be duplicated.

## Step 10 — Tests

Required:

- **`frontend/src/lib/dashboard.spec.ts`** — covered in Step 2.

NOT required (per CLAUDE.md "What NOT to Test"):

- The `<AdminDashboard>`, `<SalesPersonDashboard>`, `<UserDashboard>`, `<DashboardSalesChart>` components are pages/page-shaped — they wire query data into UI. Logic-free composition. CLAUDE.md: "Pages that only wire data to UI — if a page just fetches with `useQuery` and renders a table, the logic lives in the hook/service layer. Test those instead."
- The `<DashboardCard>` is unchanged.
- `<UserDashboard>` is static markup. CLAUDE.md: "Static markup — don't test that a heading says 'Dashboard'. Test behavior, not content."

## Step 11 — Cleanup

After everything compiles and tests pass:

```bash
rm frontend/src/data.json
rm frontend/src/components/chart-area-interactive.tsx
rm frontend/src/components/data-table.tsx
```

Run the verification grep again to confirm zero stale imports:

```bash
grep -rn "data.json\|chart-area-interactive\|data-table" frontend/src --include="*.ts" --include="*.tsx"
```

Expected: zero matches.

> CLAUDE.md: "Avoid backwards-compatibility hacks like renaming unused _vars, re-exporting types, adding `// removed` comments for removed code, etc. If you are certain that something is unused, you can delete it completely."
> CLAUDE.md: "**No commented-out code.** Delete it; git has history."

## Step 12 — Verify

- `pnpm --filter base-dashboard-frontend lint`
- `pnpm --filter base-dashboard-frontend test`
- `pnpm --filter base-dashboard-frontend build`
- Start the dev server (`pnpm dev` from repo root) and exercise the feature in a browser:
  1. Log in as an **admin** → confirm KPI cards show current/previous-month values, the chart renders with the correct toggle behavior, the top-sales-people table populates.
  2. Log in as a **sales person** → confirm KPIs are scoped to their own sales, recent-sales table shows only their sales, projected commission card matches the value on `/dashboard/commissions` for the same month.
  3. Log in as a **plain `user`** → confirm only the welcome card renders and the network panel shows zero calls to `/api/dashboard/*` (the user dashboard does no fetches).
  4. Toggle the chart between 7d / 30d / 90d and confirm previous data stays on screen during the refetch (no flash to skeleton).
  5. Switch the language toggle from English to Spanish and confirm every dashboard string translates.

> CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete. Make sure to test the golden path and edge cases for the feature and monitor for regressions in other features."
