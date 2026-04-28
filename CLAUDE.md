# Project Rules & Standards

## Architecture

pnpm monorepo with three packages: `backend` (NestJS 11 + Mongoose), `frontend` (Vite + React 19 + React Router v7), and `shared` (`@base-dashboard/shared` — Zod schemas and types). All entity/API types are defined in `shared/` and imported by both backend and frontend. Never duplicate types across packages. The shared package has no build step — it exports raw TS via `"main": "src/index.ts"`.

## Shared Package (`@base-dashboard/shared`)

The shared package is the **single source of truth** for all data shapes that cross the network boundary. It contains Zod schemas and their inferred TypeScript types — nothing else.

### What belongs in `shared/`

- **Entity schemas and types** — the shape of data as returned by the API (e.g., `userSchema` / `User`, `roleEnum` / `Role`).
- **Request input schemas and types** — validated request bodies and query params (e.g., `loginSchema` / `LoginInput`, `paginationQuerySchema` / `PaginationQuery`).
- **Response schemas and types** — structured response shapes used by both sides (e.g., `authResponseSchema` / `AuthResponse`, `apiErrorResponseSchema` / `ApiErrorResponse`).
- **Shared generic types** — reusable type utilities that apply to both packages (e.g., `PaginatedResponse<T>`, `PaginationMeta`).

### What does NOT belong in `shared/`

- **Mongoose schemas, decorators, or anything NestJS-specific** — these stay in `backend/`. Shared types describe the API contract, not the database layer.
- **React components, hooks, or UI types** — these stay in `frontend/`.
- **Utility functions with runtime logic** — no helpers, formatters, or business logic. If both packages need a utility, evaluate whether it truly belongs in both or if it's incidental duplication.
- **Constants or enums that only one side uses** — if only the backend cares about a config value or only the frontend uses a set of UI states, keep it in that package.
- **Environment-specific config** — env var names, default values, feature flags.

### Rules

- Every schema file lives in `shared/src/schemas/` and is re-exported from `shared/src/index.ts`.
- Every schema uses **Zod v4** (`import { z } from "zod/v4"`) and exports both the schema and its inferred type (`z.infer<typeof schema>`).
- Backend DTO files (`backend/src/<feature>/dto/`) **re-export** from shared — they never redefine the same schema.
- Frontend imports directly from `@base-dashboard/shared` in `lib/` and `hooks/` files.
- When adding a new feature, define the schemas and types in shared **first**, then build the backend and frontend against them.

## TypeScript — Zero Tolerance

- **No `any` types.** No exceptions. If a library returns `any`, wrap it with a proper type.
- **No type assertions** (`as`). Use type guards, generics, or proper narrowing instead. Exception: Mongoose enum fields return `string` — cast to the shared union type (e.g., `user.role as Role`).
- **No single-use local types** for data that comes from the database or API. Import the canonical type from `shared/`.
- Infer from schemas when possible: `z.infer<typeof schema>` for Zod, `HydratedDocument<T>` for Mongoose.
- Explicit return types on all service methods (backend) and API functions (frontend).

## Frontend

**This is a Vite + React SPA, not Next.js.** Never add `"use client"` or `"use server"` directives — they do nothing here and are a sign of framework confusion.

### Components

- **Use shadcn/ui for everything.** Only build custom components when shadcn has no equivalent.
- **Do not customize shadcn component styles** unless absolutely necessary. Use the built-in variants and sizes. Override via `className` prop with Tailwind utilities only when the variant system doesn't cover the case.
- **Search before creating.** Before building any new component, search `components/` for an existing one that already does what you need. Prefer modifying or extending an existing component over creating a new one. Only create a new component when nothing existing can reasonably be adapted.
- **Prefer shared/reusable components** over single-use ones. If a component is used in more than one place (or could be), extract it. If it's truly page-specific, keep it in the page file or a colocated file.
- **Do not modify files in `components/ui/`.** These are shadcn-managed. Customizations go in wrapper components or via `className`.
- **Pattern-first design:** Before building any new UI (page, form, modal, CRUD screen, etc.), read existing similar components to match their structure, spacing, and component choices. Reference examples:
  - **Forms:** `login-form.tsx`, `signup-form.tsx` — Card wrapper, FieldGroup/Field/FieldLabel/FieldDescription pattern, submit button with loading state.
  - **CRUD/admin pages:** `pages/users.tsx` — heading + description, bordered Table, inline Select for enums, Badge for display-only values, toast for feedback, disabled actions for self.
  - **Layout:** `dashboard-layout.tsx` — SidebarProvider + AppSidebar + SidebarInset + SiteHeader + Outlet.
