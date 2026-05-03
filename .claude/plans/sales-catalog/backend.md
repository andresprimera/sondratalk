# Sales Catalog — Backend Plan

**Prerequisite:** `productListQuerySchema` and `ProductListQuery` from `overview.md` are added to `shared/src/schemas/product.ts` and re-exported from `shared/src/index.ts`.

The backend changes are **scoped to the `products` module**. No new module, no new schema file, no migrations. We extend the existing list endpoint to accept filters and widen its read role to `salesPerson`.

Reference module to mirror (read these before starting):
- [backend/src/products/products.controller.ts](backend/src/products/products.controller.ts) — current `findAll`, `findOptions`, role-decorator pattern.
- [backend/src/products/products.service.ts](backend/src/products/products.service.ts) — current `findAllPaginated` with `Promise.all` + `countDocuments`.
- [backend/src/products/products.service.spec.ts](backend/src/products/products.service.spec.ts) — existing test patterns to extend.

## Step 1 — Service: extend `findAllPaginated` with filters

**File:** `backend/src/products/products.service.ts`

Replace the current signature

```ts
async findAllPaginated(
  page: number,
  limit: number,
): Promise<{ data: ProductDocument[]; total: number }>
```

with a single-arg filter object:

```ts
import type { ProductListQuery } from '@base-dashboard/shared';

async findAllPaginated(
  query: ProductListQuery,
): Promise<{ data: ProductDocument[]; total: number }> {
  const { page, limit, kind, liquorType, minPrice, maxPrice, search } = query;
  const filter: FilterQuery<Product> = {};

  if (kind) filter.kind = kind;
  if (liquorType) {
    filter.kind = 'liquor';
    filter.liquorType = liquorType;
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter['price.value'] = {};
    if (minPrice !== undefined) filter['price.value'].$gte = minPrice;
    if (maxPrice !== undefined) filter['price.value'].$lte = maxPrice;
  }
  if (search) {
    filter.name = { $regex: escapeRegex(search), $options: 'i' };
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    this.productModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    this.productModel.countDocuments(filter),
  ]);
  return { data, total };
}
```

Add the `FilterQuery` import: `import { FilterQuery, Model } from 'mongoose';` (Model is already imported).

Add a small private helper at the bottom of the file:

