# Atlas Search for Circles — Backend Plan

**Prerequisite:** [shared.md](shared.md) is complete and `pnpm --filter base-dashboard-backend typecheck` accepts the updated `circleSearchQuerySchema`.

**Reference files to open before starting:**

- [backend/src/circles/circles.service.ts](backend/src/circles/circles.service.ts) — current `searchPaginated` (Mongo `$text` query) and the `create`/`update` methods that call `buildSearchTerms`.
- [backend/src/circles/circles.controller.ts](backend/src/circles/circles.controller.ts) — current `findAll()` that delegates to `searchPaginated`.
- [backend/src/circles/circles.service.spec.ts](backend/src/circles/circles.service.spec.ts) — test pattern; will be substantially revised in step 6.
- [backend/src/circles/schemas/circle.schema.ts](backend/src/circles/schemas/circle.schema.ts) — currently has `searchTerms: string[]` and `CircleSchema.index({ searchTerms: 'text' })`; both go away.
- [backend/src/circles/utils/build-search-terms.ts](backend/src/circles/utils/build-search-terms.ts) and [backend/src/circles/utils/build-search-terms.spec.ts](backend/src/circles/utils/build-search-terms.spec.ts) — both files get deleted.

**Conventions that apply (CLAUDE.md, in order):**

> "All routes are under the `/api` global prefix."

> "All routes are JWT-protected by default (global `JwtAuthGuard`). Use `@Public()` to opt out."

> "Use NestJS `@Schema()` and `@Prop()` decorators with `SchemaFactory.createForClass()`."

> "Always enable `{ timestamps: true }` on schemas."

> "Validation uses **Zod schemas from `@base-dashboard/shared`** with `ZodValidationPipe` applied per-param."

> "Backend DTO files re-export schemas and types from shared."

> "Use the **NestJS `Logger`** class (`console.*` is a lint error)."

> "All controller methods must have explicit return types."

> "When building a new feature, always write unit tests for the service layer."

> "Mock dependencies as plain objects with `jest.fn()` methods, then provide them with `{ provide: ServiceClass, useValue: mockObject }`. Do NOT use `jest.Mocked<Partial<T>>` for typing."

The lint/TypeScript baseline (no `any`, no `as` outside documented exceptions, no `console.*`, kebab-case filenames, etc.) is auto-enforced by `pnpm --filter base-dashboard-backend lint`. The plan does not restate every lint rule.

---

## Step 1 — Delete the superseded plan

```sh
rm -rf .claude/plans/circles-meili-search/
```

This is an explicit step rather than housekeeping because the implementing agent should not be confused by a plan documenting an approach we reversed. Run from the repo root.

---

## Step 2 — Drop `searchTerms` from the Mongoose schema

**File to modify:** `backend/src/circles/schemas/circle.schema.ts`

Remove the `searchTerms` `@Prop`, the comment line preceding it (if any), and the corresponding text index. The two compound and single-field indexes that remain are unchanged.

**Before** (snippet):

```ts
  @Prop({ type: [String], default: [] })
  searchTerms: string[];

  @Prop({ required: true, default: 0, min: 0 })
  popularity: number;
}

export const CircleSchema = SchemaFactory.createForClass(Circle);

CircleSchema.index({ searchTerms: 'text' });
CircleSchema.index({ themeId: 1, popularity: -1 });
```

**After**:

```ts
  @Prop({ required: true, default: 0, min: 0 })
  popularity: number;
}

export const CircleSchema = SchemaFactory.createForClass(Circle);

CircleSchema.index({ themeId: 1, popularity: -1 });
```

The unique `slug` index and the single-field `themeId` index declared inline on `@Prop({ ..., unique: true })` and `@Prop({ ..., index: true })` are unchanged.

> CLAUDE.md: "Always enable `{ timestamps: true }` on schemas." — keep the `@Schema({ timestamps: true })` decorator unchanged.

After this edit, the `circles` collection in Mongo will continue to have the legacy `searchTerms` field on existing documents until they're rewritten or migrated. **This is fine** — Mongoose doesn't read it, Atlas Search doesn't index it, and any future reindex of the `circles` collection (via export/reimport, dump, etc.) will drop it. No data migration is required for this slice. If you want to clean up proactively, add a one-shot `db.circles.updateMany({}, { $unset: { searchTerms: "" } })` to your operational notes — out of scope here.