- **shadcn/ui is base-ui based** — components use the `render` prop for composition (e.g., `<Button render={<Link to="/path" />}>`), **not** `asChild`.

### Styling

- **Tailwind CSS only.** No inline styles, no CSS modules, no styled-components.
- Use `cn()` from `@/lib/utils` for conditional classes.
- Use CVA (`class-variance-authority`) for component variants.
- Use CSS variables from the theme system (defined in `index.css`) — never hardcode colors.

### Forms

- **All forms use Zod v4 + react-hook-form.** No exceptions.
- Use `standardSchemaResolver` from `@hookform/resolvers/standard-schema` (not `zodResolver`).
- Import Zod from `zod/v4`.
- Define the schema, infer the type, use `register()` for inputs, display errors via `FieldDescription` with `text-destructive`.
- Show errors with `toast.error()` from `sonner` for API failures.

### Routing & Auth

- Pages use **default exports**. Components and hooks use **named exports**.
- `/` is a public landing page. `/login` and `/signup` are public auth pages.
- `/dashboard` is the protected area — wrapped in `<ProtectedRoute>` + `<DashboardLayout>` (sidebar + header + `<Outlet />`).
- Admin-only routes (e.g., `/dashboard/users`) wrap with `<AdminRoute>` which checks `user.role === "admin"`.
- Auth state comes from `useAuth()` hook (context-based). Tokens stored in `localStorage`.
- Two roles: `"admin"` and `"user"`. First signup gets admin, subsequent signups get user.
- `@Public()` decorator on backend marks endpoints that skip JWT guard.
- `@Roles('admin')` + `@UseGuards(RolesGuard)` on backend for role-restricted endpoints.

### Error Handling & Loading States

Error handling goes beyond forms. Every page or component that fetches data must handle all three states:

