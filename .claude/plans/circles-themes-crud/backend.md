# Themes + Circles — Backend Plan

**Prerequisite:** [shared.md](shared.md) is complete and `pnpm --filter base-dashboard-backend typecheck` passes.

**Reference module to mirror:** [backend/src/users/](backend/src/users/) — module, controller, service, dto/, schemas/. Closest analogue.

**Reference test file to mirror:** [backend/src/users/users.service.spec.ts](backend/src/users/users.service.spec.ts) — model + chainable mock pattern.

**Conventions that apply (CLAUDE.md, in order):**

> "Feature-based modules: each feature gets its own folder with `module`, `controller`, `service`, `dto/`, `schemas/`, `guards/`, `decorators/`, `strategies/` as needed."

> "All routes are under the `/api` global prefix."

> "All routes are JWT-protected by default (global `JwtAuthGuard`). Use `@Public()` to opt out."

> "Use NestJS `@Schema()` and `@Prop()` decorators with `SchemaFactory.createForClass()`."

> "Always enable `{ timestamps: true }` on schemas."

> "Export both the class and the schema constant. Export a `Document` type: `export type UserDocument = HydratedDocument<User>`."

> "Validation uses **Zod schemas from `@base-dashboard/shared`** with `ZodValidationPipe` applied per-param."

> "Backend DTO files re-export schemas and types from shared."

> "Use the **NestJS `Logger`** class (`console.*` is a lint error). Each service creates its own logger instance: `private readonly logger = new Logger(ClassName.name)`."

> "All controller methods must have explicit return types — `Promise<User>`, `Promise<AuthResponse>`, `Promise<PaginatedResponse<T>>`, or `Promise<void>`."

> "When building a new feature, always write unit tests for the service layer."

The CRUD method names below come from CLAUDE.md's controller and service tables. Use these **exact** names:

> Controller: `findAll()`, `findOne()`, `create()`, `update()`, `remove()` for standard CRUD; `<verb><Noun>()` for non-CRUD actions.

> Service: `create(dto)`, `findAllPaginated(page, limit)`, `findById(id)`, `update(id, dto)`, `remove(id)`. Use `findBy<Field>Exists(value)` for boolean existence checks.

---

## Slice A — `themes` module

The simpler of the two — no FK, no search. Ship this first to get the CRUD shape right, then `circles` reuses it.

### A.1 — Mongoose schema

**File to create:** `backend/src/themes/schemas/theme.schema.ts`

Mirror [backend/src/users/schemas/user.schema.ts](backend/src/users/schemas/user.schema.ts). Skeleton:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ThemeDocument = HydratedDocument<Theme>;

@Schema({ timestamps: true })
export class Theme {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, default: 0 })
  sortOrder: number;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);
