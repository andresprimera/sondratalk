# Commissions — Backend Plan

**Prerequisite:** the shared contract from [overview.md](overview.md) (`commissionReportQuerySchema`, `commissionReportResponseSchema`, etc.) is implemented and exported from `@base-dashboard/shared`.

## Module layout

Create `backend/src/commissions/` with:

- `commissions.module.ts`
- `commissions.controller.ts`
- `commissions.service.ts`
- `dto/commission-report-query.dto.ts` (re-exports from `@base-dashboard/shared`)
- `commissions.service.spec.ts`

> CLAUDE.md: "Feature-based modules: each feature gets its own folder with `module`, `controller`, `service`, `dto/`, `schemas/`, `guards/`, `decorators/`, `strategies/` as needed."

**Reference module to mirror:** [backend/src/sales/](backend/src/sales/) — same pattern, but `commissions` does **not** own a Mongoose schema; it consumes the `Sale` model from the sales module.

## Step 1 — Reuse the existing Sale schema (no new schema)

The commissions feature reads from the `Sale` collection only. Do **not** create a new Mongoose schema. The relevant existing schema is [backend/src/sales/schemas/sale.schema.ts](backend/src/sales/schemas/sale.schema.ts).

Key facts the aggregation depends on:

- `Sale` has `timestamps: true` → `createdAt` is auto-populated as a `Date`.
- `SaleSchema.index({ createdAt: -1 })` already exists; no new index required.
- `Sale.soldBy` is an embedded document `{ userId: string, name: string }` — note that `userId` is **stored as a string**, not an ObjectId. The aggregation must cast it with `$toObjectId` before joining `users`.
- `Sale.totalAmount` is a positive number; `Sale.currency` is a per-sale string (e.g. `"USD"`, `"VES"`).

> CLAUDE.md: "Always enable `{ timestamps: true }` on schemas." (already true for `Sale`)

## Step 2 — DTO

**File:** `backend/src/commissions/dto/commission-report-query.dto.ts`

```ts
export {
  commissionReportQuerySchema,
  type CommissionReportQuery,
} from '@base-dashboard/shared';
```

> CLAUDE.md: "Backend DTO files (`backend/src/<feature>/dto/`) **re-export** from shared — they never redefine the same schema."

## Step 3 — Service

**File:** `backend/src/commissions/commissions.service.ts`

Inject the existing `Sale` model via `@InjectModel(Sale.name)`. Use `private readonly logger = new Logger(CommissionsService.name)`.

> CLAUDE.md: "Use the **NestJS `Logger`** class for all log output."
> CLAUDE.md: "Each service creates its own logger instance: `private readonly logger = new Logger(ClassName.name)`."

### Methods

Only one public method is needed.

| Method | Signature | Purpose |
|---|---|---|
| `findReport` | `findReport(from: Date, to: Date): Promise<CommissionReportRow[]>` | Run the aggregation pipeline and return the rows. |

> CLAUDE.md service-naming table: "`findBy<Field>(value)` — Fetch one record by a specific field." We're not strictly fetching by a single field, so `findReport` is the closest non-CRUD read name. The banned prefixes (lint-enforced via `backend/eslint.config.mjs`) are `get|fetch|add|delete|destroy|set|list|edit` + capital — `findReport` is allowed.

### Implementation sketch

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sale } from '../sales/schemas/sale.schema';
import type {
  Currency,
  CommissionReportRow,
} from '@base-dashboard/shared';

const DEFAULT_COMMISSION_PERCENTAGE = 3;

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(@InjectModel(Sale.name) private saleModel: Model<Sale>) {}

  async findReport(from: Date, to: Date): Promise<CommissionReportRow[]> {
    const pipeline = [
      { $match: { createdAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: { userId: '$soldBy.userId', currency: '$currency' },
          totalAmount: { $sum: '$totalAmount' },
          saleCount: { $sum: 1 },
        },
      },
      { $addFields: { _userObjectId: { $toObjectId: '$_id.userId' } } },
      {
        $lookup: {
          from: 'users',
          localField: '_userObjectId',
          foreignField: '_id',
          as: 'user',
        },
      },
      // No preserveNullAndEmptyArrays: rows whose sales person was deleted are dropped.
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          salesPersonId: '$_id.userId',
          salesPersonName: '$user.name',
          currency: '$_id.currency',
          totalAmount: { $round: ['$totalAmount', 2] },
          saleCount: 1,
          commissionPercentage: {
            $ifNull: ['$user.commissionPercentage', DEFAULT_COMMISSION_PERCENTAGE],
          },
          commissionAmount: {
            $round: [
              {
                $multiply: [
                  '$totalAmount',
                  {
                    $divide: [
                      {
                        $ifNull: [
                          '$user.commissionPercentage',
                          DEFAULT_COMMISSION_PERCENTAGE,
                        ],
                      },
                      100,
                    ],
                  },
                ],
              },
              2,
            ],
          },
        },
      },
      { $sort: { salesPersonName: 1, currency: 1 } },
    ];

    const rows = await this.saleModel.aggregate<{
      salesPersonId: string;
      salesPersonName: string;
      currency: string;
      totalAmount: number;
      saleCount: number;
      commissionPercentage: number;
      commissionAmount: number;
    }>(pipeline);

    return rows.map((r) => ({
      ...r,
      currency: r.currency as Currency,
    }));
  }
}
```

**Notes:**

- The `as Currency` cast is the one allowed exception: Mongo aggregation returns `string` for the currency field, and we know it was stored as a `Currency` enum value.
  > CLAUDE.md: "**No type assertions** (`as`)... Exception: Mongoose enum fields return `string` — cast to the shared union type." — this is the analogous case at the aggregation boundary.
- `$round: [..., 2]` keeps amounts to 2 decimals so the frontend doesn't have to deal with floating-point cruft like `0.30000000000000004`.
- Do **not** add fallback empty-array handling, no try/catch swallowing — let Mongoose errors propagate to the global filter.
  > CLAUDE.md: "Don't add error handling, fallbacks, or validation for scenarios that can't happen."

### Date guard

In `findReport`, before calling aggregate, throw `BadRequestException` if `from >= to`. This is a real user-facing case (UI bug or hand-crafted query) — validate at the system boundary.

> CLAUDE.md: "Only validate at system boundaries (user input, external APIs)."

```ts
if (from >= to) {
  throw new BadRequestException('"from" must be earlier than "to"');
}
```

## Step 4 — Controller

**File:** `backend/src/commissions/commissions.controller.ts`

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type CommissionReportResponse,
  type CommissionReportRow,
} from '@base-dashboard/shared';
import {
  commissionReportQuerySchema,
  type CommissionReportQuery,
} from './dto/commission-report-query.dto';

@Controller('commissions')
@UseGuards(RolesGuard)
@Roles('admin')
export class CommissionsController {
  constructor(private commissionsService: CommissionsService) {}

  @Get('report')
  async findReport(
    @Query(new ZodValidationPipe(commissionReportQuerySchema))
    query: CommissionReportQuery,
  ): Promise<CommissionReportResponse> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const rows: CommissionReportRow[] = await this.commissionsService.findReport(
      from,
      to,
    );
    return { from: query.from, to: query.to, rows };
  }
}
```