- **Loading:** Show the shadcn `Skeleton` component (from `ui/skeleton.tsx`) matching the shape of the expected content — not bare "Loading..." text. For tables, render skeleton rows. For cards, render skeleton blocks.
- **Error:** Check `isError` / `error` from `useQuery`. Display an inline error message with a retry button (`refetch` from `useQuery`). Use `toast.error()` only for mutation failures, not for query errors (the user didn't trigger those).
- **Empty:** When data loads successfully but the list is empty, show a descriptive empty state — not just a blank area. A centered message inside the table/container (see `pages/users.tsx` "No users found." pattern, but prefer adding an icon + description for new pages).
- **No React error boundaries** for now — handle errors per-query at the component level.
- **Mutations** use `onError` to show `toast.error()` with the error message. Use `ApiError` helpers (`isValidation`, `isNotFound`, etc.) when the error message should vary by status code.

### State Management

- **Server state → React Query.** All data from the API lives in the query cache. No duplicating server data into local state.
- **Auth state → `AuthContext`** via `useAuth()`. This is the only app-wide context. Do not add new React Contexts without strong justification — most "global" state is actually server state that belongs in React Query.
- **Local UI state → `useState`** in the component that owns it. Pagination controls, form input, modal open/closed, selected tabs — these are local to the component.
- **No state management libraries** (no zustand, redux, jotai). React Query + Context + local state covers all current needs. Do not add a state library unless a clear use case arises that none of these solve.
- **Derived state → compute inline or `useMemo`.** Don't store derived values in state. If it can be computed from existing state or query data, compute it.

### Data Fetching

- Use **TanStack React Query** for server state (queries, mutations, caching).
- All API calls go through the `/api` proxy (Vite dev server proxies to backend).
- **No axios.** Plain `fetch` via the `authFetch` / `publicFetch` wrappers from `@/lib/api`.
- **No manual `useState`/`useEffect` for fetching.** Use `useQuery` for reads and `useMutation` for writes. Invalidate queries on mutation success via `queryClient.invalidateQueries()`.
- Use `placeholderData: keepPreviousData` for paginated queries to avoid flash on page change.

### API Response Conventions

- **No response envelope.** Endpoints return the typed resource directly — `User`, `AuthResponse`, `PaginatedResponse<T>`, etc. Do not wrap responses in `{ data: T }`.
- **Action-only endpoints return 204 No Content** — logout, forgot-password, reset-password, change-password, delete. Use `@HttpCode(HttpStatus.NO_CONTENT)` on the controller and `Promise<void>` return type. Frontend API functions return `Promise<void>` and skip `res.json()`.
- **Error responses follow `ApiErrorResponse`** from `@base-dashboard/shared`: `{ statusCode, message, errors? }`. The global `HttpExceptionFilter` handles this automatically.
- **Frontend uses `ApiError` class** (`lib/api-error.ts`) — thrown by `authFetch`/`publicFetch`. Extends `Error` so it works with React Query's `onError`. Provides `statusCode`, `errors`, and helpers like `isValidation`, `isUnauthorized`, `isNotFound`.
- **All controller methods must have explicit return types** — `Promise<User>`, `Promise<AuthResponse>`, `Promise<PaginatedResponse<T>>`, or `Promise<void>`.
- **React Query skips retries for client errors** (4xx) — only retries server errors and network failures.

### Pagination

- **Server-side pagination** for all list endpoints. Never fetch all records at once.
- Shared types in `@base-dashboard/shared`: `PaginatedResponse<T>`, `PaginationMeta`, `PaginationQuery`, `paginationQuerySchema`.
- Backend endpoints accept `?page=1&limit=10` query params, validated via `ZodValidationPipe(paginationQuerySchema)` on `@Query()`.
- Backend returns `{ data: T[], meta: { page, limit, total, totalPages } }`.
- Frontend API functions accept `(page, limit)` params and return `PaginatedResponse<T>`.
- Frontend pages track `page`/`pageSize` in `useState`, pass to `useQuery` key and fetch function.
- Pagination UI: rows-per-page selector + first/prev/next/last navigation buttons (see `pages/users.tsx` for reference).

### API Organization (`src/lib/`)

- **`api.ts`** — Shared infrastructure only: `authFetch`, `publicFetch`, token helpers (`getStoredTokens`, `storeTokens`, `clearTokens`), and the 401 refresh interceptor. No feature-specific API functions here.
- **One file per feature** — e.g., `auth.ts` (login, signup, refresh, logout, forgot/reset password), `users.ts` (CRUD for users). Each file imports `authFetch` or `publicFetch` from `@/lib/api`.
- **Authenticated endpoints** use `authFetch` — tokens are auto-attached and 401s trigger a silent refresh + retry. API functions should **never** accept an access token parameter.
- **Public endpoints** (login, signup, forgot-password) use `publicFetch`.
- When adding a new feature, create a new `src/lib/<feature>.ts` file rather than adding functions to an existing file.
- **Naming mirrors backend conventions:** API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads, `create`, `update`, `remove`) with an `Api` suffix. E.g., `fetchUsersApi()`, `createProjectApi()`, `updateUserRoleApi()`, `removeUserApi()`.

### File Organization

```
frontend/src/
  components/       # Reusable components (named exports)
    ui/             # shadcn components — do not edit directly
  hooks/            # Custom hooks (useAuth, useMobile, etc.)
  lib/              # Utilities and API functions
    api.ts          # Shared fetch wrappers (authFetch, publicFetch, token helpers)
    auth.ts         # Auth API functions (login, signup, refresh, etc.)
    users.ts        # User management API functions
    i18n.ts         # i18next config — imports locale JSONs, exports supportedLocales
    <feature>.ts    # One file per feature for API functions
  locales/          # Translation JSON files (en.json, es.json)
  pages/            # Page components (default exports)
```

- Files use **kebab-case**: `login-form.tsx`, `use-auth.tsx`.
- Imports use the **`@/` alias** — never relative paths with `../`.

### Icons

- Use **lucide-react** exclusively. Import specific icons by name.

### Internationalization (i18n)

