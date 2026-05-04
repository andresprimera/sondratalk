# Sales — City-Aggregate Stock — Frontend Plan

**Prerequisite:** shared contract from `overview.md` is implemented; backend endpoints from `backend.md` are live (`POST /api/sales` accepts the new shape; `GET /api/inventory/city-stock?productId=&cityId=` returns `{ productId, cityId, totalQty }`).

## File layout

- [frontend/src/lib/sales.ts](frontend/src/lib/sales.ts) — input shape changes; no new functions.
- [frontend/src/lib/sales.spec.ts](frontend/src/lib/sales.spec.ts) — update create-sale test for new payload.
- [frontend/src/lib/inventory.ts](frontend/src/lib/inventory.ts) — add `fetchCityStockApi`.
- [frontend/src/lib/inventory.spec.ts](frontend/src/lib/inventory.spec.ts) — add a test for the new API function.
- [frontend/src/lib/cities.ts](frontend/src/lib/cities.ts) — confirm a city-options fetcher exists (it likely does, since cities are used elsewhere); if not, add one.
- [frontend/src/components/sale-form-dialog.tsx](frontend/src/components/sale-form-dialog.tsx) — major rework: drop `AllocationFields`, add admin city selector, replace per-warehouse stock display with city-aggregate stock display.
- [frontend/src/locales/en.json](frontend/src/locales/en.json) and [frontend/src/locales/es.json](frontend/src/locales/es.json) — new strings.

## Step 1 — `lib/sales.ts`: update `createSaleApi`

**File:** [frontend/src/lib/sales.ts](frontend/src/lib/sales.ts)

`createSaleApi` already takes `CreateSaleInput` from shared, so the function signature does not change. The shape change in shared automatically propagates. **No code edit needed in this file** — but update the test (Step 2).

## Step 2 — `lib/sales.spec.ts`: update payload assertion

**File:** [frontend/src/lib/sales.spec.ts](frontend/src/lib/sales.spec.ts)

Update the `createSaleApi` test:

- The mocked request body should no longer include `allocations` inside items.
- Items should be `{ productId, requestedQty, unitPrice }` only.
- Add a test that `cityId` is included in the body when provided.

> CLAUDE.md: "API functions (`src/lib/`): Correct URL, HTTP method, request body, and response parsing. One test per function."

Reference: [frontend/src/lib/users.spec.ts](frontend/src/lib/users.spec.ts) for the `vi.mock("@/lib/api")` + `vi.mocked(authFetch)` pattern.

## Step 3 — `lib/inventory.ts`: add `fetchCityStockApi`

**File:** [frontend/src/lib/inventory.ts](frontend/src/lib/inventory.ts)

Add:

```ts
import { type CityStock } from "@base-dashboard/shared";

export async function fetchCityStockApi(params: {
  productId: string;
  cityId: string;
}): Promise<CityStock> {
  const search = new URLSearchParams({
    productId: params.productId,
    cityId: params.cityId,
  });
  const res = await authFetch(`/api/inventory/city-stock?${search}`);
  return res.json();
}
```

> CLAUDE.md: "API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads, …) with an `Api` suffix."
> CLAUDE.md: "Authenticated endpoints use `authFetch` … API functions should **never** accept an access token parameter."

Reference: [frontend/src/lib/inventory.ts](frontend/src/lib/inventory.ts) — see how `fetchStockByWarehouseApi` is structured for query-param patterns.

## Step 4 — `lib/inventory.spec.ts`: add test for `fetchCityStockApi`

**File:** [frontend/src/lib/inventory.spec.ts](frontend/src/lib/inventory.spec.ts)

One test: asserts URL is `/api/inventory/city-stock?productId=...&cityId=...`, GET, returns the parsed JSON.

## Step 5 — `sale-form-dialog.tsx`: remove `AllocationFields`

**File:** [frontend/src/components/sale-form-dialog.tsx](frontend/src/components/sale-form-dialog.tsx)

### 5a. Delete the `AllocationFields` component entirely

Including the `useFieldArray` for allocations, the `fetchStockByWarehouseApi` query inside it, and all UI markup. Delete every reference.

> CLAUDE.md: "No commented-out code. Delete it; git has history."

### 5b. Update `defaultItem` and `defaultValues`

```ts
const defaultItem: CreateSaleInput["items"][number] = {
  productId: "",
  requestedQty: 1,
  unitPrice: 0,
};

const defaultValues: CreateSaleInput = {
  cityId: undefined,
  clientId: "",
  notes: "",
  items: [defaultItem],
};
```

### 5c. Add a city selector (admin-only)

Use `useAuth()` from `@/hooks/use-auth` (or wherever the hook lives — search the codebase: `pages/users.tsx` uses it for role checks).

Render a `Field` containing a `Select` populated by `fetchCitiesApi` (or the existing city-options fetcher — verify in `lib/cities.ts`). Show only when `user.role === "admin"`. Required when shown.

```tsx
{user.role === "admin" && (
  <Field>
    <FieldLabel>{t("City")}</FieldLabel>
    <Controller
      name="cityId"
      control={control}
      render={({ field }) => (
        <Select
          value={field.value || ""}
          onValueChange={(val) => val && field.onChange(val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("Select city")} />
          </SelectTrigger>
          <SelectContent>
            {cityOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
    {errors.cityId && (
      <FieldDescription className="text-destructive">
        {t(errors.cityId.message ?? "")}
      </FieldDescription>
    )}
  </Field>
)}
```

