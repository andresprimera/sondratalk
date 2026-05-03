# Sales — City-Aggregate Stock — Backend Plan

**Prerequisite:** shared contract from `overview.md` is implemented (`shared/src/schemas/sale.ts` updated; `shared/src/schemas/inventory.ts` adds `cityStockSchema` + `cityStockQuerySchema`; both re-exported from `shared/src/index.ts`).

Reference module to mirror for layout: [backend/src/sales/](backend/src/sales/) — already exists, this is an in-place modification.

## Step 1 — Mongoose schema: add `cityId` + `cityName` to `Sale`

**File:** [backend/src/sales/schemas/sale.schema.ts](backend/src/sales/schemas/sale.schema.ts)

Add two `@Prop`s on the `Sale` class, after `clientName`:

```ts
@Prop({ type: SchemaTypes.ObjectId, ref: 'City', required: true })
cityId: Types.ObjectId;

@Prop({ required: true })
cityName: string;
```

Leave `WarehouseAllocation` and `SaleItem` schemas unchanged — allocations stay persisted.

> CLAUDE.md: "Always enable `{ timestamps: true }` on schemas." (already enabled, do not remove).
> CLAUDE.md: "Use NestJS `@Schema()` and `@Prop()` decorators with `SchemaFactory.createForClass()`."

Reference: [backend/src/users/schemas/user.schema.ts](backend/src/users/schemas/user.schema.ts) — see how `cityId` is declared on `User` for the pattern (same `SchemaTypes.ObjectId, ref: 'City'`).

## Step 2 — DTOs

**File:** [backend/src/sales/dto/create-sale.dto.ts](backend/src/sales/dto/create-sale.dto.ts)

Re-export the new `createSaleSchema` and `CreateSaleInput` from `@base-dashboard/shared`. Drop any local redefinition.

> CLAUDE.md: "Backend DTO files (`backend/src/<feature>/dto/`) **re-export** from shared — they never redefine the same schema."

## Step 3 — `WarehousesService.findActiveByCity`

**File:** [backend/src/warehouses/warehouses.service.ts](backend/src/warehouses/warehouses.service.ts)

Add a public method:

```ts
async findActiveByCity(cityId: string): Promise<WarehouseDocument[]> {
  return this.warehouseModel.find({
    cityId: new Types.ObjectId(cityId),
    isActive: true,
  });
}
```

> CLAUDE.md naming: "`findBy<Field>(value)` … Fetch one record by a specific field." This returns multiple, so the closer match is the `findAllPaginated` family — but since this is filtering by a single field across all records, `findActiveByCity` is the clearest name and is consistent with the codebase (e.g., users service has `findSalesPersonOptions` for a similar filtered-list shape).

**Banned method prefixes (ESLint):** `get|fetch|add|delete|destroy|set|list|edit` + capital letter — `findActiveByCity` is fine.

Update [backend/src/warehouses/warehouses.service.spec.ts](backend/src/warehouses/warehouses.service.spec.ts):

- New `describe('findActiveByCity', ...)` block.
- Mock `warehouseModel.find` to return a list. Assert the filter passed to `find()` is `{ cityId: <ObjectId>, isActive: true }`.

> CLAUDE.md: "Mock dependencies as plain objects with `jest.fn()` methods … Do NOT use `jest.Mocked<Partial<T>>`."

## Step 4 — `InventoryService.findCityStockForProduct`

**File:** [backend/src/inventory/inventory.service.ts](backend/src/inventory/inventory.service.ts)

Add a public method that returns the signed-qty sum across all active warehouses in a city:

```ts
async findCityStockForProduct(
  productId: string,
  cityId: string,
): Promise<number> {
  const warehouses = await this.warehousesService.findActiveByCity(cityId);
  if (warehouses.length === 0) return 0;
  const warehouseIds = warehouses.map((w) => w._id);

  const [result] = await this.inventoryModel.aggregate<{ totalQty: number }>([
    {
      $match: {
        productId: new Types.ObjectId(productId),
        warehouseId: { $in: warehouseIds },
      },
    },
    { $group: { _id: null, totalQty: signedQtySum } },
  ]);
  return result?.totalQty ?? 0;
}
```