- **Libraries:** `i18next` + `react-i18next` + `i18next-browser-languagedetector`.
- **Translation keys are the exact English string** — flat structure, no nested/semantic keys. Example: `t("Login to your account")`, not `t("auth.login.title")`. Config uses `keySeparator: false` and `nsSeparator: false` to support dots/colons in keys.
- **Translation files:** `frontend/src/locales/en.json` and `es.json`. Keys and values are identical in `en.json`; `es.json` has Spanish translations.
- **Config:** `frontend/src/lib/i18n.ts` — static imports of JSON files (no HTTP backend), `LanguageDetector` (localStorage → navigator), `fallbackLng: "en"`. Exports `supportedLocales` array.
- **Env var:** `VITE_SUPPORTED_LOCALES=en,es` (comma-separated). Defaults to `["en"]` when unset. Language toggle auto-hides when only one locale is configured.
- **In React components:** Use `const { t } = useTranslation()` hook.
- **At module level** (e.g., column definitions outside components): Use `i18n.t()` imported from `@/lib/i18n`.
- **Interpolation:** `t("Page {{page}} of {{totalPages}}", { page, totalPages })`.
- **Pluralization:** `t("{{count}} user total", { count })` with `_one`/`_other` suffixed keys in JSON files.
- **Date formatting:** Use `i18n.language` instead of hardcoded `"en-US"` in `toLocaleDateString()`.
- **When adding new UI strings:** Add the key to both `en.json` and `es.json`, then use `t("key")` in the component.
- **Zod validation messages stay in English** — schemas live in `shared/` and are used by backend too.

### Testing

- **Framework:** Vitest with jsdom environment. Config in `frontend/vitest.config.ts` (separate from `vite.config.ts` to avoid loading Tailwind plugin during tests).
- **Run tests:** `pnpm test` (single run), `pnpm test:watch` (watch mode), `pnpm test:cov` (coverage).
- **File placement:** Colocate test files next to source — `api-error.spec.ts` alongside `api-error.ts`.
- **Naming:** `*.spec.ts` (or `*.spec.tsx` for React). Use `describe` blocks per export, nested `describe` per method/getter.
- **Globals enabled:** `describe`, `it`, `expect`, `vi`, `beforeEach` are available without imports (configured in `vitest.config.ts` and `tsconfig.app.json`).
- **When building a new feature, always write unit tests** for the API functions in `src/lib/<feature>.ts`, any custom hooks with logic, and form/component behavior that involves conditional rendering or user interaction.

#### Mocking Patterns

- **Mocking `fetch`:** Use `vi.stubGlobal("fetch", vi.fn())` + `vi.mocked(fetch)` to control responses. No msw or nock.
- **Mocking modules:** For feature API files (`auth.ts`, `users.ts`, `profile.ts`), mock the `@/lib/api` module with `vi.mock("@/lib/api")` and use `vi.mocked(authFetch)` / `vi.mocked(publicFetch)` to control behavior. This tests the API function logic without testing the fetch wrapper.
- **Module-scoped state:** `api.ts` has a module-scoped `refreshPromise`. Tests use `vi.resetModules()` + dynamic `await import("@/lib/api")` in `beforeEach` to get a fresh module instance per test. This means the `api` variable must be `let` (not a static import).
- **`instanceof` caveat:** When using `vi.resetModules()`, classes from static imports differ from those in the dynamically imported module. Check `error.name === "ApiError"` and properties instead of `toBeInstanceOf(ApiError)`.
- **`window.location`:** Mock with `vi.stubGlobal("location", { ...window.location, href: "" })` and assert `locationMock.href` afterward.
- Call `vi.clearAllMocks()` in `beforeEach` for module-mocked tests, or `vi.restoreAllMocks()` in `afterEach` for global-mocked tests.

#### What to Test

