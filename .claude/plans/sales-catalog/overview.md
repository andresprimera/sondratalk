# Sales Catalog — Browseable Products + Persistent Selling Cart

## Goal

Give sales people (and admins) a **product catalog** page where they can browse all products, filter by kind / liquor type / price range / search, and "Add to order" directly from each row. The selected items live in a **persistent right-drawer cart** that is always accessible from the dashboard header. From the cart, the user clicks **Checkout** to open the existing `SaleFormDialog`, which is now pre-loaded with the cart's items — they only need to pick city (admin only) / client / notes and confirm.

This is purely a UX layer over the existing sales pipeline: no changes to how `Sale` documents are created, validated, or allocated. The backend gains a filterable list endpoint (sales-person readable). The frontend gains a new page, a cart context hook (single source of truth for cart state, replacing the dialog's local state + localStorage), a drawer, and a header trigger.

## Locked decisions (confirmed by user)

- **Drawer is mounted globally inside `DashboardLayout`** and the trigger button lives in `SiteHeader`. Visibility gated on `user.role === "admin" || user.role === "salesPerson"`. Rationale: "always-accessible" reads as global, not per-page.
- **`SaleFormDialog` is reused as the checkout step.** The drawer's "Checkout" button opens the existing dialog. The dialog is refactored to consume the new `useSaleCart()` hook instead of owning its own `items` / `cityId` / `clientId` / `notes` state and its own `localStorage` block. (Cart context still persists to the same `sale-cart-v1:<userId>` localStorage key, so prior carts continue to load.)
- **The dialog's existing "Add product to order" inline card stays** as a quick-add fallback. It uses the same hook (`cart.addItem`) so adds from either surface land in the same cart.
- **New route is `/dashboard/catalog`.** Admin keeps `/dashboard/products` for CRUD. **Both `admin` and `salesPerson`** see Catalog in the sidebar.
- **Filters are server-side** via query params on the existing `GET /api/products` endpoint. Read role widens to `admin, salesPerson`; mutations remain `admin`-only by per-method `@Roles()` overrides.
- **No per-row stock display in the catalog** for v1. Stock is still checked in the cart (per item) and at submit time, exactly like today. (We can add a city-aggregate stock decoration later via a batch endpoint — out of scope here.)
- **`minPrice > maxPrice` filter input is not validated.** An inverted range silently returns zero rows. Note: this is about filter inputs on the catalog, not about sale pricing. Product `price.value` is the source of truth; there's no per-sale price override (matches today's behavior — `unitPrice` in `CreateSaleInput` is sent from the cart but always equals the product's stored price).
- **Drawer does NOT auto-open on first add.** User opens the drawer themselves via the header `ShoppingCart` button, which shows a count badge so adds are visible.

## Surface area

- [ ] Shared contract — `shared/src/schemas/product.ts` gains `productListQuerySchema` (filters + pagination); re-exported from `shared/src/index.ts`.
- [ ] Backend — `ProductsService.findAllPaginated` accepts a filter object and applies Mongo `find()` filters; controller validates query with the new schema and changes the per-method role on `findAll` to `@Roles('admin', 'salesPerson')`. See `backend.md`.
- [ ] Frontend — new `useSaleCart` hook + provider, new `SaleCartDrawer`, new `SaleCartButton` (header trigger), new `CatalogPage`, refactor `SaleFormDialog` to consume the hook, sidebar entry for both roles, route. See `frontend.md`.

## Execution order

1. **Shared first.** Add `productListQuerySchema` to `shared/src/schemas/product.ts` and re-export from `shared/src/index.ts`. The backend cannot widen its query-param contract without this type.
   > CLAUDE.md: "When adding a new feature, define the schemas and types in shared **first**, then build the backend and frontend against them."
2. **Backend next.** Service filter logic + controller schema + per-method role widening + tests. See `backend.md`.
3. **Frontend last.** New hook, drawer, page, refactor of dialog, sidebar, route, i18n. See `frontend.md`. Verify in a browser.

## Shared contract

### File: `shared/src/schemas/product.ts`

Add at the bottom of the existing file (and add the `paginationQuerySchema` import at the top):

```ts
import { paginationQuerySchema } from "./pagination";

// ...existing exports stay unchanged...

export const productListQuerySchema = paginationQuerySchema.extend({
  kind: productKindEnum.optional(),
  liquorType: liquorTypeEnum.optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  search: z.string().min(1).optional(),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
```

Notes:
- `z.coerce.number()` because query params arrive as strings; matches the pattern in `paginationQuerySchema` (`page: z.coerce.number()...`).
- `search` is a free-text fragment matched against `name` (case-insensitive on backend); `min(1)` keeps empty strings out so the optional check stays clean.
- No cross-field refinement (e.g. `minPrice <= maxPrice`) — backend will pass both into Mongo and an inverted range simply returns no rows. Adding the refinement is fine if you want a friendlier error; flag it explicitly.

### File: `shared/src/index.ts`

Add to the existing `./schemas/product` re-export block:

```ts
productListQuerySchema,
type ProductListQuery,
```

### Rules to follow

> CLAUDE.md: "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."
> CLAUDE.md: "Every schema uses **Zod v4** (`import { z } from "zod/v4"`) and exports both the schema and its inferred type."
> CLAUDE.md: "Zod validation messages stay in English — schemas live in `shared/` and are used by backend too."

## Reference points

- **Existing sale-creation flow** (cart shape, localStorage key, totals math, stock check at row level): [frontend/src/components/sale-form-dialog.tsx](frontend/src/components/sale-form-dialog.tsx). The `PersistedCart` interface (`cityId`, `clientId`, `notes`, `items[]`) and the `STORAGE_KEY_PREFIX = "sale-cart-v1:"` move into the new hook verbatim.
- **Existing products list page** (table, filters, pagination patterns to mirror): [frontend/src/pages/products.tsx](frontend/src/pages/products.tsx).
- **Existing list query schema with extra filters** (the closest analogue for what `productListQuerySchema` should look like): [shared/src/schemas/inventory.ts](shared/src/schemas/inventory.ts) → `stockByWarehouseQuerySchema`.
- **Existing right `Sheet` component** (we use this verbatim for the drawer): [frontend/src/components/ui/sheet.tsx](frontend/src/components/ui/sheet.tsx).
- **Existing dashboard layout to wrap**: [frontend/src/components/dashboard-layout.tsx](frontend/src/components/dashboard-layout.tsx).
- **Existing site header** (where the cart trigger goes): [frontend/src/components/site-header.tsx](frontend/src/components/site-header.tsx).
- **Existing sidebar** (where "Catalog" link goes): [frontend/src/components/app-sidebar.tsx](frontend/src/components/app-sidebar.tsx).
- **Existing router** (where the new route goes): [frontend/src/router.tsx](frontend/src/router.tsx).

## Open questions

All resolved by the user — see "Locked decisions" above.

## Non-goals

- No changes to `Sale` schema, `SalesService`, allocation logic, or stock validation. The cart is a UI concept that produces the same `CreateSaleInput` payload the backend already accepts.
- No new caching strategy. The cart lives in React state + localStorage (same key as today). React Query caches the catalog list per filter combination, nothing else.
- No multi-currency UI work. The existing "totals share the first item's currency" assumption carries over (see `sale-form-dialog.tsx:332`).