Reuse the existing module-scoped `signedQtySum` constant.

Update [backend/src/inventory/inventory.service.spec.ts](backend/src/inventory/inventory.service.spec.ts):

- New `describe('findCityStockForProduct', ...)` block.
- Two tests: (a) returns 0 when no active warehouses in city; (b) returns aggregated totalQty when warehouses exist (mock `warehousesService.findActiveByCity` and `inventoryModel.aggregate`).

## Step 5 — New endpoint: `GET /api/inventory/city-stock`

**File:** [backend/src/inventory/inventory.controller.ts](backend/src/inventory/inventory.controller.ts)

Add a method:

```ts
@Get('city-stock')
async findCityStock(
  @Query(new ZodValidationPipe(cityStockQuerySchema)) query: CityStockQuery,
): Promise<CityStock> {
  const totalQty = await this.inventoryService.findCityStockForProduct(
    query.productId,
    query.cityId,
  );
  return { productId: query.productId, cityId: query.cityId, totalQty };
}
```

> CLAUDE.md: "All controller methods must have explicit return types."
> CLAUDE.md: "`get<Noun>()` … Read-only endpoints that aren't standard CRUD `find*`." — but here `findCityStock` aligns with the existing inventory controller's filter-style reads (the controller already uses `find*` for list-like reads). Use `findCityStock`.

**Banned controller prefixes (ESLint):** `list|add|edit|delete|destroy|fetch` + capital letter — `findCityStock` is fine.

Place this route **before** any `:id` route in the controller so the `city-stock` literal isn't captured by a `:id` param.

## Step 6 — `SalesService` rework

**File:** [backend/src/sales/sales.service.ts](backend/src/sales/sales.service.ts)

### 6a. Inject `UsersService` and `CitiesService`

Add to the constructor:

```ts
private usersService: UsersService,
private citiesService: CitiesService,
```

Update [backend/src/sales/sales.module.ts](backend/src/sales/sales.module.ts) to import `UsersModule` and `CitiesModule` (or whatever the existing module names are — check the imports in `users.controller.ts` for `CitiesService` for the import path pattern).

### 6b. Replace `assertSufficientStock` with `assertSufficientCityStock`

Aggregate requested quantity by `productId` (not by `productId+warehouseId` — warehouse no longer exists in input). For each product, call `inventoryService.findCityStockForProduct(productId, cityId)` and compare.

```ts
private async assertSufficientCityStock(
  items: { productId: string; productName: string; requestedQty: number }[],
  cityId: string,
  cityName: string,
): Promise<void> {
  const requested = new Map<string, { productName: string; qty: number }>();
  for (const item of items) {
    const existing = requested.get(item.productId);
    if (existing) {
      existing.qty += item.requestedQty;
    } else {
      requested.set(item.productId, {
        productName: item.productName,
        qty: item.requestedQty,
      });
    }
  }

  for (const [productId, entry] of requested) {
    const available = await this.inventoryService.findCityStockForProduct(
      productId,
      cityId,
    );
    if (entry.qty > available) {
      throw new BadRequestException(
        `Insufficient stock for "${entry.productName}" in "${cityName}" (requested ${entry.qty}, available ${available})`,
      );
    }
  }
}
```

### 6c. New private `autoAllocate`

