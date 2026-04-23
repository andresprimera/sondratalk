# Project Rules & Standards

## Architecture

pnpm monorepo with three packages: `backend` (NestJS 11 + Mongoose), `frontend` (Vite + React 19 + React Router v7), and `shared` (`@base-dashboard/shared` — Zod schemas and types). All entity/API types are defined in `shared/` and imported by both backend and frontend. Never duplicate types across packages. The shared package has no build step — it exports raw TS via `"main": "src/index.ts"`.

## TypeScript — Zero Tolerance

- **No `any` types.** No exceptions. If a library returns `any`, wrap it with a proper type.
- **No type assertions** (`as`). Use type guards, generics, or proper narrowing instead. Exception: Mongoose enum fields return `string` — cast to the shared union type (e.g., `user.role as Role`).
- **No single-use local types** for data that comes from the database or API. Import the canonical type from `shared/`.
- Infer from schemas when possible: `z.infer<typeof schema>` for Zod, `HydratedDocument<T>` for Mongoose.
- Explicit return types on all service methods (backend) and API functions (frontend).

## Frontend

### Components

- **Use shadcn/ui for everything.** Only build custom components when shadcn has no equivalent.
- **Do not customize shadcn component styles** unless absolutely necessary. Use the built-in variants and sizes. Override via `className` prop with Tailwind utilities only when the variant system doesn't cover the case.
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

### Data Fetching

- Use **TanStack React Query** for server state (queries, mutations, caching).
- API functions live in `src/lib/` — plain `fetch` with the `authFetch` wrapper. No axios.
- All API calls go through the `/api` proxy (Vite dev server proxies to backend).

### File Organization

```
frontend/src/
  components/       # Reusable components (named exports)
    ui/             # shadcn components — do not edit directly
  hooks/            # Custom hooks (useAuth, useMobile, etc.)
  lib/              # Utilities and API functions
  pages/            # Page components (default exports)
```

- Files use **kebab-case**: `login-form.tsx`, `use-auth.tsx`.
- Imports use the **`@/` alias** — never relative paths with `../`.

### Icons

- Use **lucide-react** exclusively. Import specific icons by name.

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

### DTOs & Validation

- Validation uses **Zod schemas from `@base-dashboard/shared`** with `ZodValidationPipe` applied per-param (e.g., `@Body(new ZodValidationPipe(schema))`).
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

### Environment Variables

- Access via `ConfigService` — use `getOrThrow()` for required variables, `get()` only for optional ones.
- All env vars documented in `.env.example`.

## General

- **Package manager:** pnpm. Always use `pnpm add`, never `npm install` or `yarn add`.
- **Dev command:** `pnpm dev` at root runs both backend and frontend in parallel.
- **Build check:** Run `pnpm run build` in both packages before considering work complete.
- **No commented-out code.** Delete it; git has history.
- **No `console.log` in committed code.** Use proper error handling or logging.
