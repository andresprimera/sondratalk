# Themes + Circles — Frontend Plan

**Prerequisite:** [shared.md](shared.md) and [backend.md](backend.md) are complete; the backend dev server is running and admin JWT works.

**Reference files to mirror (open these before implementing):**

- [frontend/src/lib/users.ts](frontend/src/lib/users.ts) — API function shape (`fetch*Api`, `create*Api`, etc.).
- [frontend/src/lib/users.spec.ts](frontend/src/lib/users.spec.ts) — `vi.mock("@/lib/api")` pattern, one test per function.
- [frontend/src/pages/users.tsx](frontend/src/pages/users.tsx) — table + add dialog + delete confirm + pagination layout.
- [frontend/src/components/add-user-dialog.tsx](frontend/src/components/add-user-dialog.tsx) — Zod + react-hook-form + `standardSchemaResolver` + `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription` form pattern.
- [frontend/src/components/admin-route.tsx](frontend/src/components/admin-route.tsx) — admin guard wrapper.
- [frontend/src/router.tsx](frontend/src/router.tsx) — where to add the new routes.
- [frontend/src/components/app-sidebar.tsx](frontend/src/components/app-sidebar.tsx) — where to add sidebar entries (the `adminNavMain` array near the top).

**Conventions that apply (CLAUDE.md, in order):**

> "Pages use **default exports**. Components and hooks use **named exports**." (Lint-enforced — default exports outside `src/pages/**` will error.)

> "Use shadcn/ui for everything. Only build custom components when shadcn has no equivalent."

> "Do not modify files in `components/ui/`."

> "shadcn/ui is base-ui based — components use the `render` prop for composition (e.g., `<Button render={<Link to="/path" />}>`), **not** `asChild`."

> "All forms use Zod v4 + react-hook-form. No exceptions. Use `standardSchemaResolver` from `@hookform/resolvers/standard-schema` (not `zodResolver`)."

> "Translate validation errors at render time: even though schemas keep English messages, forms must wrap `errors.<field>.message` in `t()` when rendering — e.g., `{t(errors.email.message ?? "")}`."

> "Server state → React Query. … Local UI state → `useState` in the component that owns it."

> "Authenticated endpoints use `authFetch` … API functions should **never** accept an access token parameter."

> "API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads, `create`, `update`, `remove`) with an `Api` suffix."

> "Query keys are arrays — resource name first, then params: `['users', page, pageSize]`, `['users', userId]`."

> "Use `placeholderData: keepPreviousData` for paginated queries to avoid flash on page change."

> "Loading: Show the shadcn `Skeleton` component matching the shape of the expected content — not bare 'Loading...' text."

> "Error: Check `isError` / `error` from `useQuery`. Display an inline error message with a retry button (`refetch`)."

> "Empty: When data loads successfully but the list is empty, show a descriptive empty state."

> "Use `toast.error()` only for mutation failures, not for query errors."

> "When adding new UI strings: Add the key to both `en.json` and `es.json`, then use `t('key')` in the component."

> "Use **lucide-react** exclusively. Import specific icons by name."

> "When building a new feature, always write unit tests for the API functions in `src/lib/<feature>.ts`."

> "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete."

---

## Slice C — Themes admin UI

Ship after backend slice A is live.

### C.1 — API functions

**File to create:** `frontend/src/lib/themes.ts`

Mirror [frontend/src/lib/users.ts](frontend/src/lib/users.ts). Required exports:

```ts
import {
  type Theme,
  type PaginatedResponse,
  type CreateThemeInput,
  type UpdateThemeInput,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchThemesApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<Theme>> { ... }

export async function fetchAllThemesApi(): Promise<Theme[]> { ... }
// GET /api/themes/all — for the circles dialog picker. No pagination.

export async function fetchThemeByIdApi(id: string): Promise<Theme> { ... }

export async function createThemeApi(data: CreateThemeInput): Promise<Theme> { ... }

export async function updateThemeApi(
  id: string,
  data: UpdateThemeInput,
): Promise<Theme> { ... }

export async function removeThemeApi(id: string): Promise<void> { ... }
```

URL format mirrors `users.ts` (URLSearchParams for query string). For `removeThemeApi`, do `await authFetch(...); ` with no `.json()` — the backend returns 204.