```ts
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

Place it as a top-level (non-class) function in the same file (or a `private` instance method — top-level is fine since it has no state).

Notes:
- **Sort changes from `createdAt: -1` → `name: 1`.** Browseable catalog lists alphabetically, like the existing `findOptions` does. If you want to preserve the admin page's "newest first" sort, add an optional `sort` param to the query schema instead — but that doubles the surface area for no current consumer benefit. Default to alpha.
- `liquorType` filter implies `kind = liquor`; the assignment above forces that consistency even if the caller didn't send `kind=liquor` explicitly.
- `escapeRegex` matters: `search` is user input and goes into a Mongo regex. Without escaping, `.` `*` `(` etc. behave as regex operators.

> CLAUDE.md (service naming): "`findAllPaginated(page, limit)` … Append `Paginated` to distinguish paginated from unpaginated variants." — keeping the existing method name; only its parameter shape changes.

## Step 2 — Controller: validate the new query, widen the role

**File:** `backend/src/products/products.controller.ts`

Replace the current `findAll` method:

```ts
@Get()
@Roles('admin', 'salesPerson')
async findAll(
  @Query(new ZodValidationPipe(productListQuerySchema))
  query: ProductListQuery,
): Promise<PaginatedResponse<Product>> {
  const { data, total } = await this.productsService.findAllPaginated(query);
  return {
    data: data.map(toProduct),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
```

Imports to update at the top of the file:
- Remove: `paginationQuerySchema, type PaginationQuery` from `'../common/dto/pagination-query.dto'`.
- Add: `productListQuerySchema, type ProductListQuery` from `'@base-dashboard/shared'` (you can also re-export through a `dto/list-product.dto.ts` per the convention — see Step 3).

The controller's class-level `@Roles('admin')` still applies to `create`, `update`, `remove`, and (currently) `findOne`. The per-method `@Roles('admin', 'salesPerson')` on `findAll` overrides the class-level — same pattern already used by `findOptions`:

```ts
@Get('options')
@Roles('admin', 'salesPerson')
async findOptions(): Promise<ProductOption[]> { ... }
```

> CLAUDE.md: "All controller methods must have explicit return types." — return type stays `Promise<PaginatedResponse<Product>>`.
> CLAUDE.md (controller naming): "`findAll()` … `@Get()` on collection … List/paginated resources" — keep the name.
> CLAUDE.md banned controller prefixes (ESLint): `list|add|edit|delete|destroy|fetch` + capital — `findAll` is fine.

**Do NOT add `salesPerson` to `findOne`, `create`, `update`, `remove`.** The catalog only needs the list endpoint.

## Step 3 — DTO re-export (optional but preferred for consistency)

**File:** `backend/src/products/dto/list-product.dto.ts` (new)

```ts
export {
  productListQuerySchema,
  type ProductListQuery,
} from '@base-dashboard/shared';
```

Then have the controller import from `./dto/list-product.dto` instead of directly from shared. This matches the existing convention.

> CLAUDE.md: "Backend DTO files (`backend/src/<feature>/dto/`) **re-export** from shared — they never redefine the same schema."

Reference: [backend/src/products/dto/create-product.dto.ts](backend/src/products/dto/create-product.dto.ts) (the existing pattern this mirrors).

## Step 4 — Tests

**File:** `backend/src/products/products.service.spec.ts`

Reference: [backend/src/products/products.service.spec.ts](backend/src/products/products.service.spec.ts) (existing tests for the previous signature — these need to be updated since the signature changed).

For the Mongoose chain mock, the existing pattern is:

```ts
const findChain = {
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(mockData),
};
mockProductModel.find.mockReturnValue(findChain);
mockProductModel.countDocuments.mockResolvedValue(mockData.length);
```

> CLAUDE.md: "For Mongoose query chains (`.find().skip().limit()`), mock as chainable objects: `{ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(data) }`."

Tests required (one `describe` per scenario, all under `describe('findAllPaginated', ...)`):

1. **No filters** — passes `{}` to `find()` and `countDocuments()`, sorts by `{ name: 1 }`, applies skip/limit.
2. **`kind: 'liquor'`** — `find()` filter argument equals `{ kind: 'liquor' }`.
3. **`liquorType: 'rum'`** — filter equals `{ kind: 'liquor', liquorType: 'rum' }` (forces `kind=liquor` even if caller omitted it).
4. **`minPrice: 5, maxPrice: 50`** — filter equals `{ 'price.value': { $gte: 5, $lte: 50 } }`.
5. **`minPrice: 5` only** — filter equals `{ 'price.value': { $gte: 5 } }`.
6. **`maxPrice: 50` only** — filter equals `{ 'price.value': { $lte: 50 } }`.
7. **`search: 'rum'`** — filter equals `{ name: { $regex: 'rum', $options: 'i' } }`.
8. **`search` with regex special chars: `'rum.* (special)'`** — regex string is escaped to `'rum\\.\\* \\(special\\)'`. Important so future-you doesn't lose the escaping helper.
9. **All filters combined** — `{ kind: 'liquor', liquorType: 'rum' }` is overridden by liquorType branch (final filter has both); `price.value` range is intact; `name` regex applied.
10. **Pagination math** — `page: 3, limit: 20` produces `skip: 40`, `limit: 20`.
11. **Returned shape** — returns `{ data, total }` with the chain's resolved data and the `countDocuments` resolved total.

To assert the filter argument cleanly, capture the call:

```ts
expect(mockProductModel.find).toHaveBeenCalledWith({ kind: 'liquor' });
expect(mockProductModel.countDocuments).toHaveBeenCalledWith({ kind: 'liquor' });
```

> CLAUDE.md: "When building a new feature, always write unit tests for the service layer."
> CLAUDE.md: "Mock dependencies as plain objects with `jest.fn()` methods, then provide them with `{ provide: ServiceClass, useValue: mockObject }`. Do NOT use `jest.Mocked<Partial<T>>`."

**Do NOT add controller tests.** > CLAUDE.md: "Do NOT test controllers directly — they are thin wrappers."

## Step 5 — Verify

```bash
pnpm --filter backend lint
pnpm --filter backend test
pnpm --filter backend build
```

All three must pass. The PostToolUse hook runs ESLint per file, the Stop hook runs `pnpm typecheck` once per turn, and pre-commit runs `pnpm lint && pnpm typecheck && pnpm test` — but you should run them explicitly before declaring this step done.

## Backwards compatibility note

The existing admin Products page (`frontend/src/pages/products.tsx`) calls `fetchProductsApi(page, limit)`. After the frontend refactor (see `frontend.md` Step 1), that signature changes to `fetchProductsApi(args)`. The backend change here is forward-compatible — the new query schema's filter fields are all optional, so a request with only `page` and `limit` continues to work exactly as today (modulo the sort order change to `name: 1`).

If the sort change is not acceptable for the admin page, the cleanest fix is to add `sort: z.enum(['name', 'createdAt']).default('name').optional()` to `productListQuerySchema` and have the admin page pass `sort: 'createdAt'`. Decide before shipping.
