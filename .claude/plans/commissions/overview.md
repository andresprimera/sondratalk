# Commissions

## Goal

An admin opens **/dashboard/commissions**, picks a date range (defaults to the current month), and sees a table grouped by sales person showing the total they sold, their current commission percentage, and the calculated commission amount. The aggregation is computed server-side with a single Mongo pipeline against the `sales` collection joined to `users`. No drilldown, no exports, no historical snapshot — just a live, server-computed report.

## Surface area

- [x] Shared contract — `shared/src/schemas/commission.ts`
- [x] Backend — see [backend.md](backend.md)
- [x] Frontend — see [frontend.md](frontend.md)

## Execution order

1. **Shared first.** Add schemas and types in [shared/src/schemas/commission.ts](shared/src/schemas/commission.ts) and re-export from [shared/src/index.ts](shared/src/index.ts).
   > CLAUDE.md: "When adding a new feature, define the schemas and types in shared **first**, then build the backend and frontend against them."
2. **Backend next.** Implement the aggregation against the existing `Sale` model. See [backend.md](backend.md).
3. **Frontend last.** Consume the API. See [frontend.md](frontend.md).

## Shared contract

### File: `shared/src/schemas/commission.ts`

Use `import { z } from "zod/v4"`. Define and export:

```ts
import { z } from "zod/v4";
import { currencyEnum } from "./product";

// Query params for GET /api/commissions
export const commissionReportQuerySchema = z.object({
  // ISO 8601 datetime strings; inclusive start, exclusive end.
  from: z.iso.datetime({ message: "from must be an ISO datetime" }),
  to: z.iso.datetime({ message: "to must be an ISO datetime" }),
});
export type CommissionReportQuery = z.infer<typeof commissionReportQuerySchema>;

// One row of the report — one per (salesPerson, currency) pair.
export const commissionReportRowSchema = z.object({
  salesPersonId: z.string(),
  salesPersonName: z.string(),
  currency: currencyEnum,
  totalAmount: z.number().nonnegative(),
  saleCount: z.number().int().nonnegative(),
  commissionPercentage: z.number().min(0).max(100),
  commissionAmount: z.number().nonnegative(),
});
export type CommissionReportRow = z.infer<typeof commissionReportRowSchema>;

// Top-level response for the report endpoint.
export const commissionReportResponseSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  rows: z.array(commissionReportRowSchema),
});
export type CommissionReportResponse = z.infer<
  typeof commissionReportResponseSchema
>;
```

> CLAUDE.md: "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."
> CLAUDE.md: "Every schema uses **Zod v4** (`import { z } from \"zod/v4\"`) and exports both the schema and its inferred type (`z.infer<typeof schema>`)."
> CLAUDE.md: "Zod validation messages stay in English — schemas live in `shared/` and are used by backend too."

### File: `shared/src/index.ts`

Append a new re-export block (mirror the existing per-feature blocks):

```ts
export {
  commissionReportQuerySchema,
  type CommissionReportQuery,
  commissionReportRowSchema,
  type CommissionReportRow,
  commissionReportResponseSchema,
  type CommissionReportResponse,
} from "./schemas/commission";
```

## Design decisions (deliberately simple)

| Decision | What we do | Why |
|---|---|---|
| **Date field** | Group on `Sale.createdAt` (auto-managed by Mongoose `timestamps: true`, indexed by `SaleSchema.index({ createdAt: -1 })` in [sale.schema.ts](backend/src/sales/schemas/sale.schema.ts)). | No `saleDate` field exists; `createdAt` is the de-facto sale date and is already indexed. |
| **Date range semantics** | `from <= createdAt < to` (inclusive start, exclusive end). Both are ISO 8601 datetime strings parsed as UTC. | Standard half-open interval — avoids the off-by-one surprise of inclusive end-of-day. |
| **Currency handling** | Group rows by `(salesPersonId, currency)`. A sales person who sold in two currencies gets two rows. | Sales are per-sale single-currency but multiple currencies can exist across sales. Summing them would be a lie; grouping is the simplest honest answer with no FX. |
| **Commission rate** | Use the sales person's *current* `commissionPercentage` from the User document, not a historical snapshot. Default to 3 if undefined. | The user explicitly accepted this trade-off. Simpler — no audit table, no per-sale commission stamp. |
| **Sales without a sales person** | Cannot happen — `Sale.soldBy.userId` is `required: true`. No special handling. | |
| **Sales whose sales person was deleted** | Filtered out (the `$lookup` + `$unwind` drops them, no `preserveNullAndEmptyArrays`). | "Keep simple" per spec. Acceptable data-loss for a v1 report. |
| **Authorization** | Admin only. | Mirrors other admin-only reports in the app. |
| **Pagination** | None. | A monthly report rarely exceeds dozens of rows (one per sales person × currency). Adding pagination here is over-engineering. |
| **Caching / persistence** | None. The endpoint runs the aggregation on every request. | Per "simplest". |

## Open questions

None — the user pre-resolved every ambiguity in the request, and the codebase reading confirms `createdAt` is the right date field and `soldBy.userId` is non-nullable.
