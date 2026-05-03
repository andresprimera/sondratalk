# Dashboard — Backend Plan

**Prerequisite:** the shared contract from [overview.md](overview.md) (`dashboardSummaryResponseSchema`, `dashboardSalesTimeseriesQuerySchema`, etc.) is implemented and exported from `@base-dashboard/shared`.

## Module layout

Create `backend/src/dashboard/` with:

- `dashboard.module.ts`
- `dashboard.controller.ts`
- `dashboard.service.ts`
- `dto/dashboard-sales-timeseries-query.dto.ts` (re-exports from `@base-dashboard/shared`)
- `dashboard.service.spec.ts`

> CLAUDE.md: "Feature-based modules: each feature gets its own folder with `module`, `controller`, `service`, `dto/`, `schemas/`, `guards/`, `decorators/`, `strategies/` as needed."

**Reference module to mirror:** [backend/src/commissions/](backend/src/commissions/) — same shape (no Mongoose schema of its own, consumes models from other features).

The dashboard module owns no Mongoose schema. It reads from `Sale`, `Client`, and `User`, and reuses `CommissionsService.findReport` for top-sales-people.

## Step 1 — Reuse existing schemas (no new Mongoose schema)

Read-only against:

- [backend/src/sales/schemas/sale.schema.ts](backend/src/sales/schemas/sale.schema.ts) — fields used: `createdAt` (indexed), `totalAmount`, `currency`, `soldBy.userId`, `saleNumber`, `clientName`, `_id`.
- [backend/src/clients/schemas/client.schema.ts](backend/src/clients/schemas/client.schema.ts) — fields used: `salesPersonId` (for `myClientsCount`), document count for `activeClientsCount`.
- [backend/src/users/schemas/user.schema.ts](backend/src/users/schemas/user.schema.ts) — fields used: `role` (for the future, not strictly needed in v1 since `activeSalesPeopleCount` is computed from sales).

> CLAUDE.md: "Always enable `{ timestamps: true }` on schemas." (already true for `Sale`, `Client`, `User`)