> CLAUDE.md: "shadcn/ui is base-ui based — components use the `render` prop for composition, not `asChild`."
> CLAUDE.md: "Use shadcn `Dialog` for forms or content that appears in an overlay." (already in use; keep).

### 5d. Resolve the effective city for stock display

```tsx
const { user } = useAuth();
const effectiveCityId =
  user.role === "admin"
    ? useWatch({ control, name: "cityId" })
    : user.cityId;
```

If a sales-person has no `cityId` on their user record, render an inline error block at the top of the dialog (`<div role="alert" class="…text-destructive…">`) and disable the submit button. Message: `t("Your account has no assigned city. Contact an admin.")`.

### 5e. Replace per-warehouse stock display with city stock

Add per-item live stock display via `fetchCityStockApi`:

```tsx
const { data: cityStock } = useQuery({
  queryKey: ["stock", "by-city", { productId, cityId: effectiveCityId }],
  queryFn: () =>
    fetchCityStockApi({ productId, cityId: effectiveCityId! }),
  enabled: !!productId && !!effectiveCityId,
  staleTime: 30_000,
});
```

> CLAUDE.md: "Query keys are arrays — resource name first, then params."

Render below each item: `t("Available in {{city}}: {{qty}}", { city: cityName, qty: cityStock?.totalQty ?? 0 })`. Color the description text destructive if `requestedQty > cityStock.totalQty` (client-side hint; the server is the source of truth).

### 5f. Update `onSubmit`

```ts
function onSubmit(values: CreateSaleInput) {
  mutation.mutate({
    cityId: user.role === "admin" ? values.cityId : undefined,
    clientId: values.clientId,
    notes: values.notes?.trim() || undefined,
    items: values.items.map((item) => ({
      productId: item.productId,
      requestedQty: Number(item.requestedQty),
      unitPrice: Number(item.unitPrice),
    })),
  });
}
```

### 5g. Update `DialogDescription` copy

Change from "Pick products and the warehouse(s) they ship from. Mix warehouses if a single one doesn't have enough stock." to something like `t("Pick products. Stock is checked across all warehouses in the city.")`.

### 5h. Pre-submit guard

Disable the submit button when `effectiveCityId` is missing (sales-person without a city, or admin who hasn't picked one). Tooltip / `FieldDescription` explaining why.

## Step 6 — Routing & sidebar

No changes required.

## Step 7 — i18n strings

Add these to both [frontend/src/locales/en.json](frontend/src/locales/en.json) and [frontend/src/locales/es.json](frontend/src/locales/es.json) (English value = key; Spanish value translated):

| Key (English) | Spanish |
|---|---|
| `City` | `Ciudad` |
| `Select city` | `Selecciona una ciudad` |
| `Pick products. Stock is checked across all warehouses in the city.` | `Selecciona productos. El stock se verifica en todos los almacenes de la ciudad.` |
| `Available in {{city}}: {{qty}}` | `Disponible en {{city}}: {{qty}}` |
| `Your account has no assigned city. Contact an admin.` | `Tu cuenta no tiene una ciudad asignada. Contacta a un administrador.` |

**Remove** these keys from both files (no longer used):

- `Warehouse allocations`
- `Select warehouse`
- `Pick a product first`
- `Add warehouse`
- `Pick products and the warehouse(s) they ship from. Mix warehouses if a single one doesn't have enough stock.`

> CLAUDE.md: "When adding new UI strings: Add the key to both `en.json` and `es.json`, then use `t('key')` in the component."
> CLAUDE.md: "Translation keys are the exact English string — flat structure, no nested/semantic keys."

## Step 8 — Tests

**File:** colocated test for `sale-form-dialog` if one exists; otherwise skip — pure form components without a test today don't need one introduced as part of this task. (Spot check: `ls frontend/src/components/sale-form-dialog.spec.tsx`. If it exists, update it; if not, leave it.)

API function tests already covered in Steps 2 + 4.

> CLAUDE.md: "Form components: Test that validation errors display on invalid input, that successful submission calls the correct API/mutation, and that loading/error states render."

## Step 9 — Manual browser test

1. Start dev server: `pnpm dev`.
2. Log in as **sales-person** (with city assigned). Open new sale modal — verify no city selector visible, verify city-aggregate stock shows under each item, verify submit succeeds.
3. Log in as **sales-person without city** (temporarily clear `user.cityId` in DB). Open modal — verify the inline error and disabled submit.
4. Log in as **admin**. Open new sale modal — verify city selector is visible and required, verify stock display updates when city changes, verify submit succeeds.
5. Try to oversell: pick a quantity higher than the city aggregate. Verify the toast error from the server message ("Insufficient stock for X in city Y…").

> CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete. Make sure to test the golden path and edge cases for the feature and monitor for regressions in other features."

## Step 10 — Verify

- `pnpm --filter frontend lint`
- `pnpm --filter frontend test`
- `pnpm --filter frontend build`
