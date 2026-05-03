# Dashboard

## Goal

The `/dashboard` index page currently shows hardcoded KPIs ([components/section-cards.tsx](frontend/src/components/section-cards.tsx)), a fake area chart with two years of made-up "desktop/mobile" data ([components/chart-area-interactive.tsx](frontend/src/components/chart-area-interactive.tsx)), and a 600-line dnd-enabled "outline" table from a shadcn demo ([components/data-table.tsx](frontend/src/components/data-table.tsx)) reading [data.json](frontend/src/data.json). All of it is dummy.

After this lands, an admin opening `/dashboard` sees real per-currency revenue, sale count delta vs last month, total client count, active sales-people count, a real sales-over-time area chart, and the top 10 sales people by revenue this month. A sales person opening the same URL sees their own per-currency revenue, sale count delta, client count, projected commission, their own sales-over-time chart, and their last 10 sales. A plain `user` (newly signed up, awaiting role assignment) sees a minimal welcome card. No drilldown, no exports, no real-time updates, no FX conversion — exactly mirroring the simplicity discipline used by [commissions.service.ts](backend/src/commissions/commissions.service.ts).

## Surface area

- [ ] Shared contract — `shared/src/schemas/dashboard.ts`
- [ ] Backend — see [backend.md](backend.md)
- [ ] Frontend — see [frontend.md](frontend.md)

## Execution order

1. **Shared first.** Add schemas and types in [shared/src/schemas/dashboard.ts](shared/src/schemas/dashboard.ts) and re-export from [shared/src/index.ts](shared/src/index.ts).
   > CLAUDE.md: "When adding a new feature, define the schemas and types in shared **first**, then build the backend and frontend against them."
2. **Backend next.** Implement the two endpoints, reusing `CommissionsService.findReport` for top-sales-people. See [backend.md](backend.md).
3. **Frontend last.** Split [pages/dashboard.tsx](frontend/src/pages/dashboard.tsx) into a role-router rendering one of three sub-components, delete the dummy demo files, and wire up the new endpoints. See [frontend.md](frontend.md).

## Shared contract

### File: `shared/src/schemas/dashboard.ts`

Use `import { z } from "zod/v4"`. Re-uses `currencyEnum` from `./product` and `commissionReportRowSchema` from `./commission`.