**Important fact about `Sale.soldBy.userId`:** stored as a `string`, **not** an ObjectId. Match it directly with strings in `$match`; cast with `$toObjectId` only when joining to `users` (the commissions service shows the pattern at [commissions.service.ts:53](backend/src/commissions/commissions.service.ts#L53)).

## Step 2 — Export `CommissionsService` from `CommissionsModule`

**File:** [backend/src/commissions/commissions.module.ts](backend/src/commissions/commissions.module.ts)

Currently the module does not export its service. Add the export so `DashboardModule` can inject it:

```ts
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sale.name, schema: SaleSchema }]),
  ],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService], // ← add this
})
export class CommissionsModule {}
```

## Step 3 — DTO

**File:** `backend/src/dashboard/dto/dashboard-sales-timeseries-query.dto.ts`

```ts
export {
  dashboardSalesTimeseriesQuerySchema,
  type DashboardSalesTimeseriesQuery,
} from '@base-dashboard/shared';
```

> CLAUDE.md: "Backend DTO files (`backend/src/<feature>/dto/`) **re-export** from shared — they never redefine the same schema."

The summary endpoint takes no query params, so no DTO is needed for it.

## Step 4 — Service

**File:** `backend/src/dashboard/dashboard.service.ts`

Inject:
- `@InjectModel(Sale.name) saleModel: Model<Sale>` (re-registered in this module's `MongooseModule.forFeature` — see Step 6)
- `@InjectModel(Client.name) clientModel: Model<Client>`
- `commissionsService: CommissionsService` (provided via `imports: [CommissionsModule]`)

Use `private readonly logger = new Logger(DashboardService.name)`.

> CLAUDE.md: "Use the **NestJS `Logger`** class for all log output."
> CLAUDE.md: "Each service creates its own logger instance: `private readonly logger = new Logger(ClassName.name)`."

### Public methods (use these exact names)

| Method | Signature | Purpose |
|---|---|---|
| `findSummary` | `findSummary(actor: { userId: string; role: Role }): Promise<DashboardSummaryResponse>` | Branches on `actor.role` and assembles the discriminated-union payload. |
| `findSalesTimeseries` | `findSalesTimeseries(actor: { userId: string; role: Role }, range: DashboardRange): Promise<DashboardSalesTimeseriesResponse>` | Returns daily-bucketed sales totals for the window, scoped to actor when sales-person. |

> CLAUDE.md (naming): "`findBy<Field>(value)` … `<verb><Noun>()` — Action on a specific field/sub-resource."
> CLAUDE.md (naming): banned service prefixes (lint-enforced via [backend/eslint.config.mjs](backend/eslint.config.mjs)) are `get|fetch|add|delete|destroy|set|list|edit` + capital. `findSummary` and `findSalesTimeseries` use `find<Noun>` and are allowed.

### Private helper methods

These break the work into small testable pieces. Names chosen to avoid the banned prefix list (no `get|fetch|add|delete|destroy|set|list|edit` + capital).

| Helper | Purpose |
|---|---|
| `monthWindow(now: Date)` | Returns `{ currentFrom, currentTo, previousFrom }` — UTC month boundaries. Pure function. |
| `findCurrencyRevenue(from: Date, to: Date, salesPersonId?: string)` | Returns `Array<{ currency, total }>` via `$group`. |
| `findSaleCount(from: Date, to: Date, salesPersonId?: string)` | Returns `number` via `countDocuments`. |
| `findActiveClientsCount()` | `clientModel.countDocuments({})` — admin only. |
| `findActiveSalesPeopleCount(from: Date, to: Date)` | Distinct count of `soldBy.userId` for sales in the window. Admin only. |
| `findMyClientsCount(salesPersonId: string)` | `clientModel.countDocuments({ salesPersonId: new Types.ObjectId(salesPersonId) })`. |
| `findRecentSalesForSalesPerson(salesPersonId: string, limit: number)` | `saleModel.find({ 'soldBy.userId': salesPersonId }).sort({ createdAt: -1 }).limit(limit)`. Maps documents to `DashboardRecentSale`. |
| `findDailyTimeseries(from: Date, to: Date, currency: Currency, salesPersonId?: string)` | Mongo `$dateTrunc` aggregation on `createdAt` returning raw `[{ date, total, count }]`. |
| `backfillTimeseries(points: DashboardTimeseriesPoint[], from: Date, to: Date)` | Pure helper that fills missing days with zero rows so the chart isn't gappy. |

### Implementation sketch — `findSummary`

```ts
async findSummary(
  actor: { userId: string; role: Role },
): Promise<DashboardSummaryResponse> {
  if (actor.role === 'user') {
    return { role: 'user' };
  }

  const { currentFrom, currentTo, previousFrom } = this.monthWindow(new Date());

  if (actor.role === 'salesPerson') {
    const [
      revenueCurrent,
      revenuePrevious,
      saleCountCurrent,
      saleCountPrevious,
      myClientsCount,
      projectedCommission,
      recentSales,
    ] = await Promise.all([
      this.findCurrencyRevenue(currentFrom, currentTo, actor.userId),
      this.findCurrencyRevenue(previousFrom, currentFrom, actor.userId),
      this.findSaleCount(currentFrom, currentTo, actor.userId),
      this.findSaleCount(previousFrom, currentFrom, actor.userId),
      this.findMyClientsCount(actor.userId),
      this.commissionsService.findReport(currentFrom, currentTo, actor.userId),
      this.findRecentSalesForSalesPerson(actor.userId, 10),
    ]);
    return {
      role: 'salesPerson',
      revenueCurrent,
      revenuePrevious,
      saleCountCurrent,
      saleCountPrevious,
      myClientsCount,
      projectedCommission,
      recentSales,
    };
  }

  // actor.role === 'admin'
  const [
    revenueCurrent,
    revenuePrevious,
    saleCountCurrent,
    saleCountPrevious,
    activeClientsCount,
    activeSalesPeopleCount,
    allTopRows,
  ] = await Promise.all([
    this.findCurrencyRevenue(currentFrom, currentTo),
    this.findCurrencyRevenue(previousFrom, currentFrom),
    this.findSaleCount(currentFrom, currentTo),
    this.findSaleCount(previousFrom, currentFrom),
    this.findActiveClientsCount(),
    this.findActiveSalesPeopleCount(currentFrom, currentTo),
    this.commissionsService.findReport(currentFrom, currentTo),
  ]);
  return {
    role: 'admin',
    revenueCurrent,
    revenuePrevious,
    saleCountCurrent,
    saleCountPrevious,
    activeClientsCount,
    activeSalesPeopleCount,
    topSalesPeople: allTopRows
      .slice()
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10),
  };
}
```

**Notes:**

- `Promise.all` in parallel is fine; each query is independent and Mongo handles concurrency.
- Sorting `topSalesPeople` by `totalAmount desc` is a JS sort because the commissions service sorts by `salesPersonName asc` — different sort intent.
- The slice copy (`allTopRows.slice()`) protects against in-place mutation if a future caller re-uses the array.
- Don't add a try/catch swallowing errors — let Mongoose exceptions propagate to the global filter.
  > CLAUDE.md: "Don't add error handling, fallbacks, or validation for scenarios that can't happen."

### Implementation sketch — `findSalesTimeseries`

```ts
async findSalesTimeseries(
  actor: { userId: string; role: Role },
  range: DashboardRange,
): Promise<DashboardSalesTimeseriesResponse> {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const to = new Date(); // exclusive upper bound
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const salesPersonId =
    actor.role === 'salesPerson' ? actor.userId : undefined;

  const raw = await this.findDailyTimeseries(from, to, 'USD', salesPersonId);
  const points = this.backfillTimeseries(raw, from, to);

  return { range, currency: 'USD', points };
}
```

### Implementation sketch — `findCurrencyRevenue`

```ts
private async findCurrencyRevenue(
  from: Date,
  to: Date,
  salesPersonId?: string,
): Promise<DashboardCurrencyRevenue[]> {
  const match: Record<string, unknown> = { createdAt: { $gte: from, $lt: to } };
  if (salesPersonId) match['soldBy.userId'] = salesPersonId;
  const rows = await this.saleModel.aggregate<{
    _id: string;
    total: number;
  }>([
    { $match: match },
    { $group: { _id: '$currency', total: { $sum: '$totalAmount' } } },
    { $project: { _id: 0, currency: '$_id', total: { $round: ['$total', 2] } } },
  ]);
  return rows.map((r) => ({ currency: r.currency as Currency, total: r.total }));
}
```

> CLAUDE.md: "**No type assertions** (`as`) … Exception: Mongoose enum fields return `string` — cast to the shared union type." — same allowed exception used in `commissions.service.ts`.

### Implementation sketch — `findDailyTimeseries`

```ts
private async findDailyTimeseries(
  from: Date,
  to: Date,
  currency: Currency,
  salesPersonId?: string,
): Promise<DashboardTimeseriesPoint[]> {
  const match: Record<string, unknown> = {
    createdAt: { $gte: from, $lt: to },
    currency,
  };
  if (salesPersonId) match['soldBy.userId'] = salesPersonId;

  const rows = await this.saleModel.aggregate<{
    _id: Date;
    total: number;
    count: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$createdAt', unit: 'day', timezone: 'UTC' },
        },
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    date: r._id.toISOString().slice(0, 10), // YYYY-MM-DD
    total: Math.round(r.total * 100) / 100,
    count: r.count,
  }));
}
```

### Implementation sketch — `backfillTimeseries`

```ts
private backfillTimeseries(
  points: DashboardTimeseriesPoint[],
  from: Date,
  to: Date,
): DashboardTimeseriesPoint[] {
  const byDate = new Map(points.map((p) => [p.date, p]));
  const result: DashboardTimeseriesPoint[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 10);
    result.push(byDate.get(key) ?? { date: key, total: 0, count: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
```

### Implementation sketch — `monthWindow`

```ts
private monthWindow(now: Date): {
  currentFrom: Date;
  currentTo: Date;
  previousFrom: Date;
} {
  const currentFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const currentTo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const previousFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return { currentFrom, currentTo, previousFrom };
}
```

### Implementation sketch — `findRecentSalesForSalesPerson`

```ts
private async findRecentSalesForSalesPerson(
  salesPersonId: string,
  limit: number,
): Promise<DashboardRecentSale[]> {
  const docs = await this.saleModel
    .find({ 'soldBy.userId': salesPersonId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('saleNumber createdAt clientName totalAmount currency');
  return docs.map((d) => ({
    id: d.id,
    saleNumber: d.saleNumber,
    createdAt: (d.get('createdAt') as Date).toISOString(),
    clientName: d.clientName,
    totalAmount: d.totalAmount,
    currency: d.currency as Currency,
  }));
}
```

## Step 5 — Controller

**File:** `backend/src/dashboard/dashboard.controller.ts`

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type DashboardSalesTimeseriesResponse,
  type DashboardSummaryResponse,
  type Role,
} from '@base-dashboard/shared';
import {
  dashboardSalesTimeseriesQuerySchema,
  type DashboardSalesTimeseriesQuery,
} from './dto/dashboard-sales-timeseries-query.dto';

@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('admin', 'salesPerson', 'user')
  async getSummary(
    @CurrentUser() user: { userId: string; role: Role },
  ): Promise<DashboardSummaryResponse> {
    return this.dashboardService.findSummary({
      userId: user.userId,
      role: user.role,
    });
  }

  @Get('sales-timeseries')
  @Roles('admin', 'salesPerson')
  async getSalesTimeseries(
    @Query(new ZodValidationPipe(dashboardSalesTimeseriesQuerySchema))
    query: DashboardSalesTimeseriesQuery,
    @CurrentUser() user: { userId: string; role: Role },
  ): Promise<DashboardSalesTimeseriesResponse> {
    return this.dashboardService.findSalesTimeseries(
      { userId: user.userId, role: user.role },
      query.range,
    );
  }
}
```

**Why these route paths:**

- `GET /api/dashboard/summary` and `GET /api/dashboard/sales-timeseries` — **kebab-case** for multi-word segments (per CLAUDE.md route conventions). The dashboard is *not* a REST collection of `Dashboard` resources, so neither endpoint is `/api/dashboards`; the noun is the surface, not a resource type.

**Why these method names:**

- `getSummary` and `getSalesTimeseries` — `get<Noun>` is explicitly listed as the controller pattern for "Read-only endpoints that aren't standard CRUD `find*`". The lint ban list for controllers is `list|add|edit|delete|destroy|fetch` + capital — `get` is NOT in the ban list.

> CLAUDE.md (controller naming table): "`get<Noun>()` — `getMe()`, `getHealth()` — Read-only endpoints that aren't standard CRUD `find*`."
> CLAUDE.md: "**Authentication:** Global `JwtAuthGuard` protects all routes by default."
> CLAUDE.md: "**Authorization:** `@Roles('admin')` + `@UseGuards(RolesGuard)` for role-restricted endpoints."
> CLAUDE.md: "All controller methods must have explicit return types."
> CLAUDE.md: "Validation uses **Zod schemas from `@base-dashboard/shared`** with `ZodValidationPipe` applied per-param."
> CLAUDE.md: "No response envelope. Endpoints return the typed resource directly." — `DashboardSummaryResponse` is the typed payload.

## Step 6 — Module wiring

**File:** `backend/src/dashboard/dashboard.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { CommissionsModule } from '../commissions/commissions.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name, schema: SaleSchema },
      { name: Client.name, schema: ClientSchema },
    ]),
    CommissionsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