---

## Step 3 — Delete the `buildSearchTerms` helper and its tests

```sh
rm backend/src/circles/utils/build-search-terms.ts
rm backend/src/circles/utils/build-search-terms.spec.ts
```

If `backend/src/circles/utils/` becomes empty after this, also delete the directory:

```sh
rmdir backend/src/circles/utils 2>/dev/null
```

The `normalize()` helper exported from `build-search-terms.ts` is **not used anywhere else** — the new Atlas-based search relies on Atlas's own analyzer chain for normalization. If a future feature needs string normalization, recreate the helper at that point.

---

## Step 4 — Rewrite `CirclesService.searchPaginated()`

**File to modify:** `backend/src/circles/circles.service.ts`

Three changes in this file, all listed below.

### 4a — Remove the `buildSearchTerms` import and the calls

**Before** (top of file):

```ts
import { buildSearchTerms, normalize } from './utils/build-search-terms';
```

**After**: remove the line entirely.

**`create()` before**:

```ts
async create(dto: CreateCircleInput): Promise<CircleDocument> {
  const aliases = dto.aliases ?? { en: [], es: [] };
  const searchTerms = buildSearchTerms(dto.labels, aliases);
  return this.circleModel.create({ ...dto, aliases, searchTerms });
}
```

**`create()` after**:

```ts
async create(dto: CreateCircleInput): Promise<CircleDocument> {
  const aliases = dto.aliases ?? { en: [], es: [] };
  return this.circleModel.create({ ...dto, aliases });
}
```

**`update()` before** (the merge branch):

```ts
const labels = dto.labels ?? { en: existing.labels.en, es: existing.labels.es };
const aliases = dto.aliases ?? { en: existing.aliases.en, es: existing.aliases.es };
const searchTerms = buildSearchTerms(labels, aliases);
return this.circleModel.findByIdAndUpdate(
  existing.id,
  { ...dto, searchTerms },
  { new: true },
);
```

**`update()` after**: collapse to the single early-return form, since there's nothing locale-specific to merge anymore. The whole method becomes:

```ts
async update(
  existing: CircleDocument,
  dto: UpdateCircleInput,
): Promise<CircleDocument | null> {
  return this.circleModel.findByIdAndUpdate(existing.id, dto, { new: true });
}
```

The `existing` parameter is now unused inside the method body. Decide between two options:

- **(preferred)** Change the signature back to `update(id: string, dto: UpdateCircleInput)` and update the controller call site (step 5) accordingly. The `existing` parameter was added to avoid a redundant `findById` for the search-terms merge — that need is gone.
- Keep the `existing` parameter for source-API stability and add a comment explaining why it's still there.

Go with the first option. **Service signature reverts to `update(id: string, dto: UpdateCircleInput)`**. Update the controller call site in step 5.

> CLAUDE.md (naming): "`update(id, dto)` — Update multiple fields (general update)."

### 4b — Replace `searchPaginated()` with the `$search` aggregation

**Before** (current implementation reads from `$text` index on `searchTerms`):

```ts
async searchPaginated(
  q: string,
  page: number,
  limit: number,
  themeId?: string,
): Promise<{ data: CircleDocument[]; total: number }> {
  const normalizedQ = normalize(q);
  const filter: FilterQuery<Circle> = {
    $text: { $search: normalizedQ },
    ...(themeId ? { themeId } : {}),
  };
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    this.circleModel
      .find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' }, popularity: -1 })
      .skip(skip)
      .limit(limit),
    this.circleModel.countDocuments(filter),
  ]);
  return { data, total };
}
```

**After**: rewrites to a `$search` + `$searchMeta` parallel aggregation. New signature includes `locale`:

```ts
import { LOCALE_KEYS, type LocaleKey } from '@base-dashboard/shared';
import { Types } from 'mongoose';

// ... existing imports ...

async searchPaginated(
  q: string,
  page: number,
  limit: number,
  locale: LocaleKey,
  themeId?: string,
): Promise<{ data: CircleDocument[]; total: number }> {
  // Defensive — should never happen given the Zod enum on the controller,
  // but interpolating `locale` into the path string makes me want a runtime
  // guard against an out-of-band caller passing a stray value.
  if (!LOCALE_KEYS.includes(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const labelPath = `labels.${locale}`;
  const aliasPath = `aliases.${locale}`;

  const compound = {
    should: [
      { autocomplete: { query: q, path: labelPath } },
      { autocomplete: { query: q, path: aliasPath } },
      { text: { query: q, path: labelPath, fuzzy: { maxEdits: 1 } } },
    ],
    minimumShouldMatch: 1,
    ...(themeId
      ? {
          filter: [
            { equals: { path: 'themeId', value: new Types.ObjectId(themeId) } },
          ],
        }
      : {}),
  };

  const skip = (page - 1) * limit;

  // Run the search and the meta count in parallel. $searchMeta returns
  // { count: { lowerBound: number } } at minimum — Atlas's recommended way
  // to get totals alongside $search. The count is approximate at scale
  // but exact for sub-thousand-document collections like ours.
  const [hits, meta] = await Promise.all([
    this.circleModel
      .aggregate<CircleDocument>([
        { $search: { compound } },
        { $sort: { score: { $meta: 'searchScore' }, popularity: -1 } },
        { $skip: skip },
        { $limit: limit },
      ])
      .exec(),
    this.circleModel
      .aggregate<{ count: { lowerBound?: number; total?: number } }>([
        { $searchMeta: { compound, count: { type: 'total' } } },
      ])
      .exec(),
  ]);

  const total = meta[0]?.count?.total ?? meta[0]?.count?.lowerBound ?? 0;

  return { data: hits, total };
}
```

A few nuances worth pointing out:

- **`themeId` is wrapped in `new Types.ObjectId(...)`.** Atlas Search's `equals` operator on an ObjectId-typed field requires an `ObjectId` value, not a string — passing the raw string silently returns zero results. The existing controller passes the `themeId` query param as a string (it comes from the frontend as a hex string in the URL), so the conversion happens here.
- **`count: { type: 'total' }`** asks Atlas for an exact count instead of the cheap lower-bound estimate. Atlas docs note exact counts can be slower at scale; for a circles collection of thousands of docs, this is fine. If we ever need to scale to hundreds of thousands and accept approximate totals, switch to `count: { type: 'lowerBound' }` — the consumer code already falls back to `lowerBound` if `total` is missing.
- **`autocomplete` covers prefix matching** (`ger` → `german shepherd`). Atlas Search's autocomplete operator uses an edge-gram analyzer under the hood; the index file in step 6 declares `labels.{locale}` and `aliases.{locale}` as autocomplete-typed fields.
- **`text` with `fuzzy: { maxEdits: 1 }`** covers single-character typos (`shephard` → `shepherd`). We deliberately don't run `fuzzy` against aliases — aliases are by definition variant spellings, and applying fuzzy on top would inflate the result set with very low-relevance matches.
- **`minimumShouldMatch: 1`** enforces that at least one of the three `should` clauses matches. Without this, `compound.should` is informational only (Atlas would still rank but not filter).

> CLAUDE.md (TypeScript): "Explicit return types on all service methods."

> CLAUDE.md (TypeScript): "No `any` types. No exceptions."

The aggregation generic types (`<CircleDocument>` and `<{ count: ... }>`) keep the result types tight without any `as`.

### 4c — Verify `findAllPaginated` is unchanged

`findAllPaginated` does not use `$text` or `searchTerms` and continues to handle the no-`q` case via plain Mongo. Leave it alone.

---

## Step 5 — Controller locale resolution and signature update

**File to modify:** `backend/src/circles/circles.controller.ts`

Three changes in `findAll()`:

1. Read the resolved locale from query / header / fallback.
2. Validate against `LOCALE_KEYS` (defensive — Zod already validates the query param, but the header is free text).
3. Pass `locale` to `searchPaginated`.