```ts
import { z } from "zod/v4";
import { currencyEnum } from "./product";
import { commissionReportRowSchema } from "./commission";

// ----- Sales-timeseries endpoint -----

export const dashboardRangeEnum = z.enum(["7d", "30d", "90d"]);
export type DashboardRange = z.infer<typeof dashboardRangeEnum>;

export const dashboardSalesTimeseriesQuerySchema = z.object({
  range: dashboardRangeEnum,
});
export type DashboardSalesTimeseriesQuery = z.infer<
  typeof dashboardSalesTimeseriesQuerySchema
>;

// One day point. `date` is a YYYY-MM-DD string (UTC day truncation).
export const dashboardTimeseriesPointSchema = z.object({
  date: z.string(),
  total: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
});
export type DashboardTimeseriesPoint = z.infer<
  typeof dashboardTimeseriesPointSchema
>;

export const dashboardSalesTimeseriesResponseSchema = z.object({
  range: dashboardRangeEnum,
  currency: currencyEnum, // v1: hard-coded "USD" server-side
  points: z.array(dashboardTimeseriesPointSchema),
});
export type DashboardSalesTimeseriesResponse = z.infer<
  typeof dashboardSalesTimeseriesResponseSchema
>;

// ----- Summary endpoint -----

// Per-currency revenue row (used inside KPIs)
export const dashboardCurrencyRevenueSchema = z.object({
  currency: currencyEnum,
  total: z.number().nonnegative(),
});
export type DashboardCurrencyRevenue = z.infer<
  typeof dashboardCurrencyRevenueSchema
>;

// Compact recent-sale row for the sales-person activity table
export const dashboardRecentSaleSchema = z.object({
  id: z.string(),
  saleNumber: z.string(),
  createdAt: z.string(), // ISO datetime
  clientName: z.string(),
  totalAmount: z.number().nonnegative(),
  currency: currencyEnum,
});
export type DashboardRecentSale = z.infer<typeof dashboardRecentSaleSchema>;

// Admin payload
export const adminDashboardSummarySchema = z.object({
  role: z.literal("admin"),
  revenueCurrent: z.array(dashboardCurrencyRevenueSchema),
  revenuePrevious: z.array(dashboardCurrencyRevenueSchema),
  saleCountCurrent: z.number().int().nonnegative(),
  saleCountPrevious: z.number().int().nonnegative(),
  activeClientsCount: z.number().int().nonnegative(),
  activeSalesPeopleCount: z.number().int().nonnegative(),
  topSalesPeople: z.array(commissionReportRowSchema), // capped at 10
});
export type AdminDashboardSummary = z.infer<
  typeof adminDashboardSummarySchema
>;

// Sales-person payload
export const salesPersonDashboardSummarySchema = z.object({
  role: z.literal("salesPerson"),
  revenueCurrent: z.array(dashboardCurrencyRevenueSchema),
  revenuePrevious: z.array(dashboardCurrencyRevenueSchema),
  saleCountCurrent: z.number().int().nonnegative(),
  saleCountPrevious: z.number().int().nonnegative(),
  myClientsCount: z.number().int().nonnegative(),
  projectedCommission: z.array(commissionReportRowSchema), // typically 1 row/currency
  recentSales: z.array(dashboardRecentSaleSchema), // capped at 10
});
export type SalesPersonDashboardSummary = z.infer<
  typeof salesPersonDashboardSummarySchema
>;

// Plain `user` role — just the discriminator
export const userDashboardSummarySchema = z.object({
  role: z.literal("user"),
});
export type UserDashboardSummary = z.infer<typeof userDashboardSummarySchema>;

export const dashboardSummaryResponseSchema = z.discriminatedUnion("role", [
  adminDashboardSummarySchema,
  salesPersonDashboardSummarySchema,
  userDashboardSummarySchema,
]);
export type DashboardSummaryResponse = z.infer<
  typeof dashboardSummaryResponseSchema
>;
```

> CLAUDE.md: "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."
> CLAUDE.md: "Every schema uses **Zod v4** (`import { z } from \"zod/v4\"`) and exports both the schema and its inferred type (`z.infer<typeof schema>`)."
> CLAUDE.md: "Zod validation messages stay in English — schemas live in `shared/` and are used by backend too."

### File: `shared/src/index.ts`

Append a new re-export block (mirror the existing per-feature blocks; place it after the commission block):

```ts
export {
  dashboardRangeEnum,
  type DashboardRange,
  dashboardSalesTimeseriesQuerySchema,
  type DashboardSalesTimeseriesQuery,
  dashboardTimeseriesPointSchema,
  type DashboardTimeseriesPoint,
  dashboardSalesTimeseriesResponseSchema,
  type DashboardSalesTimeseriesResponse,
  dashboardCurrencyRevenueSchema,
  type DashboardCurrencyRevenue,
  dashboardRecentSaleSchema,
  type DashboardRecentSale,
  adminDashboardSummarySchema,
  type AdminDashboardSummary,
  salesPersonDashboardSummarySchema,
  type SalesPersonDashboardSummary,
  userDashboardSummarySchema,
  type UserDashboardSummary,
  dashboardSummaryResponseSchema,
  type DashboardSummaryResponse,
} from "./schemas/dashboard";
```

## Design decisions (deliberately simple)

