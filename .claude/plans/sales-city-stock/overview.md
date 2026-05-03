# Sales — City-Aggregate Stock Validation

## Goal

Replace per-warehouse allocation in sales with **city-aggregate stock validation**. Sales-people no longer pick warehouses on the sale modal. The system validates that the total stock across all active warehouses in the relevant city is sufficient, then auto-allocates outbound inventory transactions across those warehouses behind the scenes.

## Decisions (locked)

- **City source.**
  - **Sales-person actor:** city is read from `user.cityId` of the sales-person creating the sale. If absent → `BadRequestException("Sales person has no assigned city")`.
  - **Admin actor:** city is required as input on the create payload (`dto.cityId`). The form must surface a city selector when the current user is an admin.
- **Auto-allocation algorithm.** Walk the active warehouses of the city in **available-stock-descending order, with `warehouseName` ascending as tiebreaker** (deterministic; deplete the largest pocket first). For each warehouse, take `min(remaining, available)` and emit an allocation, until the requested quantity is satisfied.
- **Persisted shape retains `allocations`.** The input drops them, but the persisted `Sale` document still records which warehouses were debited, so reversal on delete continues to work and historical sales are not lost.
- **Sale gains `cityId` + `cityName`** (denormalized) so we know which city scoped the sale at creation time.
- **Existing sales in the DB do not need migration.** Their `allocations` remain valid against the read schema.

## Surface area

- [x] Shared contract — `shared/src/schemas/sale.ts` (input loses `allocations`, gains optional `cityId`; read shape gains `cityId` / `cityName`).
- [x] Backend — see `backend.md`. Sales service rewrites stock validation + adds auto-allocation; warehouses service adds `findActiveByCity`; inventory service adds city-aggregate stock query; new endpoint `GET /api/inventory/city-stock`.
- [x] Frontend — see `frontend.md`. Sale modal removes the `AllocationFields` block, adds a city selector for admins, replaces per-warehouse stock display with city-aggregate stock display.

## Execution order

1. **Shared first.** Update `shared/src/schemas/sale.ts` with the new input/read shapes and re-export from `shared/src/index.ts`. Add a query schema for the new city-stock endpoint.
   > CLAUDE.md: "When adding a new feature, define the schemas and types in shared **first**, then build the backend and frontend against them."
2. **Backend next.** Service + controller changes per `backend.md`.
3. **Frontend last.** UI + API function changes per `frontend.md`.

## Shared contract

### File: `shared/src/schemas/sale.ts`

#### Keep as-is

- `warehouseAllocationSchema` / `WarehouseAllocation` — still used in the persisted read shape.
- `saleSoldBySchema` / `SaleSoldBy`.

#### Change: `saleItemSchema` (read shape)

Keep the existing `allocations: z.array(warehouseAllocationSchema).min(1, "At least one warehouse is required")` unchanged — auto-allocation will always produce ≥1 entry, so old sales continue to validate.

#### Change: `saleSchema` (read shape)

Add two fields after `saleNumber`:

```ts
cityId: z.string(),
cityName: z.string(),
```

#### Replace: `saleItemInputSchema`

Drop `allocations` entirely. New shape:

```ts
const saleItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  requestedQty: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be zero or greater"),
});
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;
```

The current `.refine` that asserts `allocations.sum === requestedQty` is removed.

#### Replace: `createSaleSchema`

```ts
export const createSaleSchema = z.object({
  cityId: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  notes: z.string().optional(),
  items: z.array(saleItemInputSchema).min(1, "At least one item is required"),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
```

`cityId` is optional in the schema; the service enforces "required for admin, ignored for salesPerson".

#### Add: `cityStockQuerySchema`

For the new `GET /api/inventory/city-stock` endpoint:

```ts
export const cityStockQuerySchema = z.object({
  productId: z.string().min(1, "Product is required"),
  cityId: z.string().min(1, "City is required"),
});
export type CityStockQuery = z.infer<typeof cityStockQuerySchema>;

export const cityStockSchema = z.object({
  productId: z.string(),
  cityId: z.string(),
  totalQty: z.number(),
});
export type CityStock = z.infer<typeof cityStockSchema>;
```

Place these in `shared/src/schemas/inventory.ts` (this is an inventory query, not a sale query).

### File: `shared/src/index.ts`

Re-export the new types: `cityStockQuerySchema`, `CityStockQuery`, `cityStockSchema`, `CityStock`.

### Rules to follow

> CLAUDE.md: "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."
> CLAUDE.md: "Every schema uses **Zod v4** (`import { z } from "zod/v4"`) and exports both the schema and its inferred type."
> CLAUDE.md: "Zod validation messages stay in English — schemas live in `shared/` and are used by backend too."

## Open questions

None outstanding — all four planning questions resolved by the user. The auto-allocation order is the one judgment call; the plan picks "stock desc, warehouseName asc tiebreaker" for determinism. Easy to tune later if FIFO-by-inbound-date becomes a requirement.

## Non-goals

- Migrating or deleting historical sales. Existing `allocations` arrays on persisted sales remain readable.
- Enforcing "approved sales-person must have cityId" at the user/approval layer. The sales service throws if the city is missing at sale-creation time, which is sufficient defense for this feature. Tighter approval-gate enforcement is a separate task.
- FIFO by inbound transaction date. Out of scope; revisit if requested.