### C.2 — API tests

**File to create:** `frontend/src/lib/themes.spec.ts`

Mirror [frontend/src/lib/users.spec.ts](frontend/src/lib/users.spec.ts). One `describe` per function. Each test:
1. Mocks `authFetch` with `mockJsonResponse(...)`.
2. Calls the function.
3. Asserts the URL, method, body match exactly.
4. Asserts the parsed response matches.

For `removeThemeApi`: assert the call shape but not the response body (it's `void`).

### C.3 — Add Theme dialog

**File to create:** `frontend/src/components/add-theme-dialog.tsx`

Mirror [frontend/src/components/add-user-dialog.tsx](frontend/src/components/add-user-dialog.tsx). **Named export**:

```tsx
export function AddThemeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) { ... }
```

Form schema: import `createThemeSchema` from `@base-dashboard/shared`. No frontend-only refinements needed for themes.

Fields (in this order):

1. `slug` — `Input` text. Description hint: `t("Lowercase, kebab-case (e.g. dogs, sports-cars)")`.
2. `label` — `Input` text. Required.
3. `sortOrder` — `Input type="number"`. Default `0`. Use `register("sortOrder", { valueAsNumber: true })` to coerce.

Wire `useMutation` with `mutationFn: createThemeApi`, `onSuccess` invalidates `["themes"]`, `onError` calls `toast.error`. Reset form on close.

### C.4 — Edit Theme dialog

**File to create:** `frontend/src/components/edit-theme-dialog.tsx`

Same shape as `AddThemeDialog`, but accepts an optional `theme: Theme | null`. When `theme` is non-null, populate form defaults via `useForm({ ... defaultValues: { slug: theme.slug, label: theme.label, sortOrder: theme.sortOrder } })`. Use `reset(...)` in a `useEffect` keyed on `theme?.id` so swapping rows updates the form.

Mutation: `updateThemeApi(theme.id, dto)`. Disable the slug input — slug is the stable identifier and editing it would invalidate any references.

### C.5 — Themes admin page

**File to create:** `frontend/src/pages/themes.tsx`

**Default export.** Mirror the structure of [frontend/src/pages/users.tsx](frontend/src/pages/users.tsx), with these adjustments:

- Heading: `t("Themes")` / description: `t("Manage circle umbrella categories.")`.
- Table columns: `Slug`, `Label`, `Sort Order`, `Actions`.
- No inline-editable cell (themes are simple — open the edit dialog instead). Add a pencil icon button next to the trash button per row, opening `EditThemeDialog` with the row's data.
- Delete confirm uses `AlertDialog` (same pattern as users page).
- Pagination block identical to users page.
- `useQuery({ queryKey: ["themes", page, pageSize], queryFn: () => fetchThemesApi(page, pageSize), placeholderData: keepPreviousData })`.
- Mutations invalidate `queryClient.invalidateQueries({ queryKey: ["themes"] })`.
- Empty state: `t("No themes found.")` centered, with a `LayersIcon` from lucide-react above it.

### C.6 — Routing

**File to modify:** `frontend/src/router.tsx`

Inside the `/dashboard` children array, add:

```tsx
{
  path: "themes",
  element: (
    <AdminRoute>
      <ThemesPage />
    </AdminRoute>
  ),
},
```

Import: `import ThemesPage from "@/pages/themes"`.

### C.7 — Sidebar entry

**File to modify:** `frontend/src/components/app-sidebar.tsx`

In the `adminNavMain` array (near line 27-33), add an entry below `Users`:

```tsx
{ title: t("Themes"), url: "/dashboard/themes", icon: <LayersIcon /> },
```

Import `LayersIcon` from `lucide-react` at the top of the file.

### C.8 — i18n strings (themes slice)

**Files to modify:** `frontend/src/locales/en.json` and `frontend/src/locales/es.json`.

Keys to add (key = English value; `es.json` value is the Spanish translation):

| Key | en.json | es.json |
|---|---|---|
| `Themes` | `Themes` | `Temas` |
| `Manage circle umbrella categories.` | (same) | `Administra las categorías generales de los círculos.` |
| `Add Theme` | (same) | `Añadir tema` |
| `Edit Theme` | (same) | `Editar tema` |
| `Delete theme` | (same) | `Eliminar tema` |
| `Theme created` | (same) | `Tema creado` |
| `Theme updated` | (same) | `Tema actualizado` |
| `Theme deleted` | (same) | `Tema eliminado` |
| `Failed to create theme` | (same) | `No se pudo crear el tema` |
| `Failed to update theme` | (same) | `No se pudo actualizar el tema` |
| `Failed to delete theme` | (same) | `No se pudo eliminar el tema` |
| `Failed to load themes.` | (same) | `No se pudieron cargar los temas.` |
| `No themes found.` | (same) | `No hay temas.` |
| `Slug` | (same) | `Slug` |
| `Label` | (same) | `Etiqueta` |
| `Sort Order` | (same) | `Orden` |
| `Lowercase, kebab-case (e.g. dogs, sports-cars)` | (same) | `Minúsculas, formato kebab-case (p. ej., dogs, sports-cars)` |
| `Slug is required` | (same) | `El slug es obligatorio` |
| `Slug must be lowercase kebab-case` | (same) | `El slug debe estar en minúsculas y formato kebab-case` |
| `Label is required` | (same) | `La etiqueta es obligatoria` |
| `Slug already in use` | (same) | `El slug ya está en uso` |
| `Theme not found` | (same) | `Tema no encontrado` |
| `{{count}} theme total` | (same, with `_one`/`_other` suffixed keys) | `{{count}} tema total` / `{{count}} temas en total` |

> CLAUDE.md: "Pluralization: `t("{{count}} user total", { count })` with `_one`/`_other` suffixed keys in JSON files."

For the pluralized count, both `_one` and `_other` keys must exist in both files.

### C.9 — Verify slice C

```bash
pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm --filter frontend test
pnpm --filter frontend build
```

Then start the dev server and exercise the page in a browser:

1. Log in as admin.
2. Navigate to `/dashboard/themes` via the sidebar.
3. Add a theme. Confirm it shows up.
4. Edit it. Confirm changes persist.
5. Try a duplicate slug. Confirm `Slug already in use` error.
6. Delete it. Confirm `AlertDialog` appears, then row removed.
7. Switch language to Spanish. Confirm all strings translate.

> CLAUDE.md: "Make sure to test the golden path and edge cases for the feature and monitor for regressions in other features."

---

## Slice D — Circles admin UI

Ship after backend slice B is live AND slice C is shipped.

### D.1 — API functions

**File to create:** `frontend/src/lib/circles.ts`

```ts
import {
  type Circle,
  type PaginatedResponse,
  type CreateCircleInput,
  type UpdateCircleInput,
  type CircleSearchQuery,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchCirclesApi(
  query: CircleSearchQuery,
): Promise<PaginatedResponse<Circle>> {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.themeId) params.set("themeId", query.themeId)
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  const res = await authFetch(`/api/circles?${params}`)
  return res.json()
}

export async function fetchCircleByIdApi(id: string): Promise<Circle> { ... }

export async function createCircleApi(data: CreateCircleInput): Promise<Circle> { ... }

export async function updateCircleApi(
  id: string,
  data: UpdateCircleInput,
): Promise<Circle> { ... }

export async function removeCircleApi(id: string): Promise<void> { ... }
```

`fetchCirclesApi` takes the full query object, not separate args, so adding new search filters later (e.g., a popularity threshold) doesn't break the signature.

### D.2 — API tests

**File to create:** `frontend/src/lib/circles.spec.ts`

Mirror `lib/users.spec.ts` and `lib/themes.spec.ts`. Cover:

- `fetchCirclesApi` with `q` only, `themeId` only, both, neither — assert URL params include the right keys in each case.
- `fetchCircleByIdApi`, `createCircleApi`, `updateCircleApi`, `removeCircleApi` — one happy-path test each.

### D.3 — Add Circle dialog

**File to create:** `frontend/src/components/add-circle-dialog.tsx`

Form fields:

1. `slug` — `Input`. Hint: `t("Lowercase, kebab-case (e.g. german-shepherd)")`.
2. `themeId` — `Select` populated by `useQuery({ queryKey: ["themes", "all"], queryFn: fetchAllThemesApi })`. Show theme `label`. Required.
3. `labels.en` — `Input`. Label: `t("English label")`. Required.
4. `labels.es` — `Input`. Label: `t("Spanish label")`. Required.
5. `aliases.en` — `Input` representing comma-separated aliases. Stored as `string[]` via a custom `Controller` that splits on `,` and trims.
6. `aliases.es` — same as above for Spanish.
7. `popularity` — `Input type="number"`. Default `0`. `valueAsNumber: true`.

Form schema: import `createCircleSchema` from `@base-dashboard/shared`. **The aliases field is the tricky one** — the schema expects `string[]` but the input is a textarea/string. Wire it through `Controller`:

```tsx
<Controller
  name="aliases.en"
  control={control}
  render={({ field }) => (
    <Input
      value={(field.value ?? []).join(", ")}
      onChange={(e) =>
        field.onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  )}
/>
```

Reuse this exact pattern for `aliases.es`.

Mutation: `createCircleApi`. `onSuccess` → invalidate `["circles"]` AND `["themes"]` (since theme document totals don't change, the second invalidation is technically unnecessary; just `["circles"]` is enough). `toast.success(t("Circle created"))`. Reset form on close.

### D.4 — Edit Circle dialog

**File to create:** `frontend/src/components/edit-circle-dialog.tsx`

Same shape as Add. Receives `circle: Circle | null`. Populate defaults from the circle, including the joined-string representation of aliases. Slug is **disabled** for editing (same reasoning as themes — slug is the stable identifier).

### D.5 — Circles admin page

**File to create:** `frontend/src/pages/circles.tsx`

**Default export.** Larger than the themes page because of the search bar + theme filter. Layout sketch:

```
[ Heading + description ]                              [ Add Circle button ]
[ Search input  ]  [ Theme filter Select ]
[ Table: Slug | English Label | Spanish Label | Theme | Popularity | Actions ]
[ Pagination row ]
```

State:

```ts
const [page, setPage] = useState(1)
const [pageSize, setPageSize] = useState(10)
const [q, setQ] = useState("")
const [themeId, setThemeId] = useState<string | undefined>(undefined)
const [editCircle, setEditCircle] = useState<Circle | null>(null)
const [deleteCircleId, setDeleteCircleId] = useState<string | null>(null)
const [addOpen, setAddOpen] = useState(false)
```

Debounce `q` to avoid hammering the backend on every keystroke. Cheapest approach without adding a library:

```ts
const [debouncedQ, setDebouncedQ] = useState(q)
useEffect(() => {
  const id = setTimeout(() => setDebouncedQ(q), 250)
  return () => clearTimeout(id)
}, [q])
```

Reset `page` to `1` whenever `debouncedQ` or `themeId` changes:

```ts
useEffect(() => { setPage(1) }, [debouncedQ, themeId])
```

Query:

```ts
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ["circles", { q: debouncedQ, themeId, page, pageSize }],
  queryFn: () =>
    fetchCirclesApi({ q: debouncedQ || undefined, themeId, page, limit: pageSize }),
  placeholderData: keepPreviousData,
})
```

Theme filter Select uses `fetchAllThemesApi` and includes a `t("All themes")` option (value `""`, mapped to `undefined` for the query).

Empty state copy adapts: `t("No circles found.")` if no filters; `t("No circles match your search.")` if `q` or `themeId` is set.

Edit and delete actions use the same trash + pencil button pattern as themes/users. Pagination block identical.

Theme column: render `theme.label`, looked up from the `["themes", "all"]` cache (already populated by the dialog). Memo the lookup map:

```ts
const { data: allThemes } = useQuery({ queryKey: ["themes", "all"], queryFn: fetchAllThemesApi })
const themeMap = useMemo(
  () => Object.fromEntries((allThemes ?? []).map((t) => [t.id, t.label])),
  [allThemes],
)
```

### D.6 — Routing

**File to modify:** `frontend/src/router.tsx`

Add inside `/dashboard` children:

```tsx
{
  path: "circles",
  element: (
    <AdminRoute>
      <CirclesPage />
    </AdminRoute>
  ),
},
```

Import: `import CirclesPage from "@/pages/circles"`.

### D.7 — Sidebar entry

**File to modify:** `frontend/src/components/app-sidebar.tsx`

In `adminNavMain`, below the `Themes` entry:

```tsx
{ title: t("Circles"), url: "/dashboard/circles", icon: <CircleDotIcon /> },
```

Import `CircleDotIcon` from `lucide-react`.

### D.8 — i18n strings (circles slice)

**Files to modify:** `frontend/src/locales/en.json` and `frontend/src/locales/es.json`.

| Key | en.json | es.json |
|---|---|---|
| `Circles` | (same) | `Círculos` |
| `Manage granular circle topics within themes.` | (same) | `Administra los temas granulares dentro de cada categoría.` |
| `Add Circle` | (same) | `Añadir círculo` |
| `Edit Circle` | (same) | `Editar círculo` |
| `Delete circle` | (same) | `Eliminar círculo` |
| `Circle created` | (same) | `Círculo creado` |
| `Circle updated` | (same) | `Círculo actualizado` |
| `Circle deleted` | (same) | `Círculo eliminado` |
| `Failed to create circle` | (same) | `No se pudo crear el círculo` |
| `Failed to update circle` | (same) | `No se pudo actualizar el círculo` |
| `Failed to delete circle` | (same) | `No se pudo eliminar el círculo` |
| `Failed to load circles.` | (same) | `No se pudieron cargar los círculos.` |
| `No circles found.` | (same) | `No hay círculos.` |
| `No circles match your search.` | (same) | `Ningún círculo coincide con tu búsqueda.` |
| `English label` | (same) | `Etiqueta en inglés` |
| `Spanish label` | (same) | `Etiqueta en español` |
| `English aliases` | (same) | `Alias en inglés` |
| `Spanish aliases` | (same) | `Alias en español` |
| `Comma-separated alternative names.` | (same) | `Nombres alternativos separados por coma.` |
| `Theme` | (same) | `Tema` |
| `All themes` | (same) | `Todos los temas` |
| `Popularity` | (same) | `Popularidad` |
| `Search circles...` | (same) | `Buscar círculos...` |
| `Lowercase, kebab-case (e.g. german-shepherd)` | (same) | `Minúsculas, formato kebab-case (p. ej., german-shepherd)` |
| `Theme is required` | (same) | `El tema es obligatorio` |
| `Theme not found` | (same) | `Tema no encontrado` |
| `Circle not found` | (same) | `Círculo no encontrado` |
| `{{count}} circle total` (`_one` / `_other`) | per CLAUDE.md plural pattern | `{{count}} círculo total` / `{{count}} círculos en total` |

### D.9 — Verify slice D

```bash
pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm --filter frontend test
pnpm --filter frontend build
```

Browser pass:

1. Add a theme `dogs` (via the Themes page from slice C).
2. Navigate to `/dashboard/circles`.
3. Add a circle: slug `german-shepherd`, theme `dogs`, English label `German Shepherd`, Spanish label `Pastor Alemán`, English aliases `GSD, Alsatian`, Spanish aliases empty.
4. Search for `pastor` — confirm the row appears.
5. Search for `gsd` — confirm the row appears (alias hit).
6. Search for `pastor aleman` (no accent) — confirm the row appears.
7. Filter by theme `dogs` — only that circle shows.
8. Edit the circle, change the English label, save. Confirm the table updates.
9. Try a duplicate slug. Confirm error toast.
10. Delete it. Confirm `AlertDialog`.
11. Toggle to Spanish UI. Confirm all strings translate.

---

## What this slice ships

After both slices C and D land:

- Two new sidebar entries (`Themes`, `Circles`) for admin users.
- Two new routes (`/dashboard/themes`, `/dashboard/circles`) wrapped in `<AdminRoute>`.
- Four new dialog components, all following the `add-user-dialog` pattern.
- Two new API files (`lib/themes.ts`, `lib/circles.ts`) with full unit-test coverage.
- ~50 new i18n keys in both `en.json` and `es.json`.
- A working multilingual circle search with debounced input and theme filter.

The end-user picker UI to attach circles to users / groups / conversations is **not** in this plan — once this admin catalog ships, that's a follow-up plan that will reuse `fetchCirclesApi` directly.