Re-registering `Sale` and `Client` in this module's `MongooseModule.forFeature` is fine — Mongoose schema registration is idempotent at the model-registry level. Same pattern is used in [commissions.module.ts](backend/src/commissions/commissions.module.ts).

**File:** [backend/src/app.module.ts](backend/src/app.module.ts)

Add `DashboardModule` to the `imports` array. Place it next to `CommissionsModule` for cohesion (existing order is loose; just keep it adjacent to other read-only report modules).

## Step 7 — Tests

**File:** `backend/src/dashboard/dashboard.service.spec.ts`

Reference: [backend/src/commissions/commissions.service.spec.ts](backend/src/commissions/commissions.service.spec.ts) and [backend/src/users/users.service.spec.ts](backend/src/users/users.service.spec.ts) for the `getModelToken` + plain-object-mock pattern.

> CLAUDE.md: "Mock dependencies as plain objects with `jest.fn()` methods, then provide them with `{ provide: ServiceClass, useValue: mockObject }`. Do NOT use `jest.Mocked<Partial<T>>` for typing — it causes TS errors with complex NestJS types."
> CLAUDE.md: "When building a new feature, always write unit tests for the service layer."

Mocks needed:

```ts
const mockSaleModel = {
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
  // mock find().sort().limit().select() as a chainable
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn(),  // resolved per-test
  }),
  distinct: jest.fn(),
};
const mockClientModel = { countDocuments: jest.fn() };
const mockCommissionsService = { findReport: jest.fn() };
```