```

No additional indexes beyond the implicit unique index on `slug`.

### A.2 — DTO barrel

**File to create:** `backend/src/themes/dto/index.ts`

```ts
export {
  createThemeSchema,
  type CreateThemeInput,
  updateThemeSchema,
  type UpdateThemeInput,
} from '@base-dashboard/shared';
```

### A.3 — Service

**File to create:** `backend/src/themes/themes.service.ts`

Inject the model, add a logger. Implement these methods exactly:

| Method | Signature | Behavior |
|---|---|---|
| `create` | `create(dto: CreateThemeInput): Promise<ThemeDocument>` | `this.themeModel.create(dto)`. Mongoose throws on unique violation; controller translates to `ConflictException`. |
| `findAll` | `findAll(): Promise<ThemeDocument[]>` | `this.themeModel.find().sort({ sortOrder: 1, label: 1 })`. Used by `circles` admin UI to populate the theme picker — returns ALL themes unpaginated since the count is small. |
| `findAllPaginated` | `findAllPaginated(page: number, limit: number): Promise<{ data: ThemeDocument[]; total: number }>` | Skip/limit + `countDocuments()`. See user-service pattern. |
| `findById` | `findById(id: string): Promise<ThemeDocument \| null>` | `this.themeModel.findById(id)`. Controller throws `NotFoundException` on null. |
| `findBySlugExists` | `findBySlugExists(slug: string): Promise<boolean>` | `this.themeModel.exists({ slug }).then((r) => r !== null)`. Used by controller for pre-create slug check. |
| `update` | `update(id: string, dto: UpdateThemeInput): Promise<ThemeDocument \| null>` | `this.themeModel.findByIdAndUpdate(id, dto, { new: true })`. |
| `remove` | `remove(id: string): Promise<void>` | `this.themeModel.findByIdAndDelete(id)`. |

`findAll()` (unpaginated) and `findAllPaginated()` are both needed — the admin themes page uses paginated, but the circles dialog needs the full list to populate a `<Select>`. CLAUDE.md naming table allows both; just append `Paginated` to distinguish them:

> "Append `Paginated` to distinguish paginated from unpaginated variants: `findAll()` vs `findAllPaginated()`."

### A.4 — Controller

**File to create:** `backend/src/themes/themes.controller.ts`

Route base: `@Controller('themes')`. **All endpoints admin-only.**

| Decorator | Method | Signature |
|---|---|---|
| `@Post()` | `create` | `create(@Body(new ZodValidationPipe(createThemeSchema)) dto: CreateThemeInput): Promise<Theme>` |
| `@Get()` | `findAll` | `findAll(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery): Promise<PaginatedResponse<Theme>>` |
| `@Get('all')` | `findAllUnpaginated` | `findAllUnpaginated(): Promise<Theme[]>` — used by circles dialog. |
| `@Get(':id')` | `findOne` | `findOne(@Param('id') id: string): Promise<Theme>` |
| `@Patch(':id')` | `update` | `update(@Param('id') id: string, @Body(new ZodValidationPipe(updateThemeSchema)) dto: UpdateThemeInput): Promise<Theme>` |
| `@Delete(':id')` + `@HttpCode(HttpStatus.NO_CONTENT)` | `remove` | `remove(@Param('id') id: string): Promise<void>` |

Apply admin guards to **the class**:

```ts
@Controller('themes')
@UseGuards(RolesGuard)
@Roles('admin')
export class ThemesController { ... }
```

This applies the role check to every method. (See `users.controller.ts` for the per-method version; class-level is cleaner here since there are no per-user endpoints to interleave.)

> CLAUDE.md: "Action-only endpoints return 204 No Content … Use `@HttpCode(HttpStatus.NO_CONTENT)` on the controller and `Promise<void>` return type."

Controller returns plain entity shapes — map the Mongoose document into the `Theme` API shape:

```ts
function toTheme(doc: ThemeDocument): Theme {
  return {
    id: doc.id,
    slug: doc.slug,
    label: doc.label,
    sortOrder: doc.sortOrder,
  };
}
```

For `create`: pre-check `findBySlugExists`. If true, throw `new ConflictException('Slug already in use')`. Then call `service.create(dto)`. (Mongoose's E11000 error works too, but the explicit check matches the user-controller pattern and gives a typed message.)

For `findOne`/`update`: if service returns `null`, throw `new NotFoundException('Theme not found')`.

For `findAllPaginated` controller wrapper, build the `PaginatedResponse<Theme>` shape (see user-controller `findAll` lines 138-160):

```ts
return {
  data: data.map(toTheme),
  meta: {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  },
};
```

### A.5 — Module

**File to create:** `backend/src/themes/themes.module.ts`

Mirror [backend/src/users/users.module.ts](backend/src/users/users.module.ts). Export the service so the `circles` module can validate `themeId` references:

```ts
@Module({
  imports: [MongooseModule.forFeature([{ name: Theme.name, schema: ThemeSchema }])],
  controllers: [ThemesController],
  providers: [ThemesService],
  exports: [ThemesService],
})
export class ThemesModule {}
```

### A.6 — Wire into `AppModule`

**File to modify:** `backend/src/app.module.ts`

Add `ThemesModule` to the `imports` array between `UsersModule` and `SeederModule` (alphabetical-ish; the existing modules aren't strictly sorted but keep it readable).

### A.7 — Service tests

**File to create:** `backend/src/themes/themes.service.spec.ts`

Mirror [backend/src/users/users.service.spec.ts](backend/src/users/users.service.spec.ts). One `describe` per service method. Mock the model per CLAUDE.md:

> "For Mongoose models, provide `{ provide: getModelToken(Entity.name), useValue: mockModel }` where `mockModel` is a plain object with `jest.fn()` methods like `create`, `find`, `findOne`, `findById`, `findByIdAndUpdate`, `findByIdAndDelete`, `countDocuments`, `exists`."

> "For Mongoose query chains (`.find().skip().limit()`), mock as chainable objects."

> "Mock dependencies as plain objects with `jest.fn()` methods. … Do NOT use `jest.Mocked<Partial<T>>` for typing."

Cases per method:

- `create` — happy path returns the created doc.
- `findAll` — returns sorted documents; chain mock for `.find().sort()`.
- `findAllPaginated` — page 1 → `skip(0)`; page 2 with limit 10 → `skip(10)`; returns `{ data, total }`.
- `findById` — returns doc when found; returns `null` when not found.
- `findBySlugExists` — returns `true` when `exists()` resolves to a document, `false` when it resolves to `null`.
- `update` — returns updated doc with `{ new: true }`; returns `null` when not found.
- `remove` — calls `findByIdAndDelete` with the id.

### A.8 — Verify slice A

```bash
pnpm --filter base-dashboard-backend lint
pnpm --filter base-dashboard-backend typecheck
pnpm --filter base-dashboard-backend test
```

All three pass before starting slice B.

---

## Slice B — `circles` module

Same shape as themes, plus: FK to `themes`, `searchTerms` denormalization, indexed search endpoint.

### B.1 — Mongoose schema

**File to create:** `backend/src/circles/schemas/circle.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CircleDocument = HydratedDocument<Circle>;