- **API functions (`src/lib/`):** Correct URL, HTTP method, request body, and response parsing. One test per function.
- **Fetch wrappers (`api.ts`):** Token attachment, 401 refresh+retry logic, refresh deduplication, error parsing into `ApiError`, redirect on session expiry.
- **Utility classes (`api-error.ts`):** Constructor, getters, edge cases.
- **Query client config:** `staleTime`, retry logic for 4xx vs 5xx vs network errors.
- **Custom hooks with logic:** Use `renderHook` from `@testing-library/react`. Test state transitions, side effects, and returned values. Wrap in necessary providers (QueryClientProvider, AuthProvider, etc.) via a `wrapper` option. Good candidates: `useAuth` (login/logout/signup flows, token refresh scheduling), and any future hooks with derived state or async logic.
- **Form components:** Test that validation errors display on invalid input, that successful submission calls the correct API/mutation, and that loading/error states render. Use `render` + `userEvent` from `@testing-library/user-event` to simulate real user interaction (typing, clicking). Mock API functions via `vi.mock`.
- **Conditional rendering:** Components like `ProtectedRoute`, `AdminRoute`, or anything that shows/hides content based on auth state or roles.

#### What NOT to Test

- **shadcn `components/ui/`** — you don't own these.
- **Pure layout components** (`dashboard-layout.tsx`) — they just render children, no logic.
- **Pages that only wire data to UI** — if a page just fetches with `useQuery` and renders a table, the logic lives in the hook/service layer. Test those instead.
- **Static markup** — don't test that a heading says "Dashboard". Test behavior, not content.

#### Reference Test Files

- **Pure class (no mocking):** `lib/api-error.spec.ts`
- **Config extraction:** `lib/query-client.spec.ts` — extracts retry function from QueryClient defaults.
- **Global fetch mocking + module reset:** `lib/api.spec.ts` — `vi.resetModules()` pattern for module-scoped state.
- **Module mocking (vi.mock):** `lib/auth.spec.ts`, `lib/users.spec.ts`, `lib/profile.spec.ts` — mock `@/lib/api` and test API functions in isolation.

## Backend

### Module Structure

- Feature-based modules: each feature gets its own folder with `module`, `controller`, `service`, `dto/`, `schemas/`, `guards/`, `decorators/`, `strategies/` as needed.
- All routes are under the `/api` global prefix.
- **All routes are JWT-protected by default** (global `JwtAuthGuard`). Use `@Public()` to opt out.

### External Services (`services/`)

- External service integrations (email, SMS, etc.) live in `backend/src/services/`, one module per service.
- Each service gets its own folder: `services/mail/`, `services/sms/`, etc. — containing `module`, `service`, and `types` files.
- `services/index.ts` is a barrel that re-exports all service modules, services, and types.
- Service modules are **not globally registered** — consumers import only the modules they need (e.g., `imports: [MailModule]`).
- **MailService** (`services/mail/`) uses Nodemailer with SMTP config from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- **StorageService** (`services/storage/`) uses an adapter pattern for file storage. A `StorageProvider` interface defines `upload`, `download`, `delete`, `exists`, `getUrl`. Three adapters are available: `LocalStorageProvider` (filesystem, default), `GcsStorageProvider` (Google Cloud Storage), `FirebaseStorageProvider` (Firebase Storage). The active adapter is selected via the `STORAGE_PROVIDER` env var (`local` | `gcs` | `firebase`). Consuming code injects `StorageService` and never references a specific adapter. Local uploads are served via `ServeStaticModule` at `/uploads`.

### Naming Conventions

#### Route Paths

- **Kebab-case** for multi-word segments: `forgot-password`, `reset-password`.
- **Plural nouns** for resource collections: `/api/users`, `/api/projects`.
- **Nested routes** for sub-resources or actions on a resource: `/api/users/:id/role`, `/api/users/me/password`.
- **`me` for current-user endpoints:** `/api/users/me`, `/api/users/me/password` — not `/api/users/profile`.

#### Controller Methods

Controllers are thin — they validate input, call the service, and return. Method names describe the **API action from the client's perspective**:

| Pattern | Example | When to use |
|---|---|---|
| `findAll()` | `@Get()` on collection | List/paginated resources |
| `findOne()` | `@Get(':id')` on single resource | Fetch one by ID |
| `create()` | `@Post()` | Create a new resource |
| `update()` | `@Patch(':id')` | Update a resource by ID |
| `remove()` | `@Delete(':id')` | Delete a resource by ID |
| `<verb><Noun>()` | `updateRole()`, `changePassword()` | Action on a specific field/sub-resource |
| `<verb>()` | `signup()`, `login()`, `logout()` | Auth and domain-specific actions (no resource noun needed) |
| `get<Noun>()` | `getMe()`, `getHealth()` | Read-only endpoints that aren't standard CRUD `find*` |

