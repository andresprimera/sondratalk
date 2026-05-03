---
name: plan-detailed
description: Build a self-contained, file-based implementation plan with the project's CLAUDE.md conventions embedded inline, so the implementing agent never has to re-derive rules. Splits full-stack features into shared-contract + backend + frontend sub-plans. Use when the user asks for a "detailed plan", "plan this feature", or hands off non-trivial work to a follow-up agent.
---

# plan-detailed

Build implementation plans that are **so specific** the implementing agent does not need to remember CLAUDE.md — every relevant rule, file path, naming pattern, and test requirement is quoted inline next to the step that needs it.

## Core principle

A plan from this skill should pass this test: **a fresh agent with no prior context could read one sub-plan and produce correct, convention-following code without opening CLAUDE.md.** If a step says "follow CLAUDE.md naming", that step has failed — quote the actual rule.

## Workflow

### 1. Understand the task

- Read `CLAUDE.md` in full.
- Restate the user's task in one sentence. If anything is ambiguous (which entity, which fields, which role gates it, paginated or not, admin-only or all users), ask before planning. Cheap to ask, expensive to replan.

### 2. Classify the surface area

Decide which sub-plans are needed:

- **Shared only** — new Zod schema/type with no immediate consumer. Rare. → `overview.md` only.
- **Backend only** — internal job, service-to-service, no UI. → `overview.md` + `backend.md`.
- **Frontend only** — UI tweak, new page wired to existing endpoints. → `overview.md` + `frontend.md`.
- **Full-stack** — new feature with API + UI. → `overview.md` + `backend.md` + `frontend.md`.

Slug the feature in kebab-case (e.g., `client-import`, `sales-refund`). Output goes to `.claude/plans/<slug>/`.

### 3. Read the reference patterns

Before writing the plan, **open the closest existing analogues** in the codebase and note their structure. Cite them in the plan by file path. Examples:

- New CRUD page → read [frontend/src/pages/users.tsx](frontend/src/pages/users.tsx) and the most recent CRUD page (e.g., clients).
- New form → read [frontend/src/components/login-form.tsx](frontend/src/components/login-form.tsx) and any feature form already shipped.
- New backend module → read the most recent feature module (e.g., `clients/`, `sales/`) — module, controller, service, dto/, schemas/.
- New shared schema → read `shared/src/schemas/user.ts` and the most recent feature schema.

Reference files in plan steps with markdown links: `[users.tsx](frontend/src/pages/users.tsx)`.

### 4. Write the plans

Use the templates below. Each step **must** include:

- The **exact file path** to create or modify.
- The **rule quoted from CLAUDE.md** that governs the step (not paraphrased — copy the line).
- A **reference file** to mirror, if one exists.
- The **specific names** to use (controller method, service method, query key, API function name, route path) — derived from the naming tables in CLAUDE.md, not left as "follow conventions".
- The **tests** that must accompany the step, with what they should cover.

### 5. Final pass

Before declaring the plan done, re-read it and check:

- Does any step say "follow X conventions" without quoting them? Fix.
- Does any step assume the implementor knows where a pattern lives? Add the file path.
- Are naming conventions resolved to concrete names? (Not `<verb><Noun>` — the actual `findAllPaginated`.)
- Are tests listed for every backend service method and every frontend API function?
- Does `overview.md` link to the sub-plans and state the execution order (shared → backend → frontend)?

## Templates

### `overview.md`

```markdown
# <Feature Name>

## Goal
<One paragraph: what the user can do once this ships, and why.>

## Surface area
- [ ] Shared contract (`shared/src/schemas/<feature>.ts`)
- [ ] Backend (see `backend.md`)
- [ ] Frontend (see `frontend.md`)

## Execution order
1. **Shared first.** Add schemas and types in `shared/src/schemas/<feature>.ts` and re-export from `shared/src/index.ts`.
   > CLAUDE.md: "When adding a new feature, define the schemas and types in shared **first**, then build the backend and frontend against them."
2. **Backend next.** Implement against the shared types. See `backend.md`.
3. **Frontend last.** Consume the API. See `frontend.md`.

## Shared contract

### File: `shared/src/schemas/<feature>.ts`

Schemas to define (using `import { z } from "zod/v4"`):

- `<entity>Schema` — full entity shape returned by API. Fields: <list each with type and constraints>.
- `create<Entity>Schema` — request body for POST. Fields: <list>.
- `update<Entity>Schema` — request body for PATCH. Fields: <list, usually `.partial()` of create>.
- `<entity>QuerySchema` — query params for GET list (extends `paginationQuerySchema` if paginated).

Each schema exports its inferred type: `export type <Entity> = z.infer<typeof <entity>Schema>`.

### File: `shared/src/index.ts`
Re-export everything from the new schema file.

### Rules to follow
> CLAUDE.md: "Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`."
> CLAUDE.md: "Every schema uses **Zod v4** (`import { z } from "zod/v4"`) and exports both the schema and its inferred type."
> CLAUDE.md: "Zod validation messages stay in English — schemas live in `shared/` and are used by backend too."