| Decision | What we do | Why |
|---|---|---|
| **One endpoint or per-role?** | Single `GET /api/dashboard/summary` returning a discriminated union on `role`. | One frontend hook, one cache key, simpler invalidation. The server still verifies role; the union is just the response shape. |
| **Date field for "this month"** | `Sale.createdAt`. Indexed by `SaleSchema.index({ createdAt: -1 })` in [sale.schema.ts](backend/src/sales/schemas/sale.schema.ts). | Same field the commissions report uses. No `saleDate` exists. |
| **Month boundaries** | Server-computed UTC: `from = first day of current month 00:00:00 UTC`, `to = first day of next month 00:00:00 UTC`. Half-open `[from, to)`. Previous month is `[prevFrom, from)`. | Matches the half-open convention already used by `commissions.service.ts`. UTC keeps the boundary stable across server timezone changes. |
| **Currency handling in KPIs** | KPIs return `Array<{ currency, total }>` — one row per currency. Frontend renders one card per currency. | Sales are single-currency per row but the org has both USD and VES. Summing across currencies would lie. Mirrors the `commission` feature. |
| **Currency for the time-series chart** | Hard-code `"USD"` server-side in v1. Surface it in the response as `currency: "USD"` and label it in the chart subtitle. | A two-line dual-axis chart isn't worth the complexity for v1. The KPI cards already break down by currency — the chart is a trend signal. |
| **"Active sales people"** | Count of distinct `soldBy.userId` whose sale falls inside the current-month window. | More meaningful for ops than counting recent sign-ups. New-signup count would mostly read zero. |
| **Recent sales for sales-person** | Use a small `find().sort({ createdAt: -1 }).limit(10)` filtered by `soldBy.userId` directly inside the dashboard service, not via `SalesService`. | Avoids threading a new optional `soldBy` filter through `SalesService.findAllPaginated` for one consumer. |
| **Top sales people for admin** | Reuse `CommissionsService.findReport(currentMonthFrom, currentMonthTo)` and slice to first 10 rows. | Don't duplicate the aggregation. Requires exporting `CommissionsService` from `CommissionsModule` (it currently isn't exported — see [commissions.module.ts](backend/src/commissions/commissions.module.ts)). |
| **Commission rate** | Use the user's *current* `commissionPercentage` (default 3 if undefined). | Same trade-off the commissions feature already accepts. No historical snapshot. |
| **Time-series granularity** | Day. UTC `$dateTrunc` on `createdAt`. Backfill missing days with zeros so the line stays continuous. | The toggle is 7/30/90 days; sub-day buckets aren't useful at that scale. |
| **Time-series gap-filling** | Service backfills zero-points for missing days **after** the Mongo aggregation, in JS. | Mongo's `$densify` works but adds cognitive load — a 90-element JS loop is clearer. |
| **`user` role payload** | `{ role: "user" }` — no other fields, no DB calls. | Plain `user` has no operational data in the platform. Showing dummy stats would be worse than a welcome card. |
| **Authorization** | `/summary` allows all three roles (admin, salesPerson, user). `/sales-timeseries` allows only admin and salesPerson. | The `user` role has nothing to chart. |
| **Caching** | None. Each request runs the aggregations fresh. | Per "simplest". The dashboard is loaded a few times per session per user — caching is premature. |
| **Pagination** | None. Top-N is hard-capped server-side at 10; recent-sales is capped at 10. | A dashboard surface, not a list page. |

## Cleanup in this same change

The following are confirmed orphans after this work lands (verified by grep on 2026-04-29 — only consumer is `pages/dashboard.tsx`):

- `frontend/src/data.json` → **delete**
- `frontend/src/components/chart-area-interactive.tsx` → **delete**
- `frontend/src/components/data-table.tsx` → **delete**

Verify before deleting:

```bash
grep -rn "data.json\|chart-area-interactive\|data-table" frontend/src --include="*.ts" --include="*.tsx"
```

Expected: matches only inside the files being deleted, plus the soon-to-be-replaced `pages/dashboard.tsx`. If anything else turns up, surface it and stop.

## Out of scope

- No FX conversion between USD and VES.
- No historical commission snapshots.
- No drilldowns from KPI cards or chart points.
- No exports (CSV/PDF).
- No real-time updates / websockets.
- No caching layer.
- No new role; the `user` role gets a minimal welcome state, not a redirect.
- No e2e tests; unit tests at the service level + lib-API level only.

## Open questions

None — the user pre-resolved every ambiguity and the codebase confirms `Sale.createdAt` is the right date field, `soldBy.userId` is non-nullable, and `CommissionsService.findReport` already produces the per-currency, per-sales-person aggregation we need for "top sales people".