- **Use `findAll` / `findOne`** for standard CRUD reads — not `getUsers` / `getUser` / `list`.
- **Use `create` / `update` / `remove`** for standard CRUD writes — not `add` / `edit` / `delete` (avoid shadowing JS `delete`).
- **Use `<verb><Noun>()`** for non-CRUD actions: `updateRole()`, `changePassword()`, `forgotPassword()`, `resetPassword()`.

#### Service Methods

Services contain business logic. Method names describe the **data operation**:

| Pattern | Example | When to use |
|---|---|---|
| `create(dto)` | `create({ name, email, password, role })` | Insert a new record |
| `findAll()` | `findAll()` | Fetch all records (unpaginated) |
| `findAllPaginated(page, limit)` | `findAllPaginated(1, 10)` | Fetch records with pagination |
| `findById(id)` | `findById('abc123')` | Fetch one record by ID |
| `findBy<Field>(value)` | `findByEmail('a@b.com')` | Fetch one record by a specific field |
| `findBy<Field>With<Selected>(value)` | `findByIdWithPassword(id)` | Fetch with `.select('+sensitiveField')` |
| `findBy<Field>Exists(value)` | `findByEmailExists(email)` | Boolean existence check |
| `update<Field>(id, value)` | `updateRole(id, 'admin')` | Update a specific field |
| `update(id, dto)` | `update(id, { name, email })` | Update multiple fields (general update) |
| `remove(id)` | `remove('abc123')` | Delete a record by ID |
| `count<Resource>()` | `countUsers()` | Aggregate count |
| `clear<Field>(id)` | `clearPasswordResetToken(id)` | Unset/nullify a specific field |

- **`find*` for reads, `update*` for writes, `remove` for deletes, `create` for inserts.** No synonyms (`get`, `fetch`, `add`, `delete`, `destroy`, `set`).
- **Append `Paginated`** to distinguish paginated from unpaginated variants: `findAll()` vs `findAllPaginated()`.
- **Append `With<Field>`** when a query `.select()`s sensitive fields: `findByIdWithPassword()`, `findByIdWithRefreshToken()`.
- **Private helper methods** use descriptive names without the `find`/`update` prefix: `generateTokens()`, `hashPassword()`, `sendResetEmail()`.

### DTOs & Validation

- Validation uses **Zod schemas from `@base-dashboard/shared`** with `ZodValidationPipe` applied per-param (e.g., `@Body(new ZodValidationPipe(schema))` or `@Query(new ZodValidationPipe(schema))`).
- Backend DTO files re-export schemas and types from shared (e.g., `export { signupSchema, type SignupInput } from '@base-dashboard/shared'`).
- No global `ValidationPipe` — validation is per-endpoint via Zod.

### Mongoose Schemas

- Use NestJS `@Schema()` and `@Prop()` decorators with `SchemaFactory.createForClass()`.
- Always enable `{ timestamps: true }` on schemas.
- Sensitive fields use `select: false` — explicitly `.select('+field')` when needed.
- Export both the class and the schema constant.
- Export a `Document` type: `export type UserDocument = HydratedDocument<User>`.

### Error Handling

- Use NestJS built-in exceptions: `ConflictException`, `UnauthorizedException`, `NotFoundException`, `BadRequestException`, etc.
- Never return raw error objects. Let the exception filter format them.
- A global `HttpExceptionFilter` (`common/filters/http-exception.filter.ts`) normalizes all errors into the `ApiErrorResponse` shape from `@base-dashboard/shared`: `{ statusCode, message, errors? }`. The `errors` array is preserved from `ZodValidationPipe` validation failures.

### Security