**Why `GET /api/commissions/report` and not `GET /api/commissions`:**

- Per CLAUDE.md, plain `findAll()` is for paginated resource collections (`/api/users`, `/api/projects`). A computed report is **not** a collection of `Commission` resources — there is no `Commission` entity. `report` makes that clear.
- The controller method `findReport` matches the service method name and is **not** banned: the lint rule bans controller method prefixes `list|add|edit|delete|destroy|fetch` + capital. `findReport` is fine.

> CLAUDE.md: "**Authorization:** `@Roles('admin')` + `@UseGuards(RolesGuard)` for role-restricted endpoints."
> CLAUDE.md: "All controller methods must have explicit return types."
> CLAUDE.md: "Validation uses **Zod schemas from `@base-dashboard/shared`** with `ZodValidationPipe` applied per-param."
> CLAUDE.md: "No response envelope. Endpoints return the typed resource directly." — `CommissionReportResponse` is the typed payload; we are not wrapping it in `{ data: T }`.

## Step 5 — Module wiring

**File:** `backend/src/commissions/commissions.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sale.name, schema: SaleSchema }]),
  ],
  controllers: [CommissionsController],
  providers: [CommissionsService],
})
export class CommissionsModule {}
```

> Note: we register the `Sale` model in this module's `MongooseModule.forFeature` so we can inject it directly. This is fine to do in two modules — Mongoose schema registration is idempotent at the model-registry level.

**File:** `backend/src/app.module.ts`

Add `CommissionsModule` to the `imports` array (alphabetical placement: between `ClientsModule` and `InventoryModule` matches the existing flexible ordering — append it next to `SalesModule` for cohesion).

## Step 6 — Tests

**File:** `backend/src/commissions/commissions.service.spec.ts`

Reference: [backend/src/users/users.service.spec.ts](backend/src/users/users.service.spec.ts) for the `getModelToken` + plain-object-mock pattern.

> CLAUDE.md: "Mock dependencies as plain objects with `jest.fn()` methods, then provide them with `{ provide: ServiceClass, useValue: mockObject }`. Do NOT use `jest.Mocked<Partial<T>>` for typing — it causes TS errors with complex NestJS types."
> CLAUDE.md: "When building a new feature, always write unit tests for the service layer."

The mock model only needs `aggregate: jest.fn()`.

Required test cases (one `describe('findReport')`):

1. **Throws `BadRequestException` when `from >= to`** — assert the model's `aggregate` is never called.
2. **Calls `aggregate` with the expected `$match` window** — verify the first stage is `{ $match: { createdAt: { $gte: from, $lt: to } } }` (use `expect.arrayContaining` / `expect.objectContaining` rather than asserting the entire pipeline string-by-string, so the test is not brittle to harmless reordering).
3. **Returns mapped rows with the `Currency` cast applied** — feed the mock `aggregate` a fixture array and assert the service returns it untouched (the cast is a type-only change at runtime).
4. **Returns an empty array when the aggregation returns nothing** — `aggregate` resolves to `[]`, service returns `[]`.

Do **not** test the controller directly.

> CLAUDE.md: "Do NOT test controllers directly — they are thin wrappers."

## Step 7 — Verify

Run from the repo root:

- `pnpm --filter base-dashboard-backend lint`
- `pnpm --filter base-dashboard-backend test`
- `pnpm --filter base-dashboard-backend build`

> CLAUDE.md: "**Build check:** Run `pnpm run build` in both packages before considering work complete."

Then smoke-test once with curl while the dev server is up:

```bash
# Replace TOKEN with an admin access token from /api/auth/login
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/commissions/report?from=2026-04-01T00:00:00.000Z&to=2026-05-01T00:00:00.000Z"
```

Expected: `{ "from": "...", "to": "...", "rows": [...] }`. Hitting the endpoint with a non-admin token should return 403.