@Schema({ _id: false })
class CircleLabels {
  @Prop({ required: true, trim: true })
  en: string;

  @Prop({ required: true, trim: true })
  es: string;
}
const CircleLabelsSchema = SchemaFactory.createForClass(CircleLabels);

@Schema({ _id: false })
class CircleAliases {
  @Prop({ type: [String], default: [] })
  en: string[];

  @Prop({ type: [String], default: [] })
  es: string[];
}
const CircleAliasesSchema = SchemaFactory.createForClass(CircleAliases);

@Schema({ timestamps: true })
export class Circle {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Theme', required: true, index: true })
  themeId: Types.ObjectId;

  @Prop({ type: CircleLabelsSchema, required: true })
  labels: CircleLabels;

  @Prop({ type: CircleAliasesSchema, default: () => ({ en: [], es: [] }) })
  aliases: CircleAliases;

  @Prop({ type: [String], default: [] })
  searchTerms: string[];

  @Prop({ required: true, default: 0, min: 0 })
  popularity: number;
}

export const CircleSchema = SchemaFactory.createForClass(Circle);

// Indexes — see overview.md for rationale
CircleSchema.index({ searchTerms: 'text' });
CircleSchema.index({ themeId: 1, popularity: -1 });
```

**Locale fields are explicit (`en`, `es`)** in the Mongoose subdocument — this is intentional. Mongoose doesn't play well with dynamic `Map`-shaped locale fields (poor index support, awkward population). When you add a new locale, update both this Mongoose subdocument **and** `LOCALE_KEYS` in `shared/src/schemas/circle.ts`. Document this in the file as a comment so the next person knows.

### B.2 — DTO barrel

**File to create:** `backend/src/circles/dto/index.ts`

```ts
export {
  createCircleSchema,
  type CreateCircleInput,
  updateCircleSchema,
  type UpdateCircleInput,
  circleSearchQuerySchema,
  type CircleSearchQuery,
} from '@base-dashboard/shared';
```

### B.3 — `searchTerms` builder helper

**File to create:** `backend/src/circles/utils/build-search-terms.ts`

Pure function. Takes labels + aliases, returns the deduplicated, lowercased, accent-stripped array.

```ts
import { LOCALE_KEYS } from '@base-dashboard/shared';

type Labels = Record<string, string>;
type Aliases = Record<string, string[]>;

export function buildSearchTerms(labels: Labels, aliases?: Aliases): string[] {
  const terms = new Set<string>();
  for (const locale of LOCALE_KEYS) {
    const label = labels[locale];
    if (label) terms.add(normalize(label));
    const list = aliases?.[locale] ?? [];
    for (const a of list) {
      if (a) terms.add(normalize(a));
    }
  }
  return Array.from(terms);
}