- **Authentication:** Global `JwtAuthGuard` protects all routes by default. Use `@Public()` to opt out for public endpoints.
- **Authorization:** `@Roles('admin')` + `@UseGuards(RolesGuard)` for role-restricted endpoints.
- **CORS:** Enabled via `app.enableCors()` in `main.ts`. For production, configure `origin` to restrict allowed domains — never ship wide-open CORS.
- **Input validation:** All request bodies and query params validated via `ZodValidationPipe` with schemas from `shared/`. This is the primary defense against malformed input — no additional sanitization layer needed for fields Zod validates.
- **No rate limiting or helmet yet.** When adding them: use `@nestjs/throttler` for rate limiting (apply globally via `ThrottlerGuard`, exempt health checks with `@SkipThrottle()`), and `helmet` middleware in `main.ts` for security headers.
- **Sensitive data:** Passwords and refresh tokens use `select: false` on Mongoose schemas. Never return these fields in API responses — use `findById()` (not `findByIdWithPassword()`) for normal reads.
- **Secrets:** Never hardcode secrets. All sensitive config comes from env vars via `ConfigService.getOrThrow()`.

### Environment Variables

- Access via `ConfigService` — use `getOrThrow()` for required variables, `get()` only for optional ones.
- All env vars documented in `.env.example`.

### Testing

- **Framework:** Jest + `@nestjs/testing` + `ts-jest`. Config in `backend/jest.config.ts`.
- **Run tests:** `pnpm test` (single run), `pnpm test:watch` (watch mode), `pnpm test:cov` (coverage).
- **File placement:** Colocate test files next to source — `auth.service.spec.ts` alongside `auth.service.ts`. No separate `test/` directory inside `src/`.
- **Naming:** `*.spec.ts` for unit tests. Use `describe` blocks matching the class/function name, nested `describe` blocks per method.
- **Unit tests only** (no E2E for now). Test services, guards, pipes, and filters in isolation.
- **When building a new feature, always write unit tests** for the service layer. Guards, pipes, and filters should also be tested if custom logic is added.

#### Mocking Pattern

- Use `@nestjs/testing` `Test.createTestingModule()` to build the test module.
- **Mock dependencies as plain objects with `jest.fn()` methods**, then provide them with `{ provide: ServiceClass, useValue: mockObject }`. Do NOT use `jest.Mocked<Partial<T>>` for typing — it causes TS errors with complex NestJS types.
- Call `jest.clearAllMocks()` in `beforeEach` to reset state between tests.
- For `bcrypt` and other native modules, use `jest.mock('bcrypt')` at the top of the file and cast to `jest.Mocked<typeof bcrypt>`.
- For Mongoose models, provide `{ provide: getModelToken(Entity.name), useValue: mockModel }` where `mockModel` is a plain object with `jest.fn()` methods like `create`, `find`, `findOne`, `findById`, `findByIdAndUpdate`, `findByIdAndDelete`, `countDocuments`, `exists`.
- For Mongoose query chains (`.find().skip().limit()`), mock as chainable objects: `{ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue(data) }`.
- For Mongoose select chains (`.findOne().select('+field')`), mock as: `{ select: jest.fn().mockResolvedValue(data) }`.

#### What to Test

- **Services:** All public methods — happy path, error cases, edge cases (e.g., first user gets admin role, cooldown logic).
- **Guards:** Role checking, missing roles metadata, multiple allowed roles.
- **Pipes:** Valid input passes through, invalid input throws `BadRequestException` with structured errors, non-body/query metadata types pass through unchanged.
- **Filters:** HttpException handling (string and object responses), non-HttpException → 500, validation errors array preservation.
- **Do NOT test controllers directly** — they are thin wrappers. Controller logic gets covered by service tests + future E2E tests.

#### Reference Test Files

- **Service with DI mocks:** `auth/auth.service.spec.ts` — mocking UsersService, JwtService, ConfigService, MailService, bcrypt.
- **Service with Mongoose model:** `users/users.service.spec.ts` — mocking Model methods and query chains.
- **Guard:** `auth/guards/roles.guard.spec.ts` — mocking Reflector and ExecutionContext.
- **Pipe:** `common/pipes/zod-validation.pipe.spec.ts` — testing with a real Zod schema.
- **Filter:** `common/filters/http-exception.filter.spec.ts` — mocking ArgumentsHost and Response.

## General

- **Package manager:** pnpm. Always use `pnpm add`, never `npm install` or `yarn add`.
- **Dev command:** `pnpm dev` at root runs both backend and frontend in parallel.
- **Build check:** Run `pnpm run build` in both packages before considering work complete.
- **No commented-out code.** Delete it; git has history.
- **No `console.log` in committed code.** Use proper error handling or logging.