```ts
private async autoAllocate(
  productId: string,
  requestedQty: number,
  cityId: string,
): Promise<ResolvedAllocation[]> {
  const warehouses = await this.warehousesService.findActiveByCity(cityId);
  const withStock = await Promise.all(
    warehouses.map(async (w) => ({
      id: w.id,
      name: w.name,
      available: await this.inventoryService.findAvailableStock(
        productId,
        w.id,
      ),
    })),
  );
  // Sort: stock desc, name asc tiebreaker. Deterministic.
  withStock.sort((a, b) =>
    b.available - a.available || a.name.localeCompare(b.name),
  );

  const allocations: ResolvedAllocation[] = [];
  let remaining = requestedQty;
  for (const w of withStock) {
    if (remaining <= 0) break;
    if (w.available <= 0) continue;
    const take = Math.min(remaining, w.available);
    allocations.push({ warehouseId: w.id, warehouseName: w.name, qty: take });
    remaining -= take;
  }
  // Sufficiency was already asserted; this should never trigger, but keep
  // a defensive guard so a race doesn't silently produce an under-allocated sale.
  if (remaining > 0) {
    throw new BadRequestException(
      `Stock changed during sale creation; please retry`,
    );
  }
  return allocations;
}
```

> CLAUDE.md: "Don't add error handling, fallbacks, or validation for scenarios that can't happen." — the trailing `if (remaining > 0)` is **not** redundant: it covers a real race between `assertSufficientCityStock` and the per-warehouse re-read in `autoAllocate`. Keep it.

### 6d. Rework `create` to resolve city, validate, auto-allocate, persist

```ts
async create(
  dto: CreateSaleInput,
  soldBy: SaleSoldBy,
  actor: { role: Role },
): Promise<SaleDocument> {
  // 1. Resolve city.
  let cityId: string;
  if (actor.role === 'salesPerson') {
    const seller = await this.usersService.findById(soldBy.userId);
    if (!seller?.cityId) {
      throw new BadRequestException('Sales person has no assigned city');
    }
    cityId = seller.cityId.toString();
  } else {
    if (!dto.cityId) {
      throw new BadRequestException('City is required');
    }
    cityId = dto.cityId;
  }
  const city = await this.citiesService.findById(cityId);
  if (!city) {
    throw new NotFoundException('City not found');
  }
  if (!city.isActive) {
    throw new BadRequestException('City is inactive');
  }

  // 2. Resolve client (existing logic).
  const client = await this.clientsService.findById(dto.clientId);
  if (!client) {
    throw new NotFoundException('Client not found');
  }
  if (
    actor.role === 'salesPerson' &&
    readPopulatedRef(client.salesPersonId).id !== soldBy.userId
  ) {
    throw new ForbiddenException(
      'Cannot use a client from another sales person',
    );
  }

  // 3. Resolve products (no warehouse lookups in the input anymore).
  const productInfos = await Promise.all(
    dto.items.map(async (item) => {
      const product = await this.productsService.findById(item.productId);
      if (!product) {
        throw new NotFoundException(`Product not found: ${item.productId}`);
      }
      return {
        productId: item.productId,
        productName: product.name,
        productKind: product.kind,
        currency: product.price.currency,
        requestedQty: item.requestedQty,
        unitPrice: item.unitPrice,
      };
    }),
  );

  // 4. Validate aggregate city stock.
  await this.assertSufficientCityStock(
    productInfos.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      requestedQty: p.requestedQty,
    })),
    cityId,
    city.name,
  );

  // 5. Auto-allocate per item.
  const resolvedItems: ResolvedItem[] = await Promise.all(
    productInfos.map(async (info) => ({
      ...info,
      allocations: await this.autoAllocate(
        info.productId,
        info.requestedQty,
        cityId,
      ),
    })),
  );

  // 6. Totals.
  const totalQty = resolvedItems.reduce(
    (sum, i) => sum + i.requestedQty,
    0,
  );
  const totalAmount = resolvedItems.reduce(
    (sum, i) => sum + i.unitPrice * i.requestedQty,
    0,
  );
  const currency = resolvedItems[0]?.currency ?? 'USD';

  // 7. Persist (extend signature to accept cityId/cityName).
  const created = await this.persistSale(
    resolvedItems,
    totalQty,
    totalAmount,
    currency,
    soldBy,
    dto,
    { id: client.id, name: client.name },
    { id: cityId, name: city.name },
  );

  // 8. Outbound transactions per allocation (unchanged).
  const batch = `SALE-${created.saleNumber}`;
  for (const item of resolvedItems) {
    for (const allocation of item.allocations) {
      await this.inventoryService.create(
        {
          productId: item.productId,
          warehouseId: allocation.warehouseId,
          transactionType: 'outbound',
          batch,
          qty: allocation.qty,
          notes: `Sale ${created.saleNumber}`,
        },
        { userId: soldBy.userId, name: soldBy.name },
        { skipValidation: true },
      );
    }
  }

  this.logger.log(
    `Sale ${created.saleNumber} created by ${soldBy.name} in ${city.name} (${totalQty} units, ${totalAmount} ${currency})`,
  );
  return created;
}
```