Also update the `update()` method to call `service.update(id, dto)` directly (the controller still does its own `findById` for the `Circle not found` check).

### 5a — Update imports

Add to the imports near the top of the file:

```ts
import { Headers } from '@nestjs/common';
import { LOCALE_KEYS, type LocaleKey } from '@base-dashboard/shared';
```

### 5b — Add the locale resolver helper (file-private)

Right after the imports, add:

```ts
/**
 * Resolve the user's locale for search:
 *   1. The `?locale=` query param (already validated by Zod).
 *   2. The first language tag of `Accept-Language` (e.g. `es-ES,es;q=0.9` → `es`).
 *   3. Fallback to `'en'`.
 *
 * The resolved value must be in LOCALE_KEYS or this helper throws —
 * the Zod enum on the query param already guarantees that for path 1,
 * but the header is free text and needs the runtime check.
 */
function resolveLocale(
  queryLocale: string | undefined,
  acceptLanguage: string | undefined,
): LocaleKey {
  if (queryLocale && (LOCALE_KEYS as readonly string[]).includes(queryLocale)) {
    return queryLocale as LocaleKey;
  }
  if (acceptLanguage) {
    // Take the first tag, drop the q-score: "es-ES,es;q=0.9" → "es-ES" → "es".
    const firstTag = acceptLanguage.split(',')[0]?.trim().split(';')[0]?.trim();
    const primarySubtag = firstTag?.split('-')[0]?.toLowerCase();
    if (primarySubtag && (LOCALE_KEYS as readonly string[]).includes(primarySubtag)) {
      return primarySubtag as LocaleKey;
    }
  }
  return 'en';
}
```

The two `as LocaleKey` casts here are the **documented exception case** for narrowing a `string` to a literal-union member after a runtime check. If `pnpm lint` warns on these, the inline `// eslint-disable-next-line` annotation is acceptable for these two lines specifically. Per CLAUDE.md, type assertions are warned but allowed for narrowing union types after runtime validation.

> CLAUDE.md: "No type assertions (`as`). Use type guards, generics, or proper narrowing instead. Exception: Mongoose enum fields return `string` — cast to the shared union type (e.g., `user.role as Role`)." — the same exception extends to other narrowing-after-runtime-check cases.

Alternative without `as`: define a type predicate `function isLocaleKey(s: string): s is LocaleKey { return (LOCALE_KEYS as readonly string[]).includes(s); }` and use it inline. This is cleaner and removes both casts. Prefer this version:

```ts
function isLocaleKey(s: string): s is LocaleKey {
  return (LOCALE_KEYS as readonly string[]).includes(s);
}

function resolveLocale(
  queryLocale: string | undefined,
  acceptLanguage: string | undefined,
): LocaleKey {
  if (queryLocale && isLocaleKey(queryLocale)) {
    return queryLocale;
  }
  if (acceptLanguage) {
    const primarySubtag = acceptLanguage
      .split(',')[0]
      ?.trim()
      .split(';')[0]
      ?.trim()
      .split('-')[0]
      ?.toLowerCase();
    if (primarySubtag && isLocaleKey(primarySubtag)) {
      return primarySubtag;
    }
  }
  return 'en';
}
```

The single `as readonly string[]` inside `isLocaleKey` is unavoidable because `LOCALE_KEYS` is typed as the literal tuple `readonly ["en", "es"]`, not `readonly string[]`. One narrow cast is acceptable for the type predicate definition; nothing leaks out of the helper.

### 5c — Update `findAll`

**Before**:

```ts
@Get()
async findAll(
  @Query(new ZodValidationPipe(circleSearchQuerySchema))
  query: CircleSearchQuery,
): Promise<PaginatedResponse<Circle>> {
  const { q, themeId, page, limit } = query;
  const { data, total } = q
    ? await this.circlesService.searchPaginated(q, page, limit, themeId)
    : await this.circlesService.findAllPaginated(page, limit, themeId);
  return {
    data: data.map(toCircle),
    meta: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

**After**:

```ts
@Get()
async findAll(
  @Query(new ZodValidationPipe(circleSearchQuerySchema))
  query: CircleSearchQuery,
  @Headers('accept-language') acceptLanguage: string | undefined,
): Promise<PaginatedResponse<Circle>> {
  const { q, themeId, page, limit, locale: queryLocale } = query;
  const locale = resolveLocale(queryLocale, acceptLanguage);
  const { data, total } = q
    ? await this.circlesService.searchPaginated(q, page, limit, locale, themeId)
    : await this.circlesService.findAllPaginated(page, limit, themeId);
  return {
    data: data.map(toCircle),
    meta: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

`findAllPaginated` does not need the locale (it lists all circles regardless of language).

> CLAUDE.md: "Validation uses **Zod schemas from `@base-dashboard/shared`** with `ZodValidationPipe` applied per-param."

> CLAUDE.md: "All controller methods must have explicit return types."

### 5d — Update the `update()` call site

If you reverted the service signature in step 4a (preferred path), the controller's `update()` method also needs adjustment:

**Before** (current code):

```ts
const doc = await this.circlesService.update(current, dto);
```

**After**:

```ts
const doc = await this.circlesService.update(id, dto);
```

The `current` doc is still fetched at the top of `update()` for the `NotFoundException` check and the slug-equality short-circuit. That fetch stays.

---

## Step 6 — Atlas Search index JSON file

**File to create:** `backend/src/circles/atlas-search-index.json`

Contents (paste verbatim):

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "labels": {
        "type": "document",
        "fields": {
          "en": [
            { "type": "autocomplete" },
            { "type": "string" }
          ],
          "es": [
            { "type": "autocomplete" },
            { "type": "string" }
          ]
        }
      },
      "aliases": {
        "type": "document",
        "fields": {
          "en": [
            { "type": "autocomplete" },
            { "type": "string" }
          ],
          "es": [
            { "type": "autocomplete" },
            { "type": "string" }
          ]
        }
      },
      "themeId": { "type": "objectId" },
      "popularity": { "type": "number" }
    }
  }
}
```

A few notes on the structure:

- **`dynamic: false`** locks the index to the explicitly mapped fields. New fields added to the Mongoose schema later (e.g., a Spanish `description`) won't accidentally end up in the index without an explicit update. Defensive choice.
- **Each locale is mapped twice** — once as `autocomplete` (used by the `autocomplete` operator for prefix matching), once as `string` (used by the `text` operator for fuzzy matching). Atlas allows multiple analyzers per field.
- **`labels` and `aliases` are `document`-typed** — Atlas Search's structured field-of-fields model. The compound query in the service accesses the children via dotted paths (`labels.en`, `aliases.es`).
- **`themeId` is `objectId`-typed** — the `equals` filter operator only matches values of the declared field type.
- **`popularity` is `number`-typed** — used by the `$sort` stage's `popularity: -1`. Sortable by default.
- **`aliases` arrays of strings**: Atlas Search transparently handles array-of-strings under a `string`/`autocomplete` mapping — each element is indexed individually.

This file is the **source of truth**. The Atlas console must be kept in sync. Document this fact at the top of the file is not standard for JSON, but mention it in the operational appendix of `overview.md` (already done).

---

## Step 7 — Update `circles.service.spec.ts`

**File to modify:** `backend/src/circles/circles.service.spec.ts`

The current spec has a `describe('searchPaginated', ...)` block built around the `$text` query path. Replace it entirely with new cases that mock `circleModel.aggregate(...)`. Keep all other `describe` blocks (`create`, `findAllPaginated`, `findById`, `findBySlugExists`, `update`, `remove`) as-is — those are unaffected by the search rewrite.

### 7a — Strip the `searchTerms` expectations from `create` and `update` cases

Several `create()` and `update()` cases assert `searchTerms: expect.arrayContaining([...])`. Remove those expectations. The new code does not write `searchTerms` at all.

For example, the existing `create` case:

```ts
expect(model.create).toHaveBeenCalledWith(
  expect.objectContaining({
    slug: 'german-shepherd',
    themeId: 'theme-1',
    labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
    aliases: { en: [], es: [] },
    searchTerms: expect.arrayContaining([
      'german shepherd',
      'pastor aleman',
    ]),
  }),
);
```

becomes:

```ts
expect(model.create).toHaveBeenCalledWith(
  expect.objectContaining({
    slug: 'german-shepherd',
    themeId: 'theme-1',
    labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
    aliases: { en: [], es: [] },
  }),
);
```

Likewise, the `update` test case "rebuilds searchTerms when labels change" no longer applies — delete it. Replace with a single case "updates labels" asserting `findByIdAndUpdate` is called with the new labels and no `searchTerms` field. The `update` early-return-vs-merge distinction also collapses (step 4a), so simplify the test cases accordingly.

### 7b — Replace the `searchPaginated` cases

New cases (replacing the existing ones):

```ts
describe('searchPaginated', () => {
  it('runs an Atlas $search aggregation scoped to the locale', async () => {
    const aggregate = jest.fn();
    const exec = jest.fn();
    // Mongoose's aggregate() returns an Aggregate-typed cursor; we mock it
    // as a chainable that resolves to an array on .exec().
    aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([mockCircle]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ count: { total: 1 } }]),
      });
    model.aggregate = aggregate;

    const result = await service.searchPaginated('ger', 1, 10, 'en', 'theme-1');

    expect(aggregate).toHaveBeenCalledTimes(2);

    const [searchPipeline, metaPipeline] = aggregate.mock.calls;

    // First call: the document-fetch aggregation.
    expect(searchPipeline[0]).toEqual([
      {
        $search: {
          compound: expect.objectContaining({
            should: expect.arrayContaining([
              { autocomplete: { query: 'ger', path: 'labels.en' } },
              { autocomplete: { query: 'ger', path: 'aliases.en' } },
              {
                text: {
                  query: 'ger',
                  path: 'labels.en',
                  fuzzy: { maxEdits: 1 },
                },
              },
            ]),
            filter: [
              {
                equals: {
                  path: 'themeId',
                  value: expect.anything(), // ObjectId("theme-1") — see note below
                },
              },
            ],
            minimumShouldMatch: 1,
          }),
        },
      },
      { $sort: { score: { $meta: 'searchScore' }, popularity: -1 } },
      { $skip: 0 },
      { $limit: 10 },
    ]);

    // Second call: the count aggregation.
    expect(metaPipeline[0]).toEqual([
      {
        $searchMeta: expect.objectContaining({
          compound: expect.objectContaining({
            minimumShouldMatch: 1,
          }),
          count: { type: 'total' },
        }),
      },
    ]);

    expect(result).toEqual({ data: [mockCircle], total: 1 });
  });

  it('omits the themeId filter when not provided', async () => {
    const aggregate = jest.fn();
    aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ count: { total: 0 } }]),
      });
    model.aggregate = aggregate;

    await service.searchPaginated('ger', 1, 10, 'en');

    const searchStage = aggregate.mock.calls[0][0][0].$search;
    expect(searchStage.compound.filter).toBeUndefined();
  });

  it('uses the spanish locale paths when locale is "es"', async () => {
    const aggregate = jest.fn();
    aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ count: { total: 0 } }]),
      });
    model.aggregate = aggregate;

    await service.searchPaginated('pastor', 1, 10, 'es');

    const searchStage = aggregate.mock.calls[0][0][0].$search;
    expect(searchStage.compound.should).toContainEqual({
      autocomplete: { query: 'pastor', path: 'labels.es' },
    });
    expect(searchStage.compound.should).toContainEqual({
      text: {
        query: 'pastor',
        path: 'labels.es',
        fuzzy: { maxEdits: 1 },
      },
    });
  });

  it('falls back to the lowerBound count when total is missing', async () => {
    const aggregate = jest.fn();
    aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([mockCircle]) })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([{ count: { lowerBound: 42 } }]),
      });
    model.aggregate = aggregate;

    const result = await service.searchPaginated('x', 1, 10, 'en');

    expect(result.total).toBe(42);
  });

  it('returns total: 0 when meta is empty', async () => {
    const aggregate = jest.fn();
    aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });
    model.aggregate = aggregate;

    const result = await service.searchPaginated('nothing', 1, 10, 'en');

    expect(result).toEqual({ data: [], total: 0 });
  });

  it('throws when called with an unsupported locale', async () => {
    await expect(
      // The inline cast bypasses the LocaleKey type to simulate a stray
      // caller. The service's runtime guard should catch it.
      service.searchPaginated('x', 1, 10, 'fr' as never),
    ).rejects.toThrow(/unsupported locale/i);
  });
});
```

A few testing-pattern notes:

- **`new Types.ObjectId('theme-1')` is mocked away** — the test passes `'theme-1'` as a string and asserts the call shape via `expect.anything()` for the value. If you want a stricter assertion, swap to `expect(value.toString()).toBe('theme-1')` after destructuring. The current relaxed approach is fine for unit tests; the integration smoke (step 8) verifies the real value.
- **`model.aggregate = aggregate`** assigns the mock directly to the model object. The existing test setup mocks `model` as `Record<string, jest.Mock>` — extend that with an `aggregate` key in the `beforeEach`.

> CLAUDE.md (testing): "Mock dependencies as plain objects with `jest.fn()` methods … For Mongoose query chains (`.find().skip().limit()`), mock as chainable objects."

---

## Step 8 — Verify

```sh
pnpm --filter base-dashboard-backend lint
pnpm --filter base-dashboard-backend typecheck
pnpm --filter base-dashboard-backend test
pnpm --filter base-dashboard-backend build
```

All four must pass.

### Manual smoke (required before reporting the slice complete)

This requires a live Atlas cluster with the search index in place.

1. **Set up the Atlas Search index once** in your dev cluster, following the appendix in [overview.md](overview.md). Wait until status is `ACTIVE`.
2. Start the backend: `pnpm dev` from the repo root.
3. Seed at least one circle (use the admin UI or `mongosh`):
   - slug `german-shepherd`, themeId `<some theme>`, labels `{ en: "German Shepherd", es: "Pastor Alemán" }`, aliases `{ en: ["GSD"], es: [] }`.
4. Wait ~10s for Atlas to index the new doc (Atlas Search is near-realtime, not instant).
5. Hit the search endpoint with curl, with an admin JWT:

   ```sh
   # Prefix-as-you-type, English UI
   curl 'http://localhost:3000/api/circles?q=ger&locale=en&limit=5' \
     -H 'Authorization: Bearer <admin-jwt>'
   #  → expects: german-shepherd row in results

   # Typo tolerance, English UI
   curl 'http://localhost:3000/api/circles?q=shephard&locale=en&limit=5' \
     -H 'Authorization: Bearer <admin-jwt>'
   #  → expects: same row, despite the typo

   # Spanish locale — should NOT find german-shepherd via "ger"
   curl 'http://localhost:3000/api/circles?q=ger&locale=es&limit=5' \
     -H 'Authorization: Bearer <admin-jwt>'
   #  → expects: empty result set (en label "German Shepherd" is not searched)

   # Spanish locale — finds via "pastor"
   curl 'http://localhost:3000/api/circles?q=pastor&locale=es&limit=5' \
     -H 'Authorization: Bearer <admin-jwt>'
   #  → expects: german-shepherd row

   # Accept-Language fallback (no ?locale=)
   curl 'http://localhost:3000/api/circles?q=ger&limit=5' \
     -H 'Authorization: Bearer <admin-jwt>' \
     -H 'Accept-Language: en-US,en;q=0.9'
   #  → expects: german-shepherd row (locale resolved to "en" from header)
   ```

If any of those produce unexpected results (especially: cross-locale leakage, or zero results when prefix should match), debug before reporting the slice complete.

---

## What this slice ships

- `searchTerms` denormalization is gone. Mongoose schema is leaner; `buildSearchTerms` and its tests are gone.
- `/api/circles?q=` now returns Atlas Search results, locale-scoped, with prefix matching and 1-edit typo tolerance.
- The frontend can now pass `locale` explicitly, and the backend gracefully degrades to `Accept-Language` when it doesn't.
- `circles.service.spec.ts` reflects the new aggregation shape.

The `default` Atlas Search index on the `circles` collection in your Atlas cluster is the operational dependency. Document its setup in the deployment runbook.