## Open questions
<Anything you flagged for the user during step 1. Empty if everything was clear.>
```

### `backend.md`

```markdown
# <Feature Name> — Backend Plan

**Prerequisite:** shared contract from `overview.md` is implemented.

## Module layout

Create `backend/src/<feature>/` with:
- `<feature>.module.ts`
- `<feature>.controller.ts`
- `<feature>.service.ts`
- `dto/index.ts` (re-exports from `@base-dashboard/shared`)
- `schemas/<entity>.schema.ts` (Mongoose)
- `<feature>.service.spec.ts`

> CLAUDE.md: "Feature-based modules: each feature gets its own folder with `module`, `controller`, `service`, `dto/`, `schemas/`, `guards/`, `decorators/`, `strategies/` as needed."

Reference module to mirror: [backend/src/<closest-feature>/](backend/src/<closest-feature>/)

## Step 1 — Mongoose schema

**File:** `backend/src/<feature>/schemas/<entity>.schema.ts`

- Use `@Schema({ timestamps: true })` and `@Prop()`.
- Sensitive fields (if any): mark `select: false`.
- Export the class, the schema constant, and `<Entity>Document = HydratedDocument<<Entity>>`.

> CLAUDE.md: "Always enable `{ timestamps: true }` on schemas."
> CLAUDE.md: "Sensitive fields use `select: false` — explicitly `.select('+field')` when needed."

Reference: `backend/src/users/schemas/user.schema.ts`.

Fields to define: <list each Prop with type, required, default, ref, select>.

## Step 2 — DTOs

**File:** `backend/src/<feature>/dto/index.ts`

Re-export the schemas and types from `@base-dashboard/shared`:
```ts
export {
  create<Entity>Schema,
  update<Entity>Schema,
  <entity>QuerySchema,
  type Create<Entity>Input,
  type Update<Entity>Input,
} from '@base-dashboard/shared';
```

> CLAUDE.md: "Backend DTO files (`backend/src/<feature>/dto/`) **re-export** from shared — they never redefine the same schema."

## Step 3 — Service

**File:** `backend/src/<feature>/<feature>.service.ts`

Inject `@InjectModel(<Entity>.name)`. Use `private readonly logger = new Logger(<Feature>Service.name)`.

**Methods to implement** (use these exact names — from the CLAUDE.md naming table):

| Method | Signature | Purpose |
|---|---|---|
| `create` | `create(dto: Create<Entity>Input): Promise<<Entity>>` | Insert |
| `findAllPaginated` | `findAllPaginated(page: number, limit: number): Promise<PaginatedResponse<<Entity>>>` | Paginated list |
| `findById` | `findById(id: string): Promise<<Entity>>` | Fetch one, throw `NotFoundException` if missing |
| `update` | `update(id: string, dto: Update<Entity>Input): Promise<<Entity>>` | Update multiple fields |
| `remove` | `remove(id: string): Promise<void>` | Delete |

> CLAUDE.md (naming table): "`create(dto)` … `findAllPaginated(page, limit)` … `findById(id)` … `update(id, dto)` … `remove(id)`."

**Banned method prefixes (ESLint):** `get|fetch|add|delete|destroy|set|list|edit` + capital letter.

## Step 4 — Controller

**File:** `backend/src/<feature>/<feature>.controller.ts`

- Route: `@Controller('<plural-kebab>')` — pluralized resource name.
- Apply `@UseGuards(JwtAuthGuard)` is automatic (global). Add `@Roles('admin')` + `@UseGuards(RolesGuard)` if admin-only.
- Use `ZodValidationPipe` per param.
- **All methods need explicit return types.**