### 6e. Update `persistSale` signature

Add a `city: { id: string; name: string }` parameter and write `cityId: new Types.ObjectId(city.id), cityName: city.name` into the document.

### 6f. Delete `assertSufficientStock` (the per-warehouse version)

It's replaced by `assertSufficientCityStock`. Per CLAUDE.md: "No commented-out code. Delete it; git has history."

## Step 7 — `SalesController` — pass `cityId` through

**File:** [backend/src/sales/sales.controller.ts](backend/src/sales/sales.controller.ts)

- `toSale` adds `cityId: doc.cityId.toString()` and `cityName: doc.cityName` to the returned object.
- `create` already passes `dto` and `actor` — no controller-level change beyond the `toSale` update, since `dto.cityId` flows in as part of the body.

## Step 8 — Service tests

**File:** [backend/src/sales/sales.service.spec.ts](backend/src/sales/sales.service.spec.ts)

Reference: [backend/src/sales/sales.service.spec.ts](backend/src/sales/sales.service.spec.ts) (the existing file — read it before rewriting; mocking patterns for `productsService`, `warehousesService`, `inventoryService`, `clientsService` are already there. Add mocks for `usersService` and `citiesService`).

Tests required for the rewritten `create`:

| describe / it | Behavior |
|---|---|
| `create > sales-person path` | Resolves city from `usersService.findById`. Throws `BadRequestException` when seller has no `cityId`. Throws `NotFoundException` when city not found. Throws `BadRequestException` when city is inactive. |
| `create > admin path` | Throws `BadRequestException` when `dto.cityId` missing. Uses `dto.cityId` when present. |
| `create > stock validation` | Throws `BadRequestException` with the city name in the message when total available < requested. Aggregates duplicate productIds across items before checking. |
| `create > auto-allocation` | Allocations are sorted by available stock desc, then warehouse name asc. Allocations sum to `requestedQty`. Skips warehouses with 0 stock. |
| `create > persistence` | Persisted sale carries `cityId` + `cityName`. `inventoryService.create` is called once per allocation with `transactionType: 'outbound'`. |

Mock chains:
- `warehousesService.findActiveByCity = jest.fn().mockResolvedValue([...])`
- `inventoryService.findCityStockForProduct = jest.fn().mockResolvedValue(<n>)`
- `inventoryService.findAvailableStock = jest.fn().mockResolvedValue(<n>)` (per-warehouse, used by `autoAllocate`)
- `usersService.findById = jest.fn().mockResolvedValue({ id, cityId: new Types.ObjectId(...) })`
- `citiesService.findById = jest.fn().mockResolvedValue({ id, name, isActive: true })`

> CLAUDE.md: "When building a new feature, always write unit tests for the service layer."

## Step 9 — Module wiring

**File:** [backend/src/sales/sales.module.ts](backend/src/sales/sales.module.ts)

Add `UsersModule` and `CitiesModule` to the `imports` array. Watch for circular dependencies — if either of them imports `SalesModule` directly or transitively, use `forwardRef`. Reference the `inventory.service.ts` constructor for the `forwardRef` pattern with `WarehousesService`.

## Step 10 — Verify

- `pnpm --filter backend lint`
- `pnpm --filter backend test`
- `pnpm --filter backend build`

> CLAUDE.md: "Build check: Run `pnpm run build` in both packages before considering work complete."