function normalize(input: string): string {
  return input
    .normalize('NFD')                  // separate combining marks
    .replace(/\p{Diacritic}/gu, '')    // strip them
    .toLowerCase()
    .trim();
}
```

**File to create:** `backend/src/circles/utils/build-search-terms.spec.ts`

Cases:
- `buildSearchTerms({ en: "German Shepherd", es: "Pastor Alemán" }, { en: ["GSD"], es: [] })` → contains `"german shepherd"`, `"gsd"`, `"pastor aleman"`. Length 3.
- Empty aliases handled.
- Duplicate terms across locales deduped.
- Accent-stripping confirmed for Spanish (`á`, `é`, `í`, `ó`, `ú`, `ñ`).

### B.4 — Service

**File to create:** `backend/src/circles/circles.service.ts`

Inject the `Circle` model and a `Logger`. Methods:

| Method | Signature | Notes |
|---|---|---|
| `create` | `create(dto: CreateCircleInput): Promise<CircleDocument>` | Build `searchTerms` via `buildSearchTerms(dto.labels, dto.aliases)` and persist. |
| `findAllPaginated` | `findAllPaginated(page: number, limit: number, themeId?: string): Promise<{ data: CircleDocument[]; total: number }>` | If `themeId` provided, filter on it (uses the compound index). Sort by `popularity: -1, slug: 1`. |
| `searchPaginated` | `searchPaginated(q: string, page: number, limit: number, themeId?: string): Promise<{ data: CircleDocument[]; total: number }>` | Builds a `$text` query on the normalized `q`; combines with `themeId` filter if present. Sort: `{ score: { $meta: 'textScore' }, popularity: -1 }`. Project `score`. |
| `findById` | `findById(id: string): Promise<CircleDocument \| null>` | Plain `findById`. |
| `findBySlugExists` | `findBySlugExists(slug: string): Promise<boolean>` | Pre-create slug check. |
| `update` | `update(id: string, dto: UpdateCircleInput): Promise<CircleDocument \| null>` | If `labels` or `aliases` changed, rebuild `searchTerms` (see below). |
| `remove` | `remove(id: string): Promise<void>` | `findByIdAndDelete`. |

**Critical detail in `update`:** if the dto includes `labels` or `aliases`, the service must merge against the existing document and rebuild `searchTerms` before persisting. Sketch:

```ts
async update(id: string, dto: UpdateCircleInput): Promise<CircleDocument | null> {
  if (dto.labels === undefined && dto.aliases === undefined) {
    return this.circleModel.findByIdAndUpdate(id, dto, { new: true });
  }
  const existing = await this.circleModel.findById(id);
  if (!existing) return null;
  const labels = dto.labels ?? existing.labels;
  const aliases = dto.aliases ?? existing.aliases;
  const searchTerms = buildSearchTerms(labels, aliases);
  return this.circleModel.findByIdAndUpdate(
    id,
    { ...dto, searchTerms },
    { new: true },
  );
}
```

**Normalize `q` for search:** `searchPaginated` should NFD-strip + lowercase the query before passing to `$text`. The same `normalize` helper from `build-search-terms.ts` can be exported and reused — that way query and stored terms go through identical processing.

### B.5 — Controller

**File to create:** `backend/src/circles/circles.controller.ts`

Route base: `@Controller('circles')`. **All endpoints admin-only** — same class-level decorator pattern as `themes`.

| Decorator | Method | Signature |
|---|---|---|
| `@Post()` | `create` | `create(@Body(new ZodValidationPipe(createCircleSchema)) dto: CreateCircleInput): Promise<Circle>` — pre-check slug, throw `ConflictException`. Validate `themeId` exists by calling `themesService.findById`; throw `BadRequestException('Theme not found')` if it doesn't. |
| `@Get()` | `findAll` | `findAll(@Query(new ZodValidationPipe(circleSearchQuerySchema)) query: CircleSearchQuery): Promise<PaginatedResponse<Circle>>` — branches on `query.q`: empty → `service.findAllPaginated(page, limit, themeId)`; non-empty → `service.searchPaginated(q, page, limit, themeId)`. |
| `@Get(':id')` | `findOne` | `findOne(@Param('id') id: string): Promise<Circle>` |
| `@Patch(':id')` | `update` | `update(@Param('id') id: string, @Body(new ZodValidationPipe(updateCircleSchema)) dto: UpdateCircleInput): Promise<Circle>` — if `themeId` changes, validate against `themesService`. |
| `@Delete(':id')` + `@HttpCode(HttpStatus.NO_CONTENT)` | `remove` | `remove(@Param('id') id: string): Promise<void>` |

Map `CircleDocument` → `Circle` API shape (drop `searchTerms`, stringify `themeId`):

```ts
function toCircle(doc: CircleDocument): Circle {
  return {
    id: doc.id,
    slug: doc.slug,
    themeId: doc.themeId.toString(),
    labels: { en: doc.labels.en, es: doc.labels.es },
    aliases: { en: doc.aliases.en, es: doc.aliases.es },
    popularity: doc.popularity,
  };
}
```

### B.6 — Module

**File to create:** `backend/src/circles/circles.module.ts`

```ts
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Circle.name, schema: CircleSchema }]),
    ThemesModule,  // for ThemesService — validates themeId on create/update
  ],
  controllers: [CirclesController],
  providers: [CirclesService],
  exports: [CirclesService],
})
export class CirclesModule {}
```

### B.7 — Wire into `AppModule`

**File to modify:** `backend/src/app.module.ts`

Add `CirclesModule` to imports after `ThemesModule`.

### B.8 — Service tests

**File to create:** `backend/src/circles/circles.service.spec.ts`

Mirror the user-service spec pattern. One `describe` per method. Mock both the `Circle` model and (for `update`) the chained `findById` then `findByIdAndUpdate` flow.

Cases:

- `create` — calls `model.create` with dto + `searchTerms` array built from labels and aliases.
- `findAllPaginated` — without `themeId`, filter is `{}`; with `themeId`, filter is `{ themeId }`. Skip/limit chain. Sort by `{ popularity: -1, slug: 1 }`.
- `searchPaginated` — query includes `{ $text: { $search: <normalized q> } }`. With `themeId`, includes both. Sort uses `{ score: { $meta: 'textScore' }, popularity: -1 }`.
- `findById` — returns doc or null.
- `findBySlugExists` — true/false based on `exists` mock.
- `update` without label/alias changes — calls `findByIdAndUpdate` with dto unchanged.
- `update` with labels changed — fetches existing, merges, rebuilds `searchTerms`, updates.
- `update` returns null if existing doc not found.
- `remove` — calls `findByIdAndDelete`.

### B.9 — Verify slice B

```bash
pnpm --filter base-dashboard-backend lint
pnpm --filter base-dashboard-backend typecheck
pnpm --filter base-dashboard-backend test
pnpm --filter base-dashboard-backend build
```

All four pass. Build is the strictest check — `nest build` will catch decorator/DI wiring errors that `tsc --noEmit` lets through.

---

## Manual smoke (optional but recommended)

With both modules wired, hit the endpoints once via curl or your HTTP client of choice (any admin JWT works):

```bash
# Create a theme
curl -X POST http://localhost:3000/api/themes \
  -H 'Authorization: Bearer <admin-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"slug":"dogs","label":"Dogs","sortOrder":0}'

# Create a circle
curl -X POST http://localhost:3000/api/circles \
  -H 'Authorization: Bearer <admin-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"slug":"german-shepherd","themeId":"<theme-id-from-above>","labels":{"en":"German Shepherd","es":"Pastor Alemán"},"aliases":{"en":["GSD"],"es":[]}}'

# Search in Spanish
curl 'http://localhost:3000/api/circles?q=pastor' -H 'Authorization: Bearer <admin-jwt>'
# Should return the german-shepherd circle.

# Search in English
curl 'http://localhost:3000/api/circles?q=gsd' -H 'Authorization: Bearer <admin-jwt>'
# Should also return the same circle (matches via alias).
```

If both queries return the same circle, the indexing strategy is confirmed working before frontend work begins.

---

## What this slice ships

- Two collections wired up: `themes`, `circles`.
- Six admin-only HTTP endpoints per resource (themes has an extra `GET /api/themes/all` for the picker).
- A working multilingual search endpoint at `GET /api/circles?q=...`.
- Unit-tested services on both sides.
- The `searchTerms` rebuild logic isolated in `utils/build-search-terms.ts`, easy to swap if the indexing strategy changes later.