| Method | Decorator | Signature |
|---|---|---|
| `create` | `@Post()` | `create(@Body(new ZodValidationPipe(create<Entity>Schema)) dto: Create<Entity>Input): Promise<<Entity>>` |
| `findAll` | `@Get()` | `findAll(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery): Promise<PaginatedResponse<<Entity>>>` |
| `findOne` | `@Get(':id')` | `findOne(@Param('id') id: string): Promise<<Entity>>` |
| `update` | `@Patch(':id')` | `update(@Param('id') id: string, @Body(new ZodValidationPipe(update<Entity>Schema)) dto: Update<Entity>Input): Promise<<Entity>>` |
| `remove` | `@Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)` | `remove(@Param('id') id: string): Promise<void>` |

> CLAUDE.md: "Action-only endpoints return 204 No Content … Use `@HttpCode(HttpStatus.NO_CONTENT)` on the controller and `Promise<void>` return type."
> CLAUDE.md: "All controller methods must have explicit return types."
> CLAUDE.md (naming): "`findAll()` … `findOne()` … `create()` … `update()` … `remove()`."

**Banned controller prefixes (ESLint):** `list|add|edit|delete|destroy|fetch` + capital letter.

## Step 5 — Module wiring

**File:** `backend/src/<feature>/<feature>.module.ts`

- `MongooseModule.forFeature([{ name: <Entity>.name, schema: <Entity>Schema }])`
- Provide service, expose controller, export service if other modules need it.

**File:** `backend/src/app.module.ts`
- Add `<Feature>Module` to the `imports` array.

## Step 6 — Tests

**File:** `backend/src/<feature>/<feature>.service.spec.ts`

Reference: `backend/src/users/users.service.spec.ts`.

Tests required (one `describe` per service method):

- `create` — happy path; <any business-rule edge cases>.
- `findAllPaginated` — returns shape `{ data, meta }`; respects skip/limit; mock chain `{ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([...]) }`.
- `findById` — returns entity; throws `NotFoundException` when null.
- `update` — happy path; throws `NotFoundException` when null.
- `remove` — happy path; throws `NotFoundException` when null.

> CLAUDE.md: "When building a new feature, always write unit tests for the service layer."
> CLAUDE.md: "Mock dependencies as plain objects with `jest.fn()` methods … Do NOT use `jest.Mocked<Partial<T>>`."

## Step 7 — Verify

- `pnpm --filter backend lint`
- `pnpm --filter backend test`
- `pnpm --filter backend build`
```

### `frontend.md`

```markdown
# <Feature Name> — Frontend Plan

**Prerequisite:** shared contract from `overview.md` is implemented and backend endpoints are live.

## File layout

- `frontend/src/lib/<feature>.ts` — API functions.
- `frontend/src/lib/<feature>.spec.ts` — API function tests.
- `frontend/src/pages/<feature>.tsx` — page component (default export, page is the only kind of file allowed default exports outside Vite entry points).
- `frontend/src/components/<feature>-form.tsx` — form component if create/edit needed (named export).
- `frontend/src/locales/en.json` and `es.json` — new strings.
- Route added in `frontend/src/main.tsx` (or wherever routes are declared).
- Sidebar entry in `frontend/src/components/app-sidebar.tsx` if user-facing.

## Step 1 — API functions

**File:** `frontend/src/lib/<feature>.ts`

Import `authFetch` from `@/lib/api`. Import types from `@base-dashboard/shared`.

Functions to export (use these exact names — `<verb><Resource>Api`):

| Function | Returns | Endpoint |
|---|---|---|
| `fetch<Resource>Api(page, limit)` | `Promise<PaginatedResponse<<Entity>>>` | `GET /api/<plural>?page=&limit=` |
| `fetch<Entity>ByIdApi(id)` | `Promise<<Entity>>` | `GET /api/<plural>/:id` |
| `create<Entity>Api(input)` | `Promise<<Entity>>` | `POST /api/<plural>` |
| `update<Entity>Api(id, input)` | `Promise<<Entity>>` | `PATCH /api/<plural>/:id` |
| `remove<Entity>Api(id)` | `Promise<void>` | `DELETE /api/<plural>/:id` |

> CLAUDE.md: "API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads, `create`, `update`, `remove`) with an `Api` suffix."
> CLAUDE.md: "Authenticated endpoints use `authFetch` … API functions should **never** accept an access token parameter."
> CLAUDE.md: "Action-only endpoints return 204 … Frontend API functions return `Promise<void>` and skip `res.json()`."

Reference: [frontend/src/lib/users.ts](frontend/src/lib/users.ts).

## Step 2 — API tests