Provide via:

```ts
{ provide: getModelToken(Sale.name), useValue: mockSaleModel },
{ provide: getModelToken(Client.name), useValue: mockClientModel },
{ provide: CommissionsService, useValue: mockCommissionsService },
```

### Required test cases

`describe('findSummary')`:

1. **`role === 'user'` → returns `{ role: 'user' }` and calls no DB methods.** Assert `saleModel.aggregate`, `clientModel.countDocuments`, `commissionsService.findReport` are all unused.
2. **`role === 'salesPerson'` → returns the sales-person shape with all eight fields populated.** Stub each helper's underlying mock to a fixture; assert the returned object includes `revenueCurrent`, `revenuePrevious`, `saleCountCurrent`, `saleCountPrevious`, `myClientsCount`, `projectedCommission`, `recentSales`, and `role: 'salesPerson'`.
3. **`role === 'salesPerson'` scopes its queries by `userId`.** Assert `commissionsService.findReport` is called with `(currentFrom, currentTo, actor.userId)` (third arg present), and that the `aggregate` `$match` stage includes `'soldBy.userId': actor.userId`.
4. **`role === 'admin'` → returns the admin shape and does NOT scope by userId.** Assert `commissionsService.findReport` called with no third arg (or `undefined`), and the per-currency aggregate `$match` does not include `'soldBy.userId'`.
5. **`topSalesPeople` is sorted by `totalAmount` desc and capped at 10.** Feed `findReport` 12 rows out of order; assert the result is the top 10 in descending revenue order.

`describe('findSalesTimeseries')`:

1. **Window length matches `range`.** For each of `'7d'`, `'30d'`, `'90d'`, assert the `$match.createdAt.$gte` is approximately `now - N*24h` (allow a 1-second tolerance for clock drift).
2. **`currency: 'USD'` is hard-coded in both the `$match` and the response.** Verify `$match.currency === 'USD'` and the returned object has `currency: 'USD'`.
3. **Sales-person scoping.** When `actor.role === 'salesPerson'`, the `$match` includes `'soldBy.userId': actor.userId`. When `actor.role === 'admin'`, it does not.
4. **Backfill produces exactly N points (one per day in the range).** With `range: '7d'` and an empty aggregate result, the response has `points.length === 7` and every `total === 0`.
5. **Backfill preserves real values and zero-fills around them.** Aggregate returns one fixture row at a known mid-range date; assert that exact date appears with the fixture values and the surrounding days are zeros.

Do **not** test the controller directly.

> CLAUDE.md: "Do NOT test controllers directly — they are thin wrappers."

## Step 8 — Verify

Run from the repo root:

- `pnpm --filter base-dashboard-backend lint`
- `pnpm --filter base-dashboard-backend test`
- `pnpm --filter base-dashboard-backend build`

> CLAUDE.md: "**Build check:** Run `pnpm run build` in both packages before considering work complete."

Smoke-test once with curl while the dev server is up:

```bash
# Replace TOKEN with an admin access token from /api/auth/login
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/dashboard/summary"

# And the timeseries endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/dashboard/sales-timeseries?range=30d"
```

Expected for admin: `{ "role": "admin", "revenueCurrent": [...], ... }`. Hitting `/sales-timeseries` with a plain-`user` token should return 403. Hitting `/summary` with a plain-`user` token should return `{ "role": "user" }`.