**File:** `frontend/src/lib/<feature>.spec.ts`

Mock `@/lib/api` with `vi.mock("@/lib/api")` and `vi.mocked(authFetch)`. One test per API function:
- Correct URL, method, body.
- Returns parsed JSON (or `void` for 204 endpoints — assert `authFetch` was called, but no `.json()`).

> CLAUDE.md: "API functions (`src/lib/`): Correct URL, HTTP method, request body, and response parsing. One test per function."

Reference: [frontend/src/lib/users.spec.ts](frontend/src/lib/users.spec.ts).

## Step 3 — Form component (if create/edit)

**File:** `frontend/src/components/<feature>-form.tsx`

- `useForm<Create<Entity>Input>({ resolver: standardSchemaResolver(create<Entity>Schema) })`. Use `standard-schema`, **not** `@hookform/resolvers/zod`.
- Layout: `Card` wrapper → `FieldGroup` → `Field` → `FieldLabel` → input → `FieldDescription` (with `text-destructive` on error) → submit button with loading state.
- shadcn components only. **No inline `style` prop.** All styling via `className` + Tailwind.
- Use `render` prop for composition (base-ui), **not** `asChild`.
- All visible strings via `t()` from `useTranslation()`.

> CLAUDE.md: "All forms use Zod v4 + react-hook-form. No exceptions."
> CLAUDE.md: "shadcn/ui is base-ui based — components use the `render` prop for composition, not `asChild`."
> CLAUDE.md: "Translation keys are the exact English string — flat structure."

Reference: [frontend/src/components/login-form.tsx](frontend/src/components/login-form.tsx).

## Step 4 — Page

**File:** `frontend/src/pages/<feature>.tsx`

Default export: `export default function <Feature>Page()`.

Structure:
- Heading + description.
- Loading: `Skeleton` rows matching the table shape.
- Error: inline error message + retry button calling `refetch`.
- Empty: centered "No <plural> found." with icon + description.
- Data: bordered `Table` with rows; `Badge` for enum/status; inline `Select` for editable enum fields.
- Pagination: rows-per-page `Select` + first/prev/next/last buttons.

**React Query setup:**
- Query key: `["<plural>", page, pageSize]` — array, resource name first.
- `placeholderData: keepPreviousData` for the list query.
- Mutations: `onSuccess` → `queryClient.invalidateQueries({ queryKey: ["<plural>"] })` + `toast.success(t("<message>"))`.
- Mutations: `onError` → `toast.error(error.message)`.

> CLAUDE.md: "Query keys are arrays — resource name first, then params."
> CLAUDE.md: "Use `placeholderData: keepPreviousData` for paginated queries."
> CLAUDE.md: "Use `toast.error()` only for mutation failures, not for query errors."
> CLAUDE.md: "shadcn `Skeleton` component matching the shape of the expected content — not bare 'Loading...' text."

Reference: [frontend/src/pages/users.tsx](frontend/src/pages/users.tsx) and [frontend/src/pages/clients.tsx](frontend/src/pages/clients.tsx).

## Step 5 — Routing & sidebar

- Add route under `/dashboard/<feature>` wrapped in `<ProtectedRoute>` (and `<AdminRoute>` if admin-only).
- Add sidebar entry with a `lucide-react` icon. **No icon libraries other than lucide-react.**

## Step 6 — i18n strings

Add every new string to both `frontend/src/locales/en.json` and `frontend/src/locales/es.json`. Keys = English value; values in `es.json` are translated.

> CLAUDE.md: "When adding new UI strings: Add the key to both `en.json` and `es.json`, then use `t('key')` in the component."

Strings to add: <list every t() call planned>.

## Step 7 — Tests

For form components: render with `userEvent`, assert validation errors render on invalid input, assert successful submission calls the mocked mutation, assert loading state renders.

> CLAUDE.md: "Form components: Test that validation errors display on invalid input, that successful submission calls the correct API/mutation, and that loading/error states render."

## Step 8 — Verify

- `pnpm --filter frontend lint`
- `pnpm --filter frontend test`
- `pnpm --filter frontend build`
- Start the dev server and exercise the feature in a browser. Verify golden path + at least one error case.

> CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete."
```

## Output behavior

After writing the plan files, print to the user:

1. The path of each file written.
2. A one-paragraph summary of the plan.
3. Any open questions surfaced during planning.
4. The next command to run (typically: hand `overview.md` to an implementing agent).

**Do not implement the feature.** This skill only produces plans.
