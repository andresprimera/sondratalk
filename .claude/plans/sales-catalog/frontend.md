# Sales Catalog — Frontend Plan

**Prerequisite:** shared `productListQuerySchema` is in place and the backend `GET /api/products` accepts the new filter query params for `salesPerson` (see `overview.md` and `backend.md`).

The frontend changes split into four pieces, in this order:

1. Extend `fetchProductsApi` to accept filters; update existing admin page caller; add tests.
2. Build the cart context (`useSaleCart` + provider) — single source of truth for cart state, replacing the dialog's local state and localStorage.
3. Build the drawer (`SaleCartDrawer`), the header trigger (`SaleCartButton`), and wire them into `DashboardLayout` + `SiteHeader`.
4. Build the `CatalogPage` with filters and "Add to order" buttons. Refactor `SaleFormDialog` to consume the cart hook and remove its inline product picker. Add route, sidebar entry, i18n strings.

Each step lists the file paths, the exact symbols, and the CLAUDE.md rules that apply.

## File map (everything new or touched)

**New:**
- `frontend/src/hooks/use-sale-cart.tsx` — context, provider, hook.
- `frontend/src/hooks/use-sale-cart.spec.tsx` — hook tests.
- `frontend/src/components/sale-cart-drawer.tsx` — right-side `Sheet` showing cart contents.
- `frontend/src/components/sale-cart-button.tsx` — header trigger with item-count badge.
- `frontend/src/pages/catalog.tsx` — the new browse page (default export).

**Modified:**
- `frontend/src/lib/products.ts` — `fetchProductsApi` signature changes.
- `frontend/src/lib/products.spec.ts` — tests updated for new signature + filters.
- `frontend/src/pages/products.tsx` — adapt to new `fetchProductsApi` signature.
- `frontend/src/components/sale-form-dialog.tsx` — consume `useSaleCart()`; remove `PersistedCart` / `loadCart` / `saveCart` / `clearCart` / `STORAGE_KEY_PREFIX` / inline "Add product to order" card / `draftProduct` / `draftQty` state.
- `frontend/src/components/dashboard-layout.tsx` — wrap with `<SaleCartProvider>`, mount `<SaleCartDrawer />`.
- `frontend/src/components/site-header.tsx` — add `<SaleCartButton />` next to `LanguageToggle` / `ThemeToggle`.
- `frontend/src/components/app-sidebar.tsx` — add Catalog entry to admin nav AND salesPerson nav.
- `frontend/src/router.tsx` — register `/dashboard/catalog`.
- `frontend/src/locales/en.json` and `frontend/src/locales/es.json` — new strings.

## Step 1 — Extend `fetchProductsApi`

**File:** [frontend/src/lib/products.ts](frontend/src/lib/products.ts)

Change the signature to take a single args object — same pattern as `fetchStockByWarehouseApi` in [frontend/src/lib/inventory.ts](frontend/src/lib/inventory.ts) (which accepts an args object with optional filters).

```ts
import {
  type Product,
  type ProductOption,
  type PaginatedResponse,
  type ProductKind,
  type LiquorType,
  type CreateProductInput,
  type UpdateProductInput,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export interface FetchProductsArgs {
  page: number
  limit: number
  kind?: ProductKind
  liquorType?: LiquorType
  minPrice?: number
  maxPrice?: number
  search?: string
}

export async function fetchProductsApi(
  args: FetchProductsArgs,
): Promise<PaginatedResponse<Product>> {
  const params = new URLSearchParams({
    page: String(args.page),
    limit: String(args.limit),
  })
  if (args.kind) params.set("kind", args.kind)
  if (args.liquorType) params.set("liquorType", args.liquorType)
  if (args.minPrice !== undefined) params.set("minPrice", String(args.minPrice))
  if (args.maxPrice !== undefined) params.set("maxPrice", String(args.maxPrice))
  if (args.search) params.set("search", args.search)
  const res = await authFetch(`/api/products?${params}`)
  return res.json()
}
```

Leave `createProductApi`, `updateProductApi`, `removeProductApi`, `fetchProductOptionsApi` untouched.

> CLAUDE.md: "API functions use `<verb><Resource>Api()` — same verbs as backend (`fetch` for reads…) with an `Api` suffix." — name unchanged.
> CLAUDE.md: "Authenticated endpoints use `authFetch` … API functions should never accept an access token parameter."
> CLAUDE.md (TypeScript): "No type assertions (`as`)." — passing `String(args.minPrice)` avoids the cast.

### Update the admin page caller

**File:** [frontend/src/pages/products.tsx](frontend/src/pages/products.tsx)

The `useQuery` call near line 79 currently reads:

```ts
const { data, ... } = useQuery({
  queryKey: ["products", page, pageSize],
  queryFn: () => fetchProductsApi(page, pageSize),
  placeholderData: keepPreviousData,
})
```

Change to:

```ts
const { data, ... } = useQuery({
  queryKey: ["products", { page, pageSize }],
  queryFn: () => fetchProductsApi({ page, limit: pageSize }),
  placeholderData: keepPreviousData,
})
```

> CLAUDE.md: "Query keys are arrays — resource name first, then params." — using an object as the second key element keeps it stable across hash equality.

### Tests

**File:** [frontend/src/lib/products.spec.ts](frontend/src/lib/products.spec.ts)

Reference: existing tests in the same file (the `fetchProductsApi` describe block and the module-mock pattern).

Update the existing `fetchProductsApi` tests to the new signature, and add new cases:

1. **Bare pagination** — `fetchProductsApi({ page: 1, limit: 10 })` → URL `/api/products?page=1&limit=10`.
2. **Kind filter** — `{ page: 1, limit: 10, kind: 'liquor' }` → `/api/products?page=1&limit=10&kind=liquor`.
3. **Liquor type** — `{ ..., liquorType: 'rum' }` → URL contains `liquorType=rum`.
4. **Price range** — `{ ..., minPrice: 5, maxPrice: 50 }` → URL contains `minPrice=5&maxPrice=50`.
5. **Min only / max only** — only the present param is appended.
6. **Search** — `{ ..., search: 'Bacardi' }` → `search=Bacardi` (URLSearchParams handles encoding).
7. **All filters together** — every param present.

Use the existing `vi.mock("@/lib/api")` + `vi.mocked(authFetch)` pattern, asserting both `expect(authFetch).toHaveBeenCalledWith(...)` and the returned value.

> CLAUDE.md: "API functions (`src/lib/`): Correct URL, HTTP method, request body, and response parsing. One test per function." — extend rather than fragment.

## Step 2 — Cart context (`useSaleCart`)

**File:** `frontend/src/hooks/use-sale-cart.tsx`

This file replaces the cart-state plumbing currently inside `SaleFormDialog`. Move these constants and helpers from [frontend/src/components/sale-form-dialog.tsx](frontend/src/components/sale-form-dialog.tsx) (lines 57–102) verbatim:

- The `CartItem` interface (line 57).
- The `PersistedCart` interface (line 66).
- `STORAGE_KEY_PREFIX = "sale-cart-v1:"` (line 73) — **keep this string identical** so existing user carts continue to load.
- `loadCart`, `saveCart`, `clearCart` helpers (lines 75–102).

Add a context + provider + hook:

```tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import {
  type Currency,
  type ProductKind,
  type Product,
  type ProductOption,
} from "@base-dashboard/shared"
import { useAuth } from "@/hooks/use-auth"

export interface CartItem {
  productId: string
  productName: string
  productKind: ProductKind
  requestedQty: number
  unitPrice: number
  currency: Currency
}

interface PersistedCart {
  cityId?: string
  clientId: string
  notes: string
  items: CartItem[]
}

const STORAGE_KEY_PREFIX = "sale-cart-v1:"

// loadCart / saveCart / clearCart — moved verbatim from sale-form-dialog.tsx

interface SaleCartContextValue {
  // cart contents
  items: CartItem[]
  cityId: string | undefined
  clientId: string
  notes: string

  // mutators
  addItem: (product: Product | ProductOption, qty?: number) => void
  updateQty: (productId: string, qty: number) => void
  removeItem: (productId: string) => void
  clearItems: () => void
  setCityId: (cityId: string | undefined) => void
  setClientId: (clientId: string) => void
  setNotes: (notes: string) => void
  resetAll: () => void

  // derived
  totalQty: number
  totalAmount: number
  totalCurrency: Currency

  // drawer UI
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void
}

const SaleCartContext = createContext<SaleCartContextValue | null>(null)

export function SaleCartProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth()
  const userId = user?.id

  const [items, setItems] = useState<CartItem[]>([])
  const [cityId, setCityIdState] = useState<string | undefined>(undefined)
  const [clientId, setClientIdState] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  // hydrate once per userId
  const hydratedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!userId || hydratedRef.current === userId) return
    hydratedRef.current = userId
    const saved = loadCart(userId)
    if (saved) {
      setItems(saved.items)
      setCityIdState(saved.cityId)
      setClientIdState(saved.clientId)
      setNotes(saved.notes)
    }
  }, [userId])

  // persist on every change
  useEffect(() => {
    if (!userId) return
    saveCart(userId, { cityId, clientId, notes, items })
  }, [userId, cityId, clientId, notes, items])

  function addItem(product: Product | ProductOption, qty: number = 1): void {
    if (qty < 1) return
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, requestedQty: i.requestedQty + qty }
            : i,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          productKind: product.kind,
          requestedQty: qty,
          unitPrice: product.price.value,
          currency: product.price.currency,
        },
      ]
    })
  }

  function updateQty(productId: string, qty: number): void {
    if (qty < 1) return
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, requestedQty: qty } : i)),
    )
  }

  function removeItem(productId: string): void {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function clearItems(): void {
    setItems([])
    setNotes("")
  }

  function setCityId(next: string | undefined): void {
    if (next !== cityId && items.length > 0) setItems([])
    setCityIdState(next)
  }

  function setClientId(next: string): void {
    if (next !== clientId && items.length > 0) setItems([])
    setClientIdState(next)
  }

  function resetAll(): void {
    setItems([])
    setNotes("")
    setCityIdState(undefined)
    setClientIdState("")
    if (userId) clearCart(userId)
  }

  const totalQty = items.reduce((s, i) => s + i.requestedQty, 0)
  const totalAmount = items.reduce((s, i) => s + i.requestedQty * i.unitPrice, 0)
  const totalCurrency: Currency = items[0]?.currency ?? "USD"

  const value: SaleCartContextValue = {
    items, cityId, clientId, notes,
    addItem, updateQty, removeItem, clearItems,
    setCityId, setClientId, setNotes, resetAll,
    totalQty, totalAmount, totalCurrency,
    isDrawerOpen,
    openDrawer: () => setIsDrawerOpen(true),
    closeDrawer: () => setIsDrawerOpen(false),
    toggleDrawer: () => setIsDrawerOpen((v) => !v),
  }

  return <SaleCartContext.Provider value={value}>{children}</SaleCartContext.Provider>
}

export function useSaleCart(): SaleCartContextValue {
  const ctx = useContext(SaleCartContext)
  if (!ctx) throw new Error("useSaleCart must be used inside <SaleCartProvider>")
  return ctx
}
```

Notes:
- The "clear items when city/client changes" rule mirrors today's behavior in `sale-form-dialog.tsx` (lines 268–280). It carries over because the constraints are the same: items are city-scoped at fulfillment time.
- `resetAll` is what the dialog's `mutation.onSuccess` will call (instead of the dialog clearing its own state + the localStorage line).
- The `Product` type imported here is the discriminated union from shared — `addItem(product)` accepts a full `Product`, not a `ProductOption`, so we capture `kind` correctly. The catalog page already has full `Product` rows in scope.
- **Don't add a new context lightly.** The CLAUDE.md rule says "Do not add new React Contexts without strong justification — most 'global' state is actually server state that belongs in React Query." Cart state is **client state** (mutations live entirely on the client until checkout), it's needed in three sibling subtrees (catalog page, drawer, header trigger), and React Query has no native model for it. This is the justification — call it out explicitly in the file's only comment if it helps future readers.

> CLAUDE.md: "Local UI state → `useState` in the component that owns it." — does not apply: cart is shared across siblings.
> CLAUDE.md: "Do not add new React Contexts without strong justification — most 'global' state is actually server state that belongs in React Query."
> ESLint banned in frontend: `'use client'` / `'use server'` directives — do NOT add either at the top of this file.

### Tests

**File:** `frontend/src/hooks/use-sale-cart.spec.tsx`

Reference: there's no existing custom-hook test in the repo yet. Use `renderHook` from `@testing-library/react` + an `AuthProvider` wrapper. Pattern hint from CLAUDE.md:

> CLAUDE.md: "Custom hooks with logic: Use `renderHook` from `@testing-library/react`. … Wrap in necessary providers (QueryClientProvider, AuthProvider, etc.) via a `wrapper` option."

Tests to write (each in its own `it`):

1. `useSaleCart` throws when used outside the provider.
2. `addItem` adds a new line and stamps `productId/productName/productKind/unitPrice/currency`.
3. `addItem` for a product already in the cart **increments** `requestedQty` instead of duplicating.
4. `updateQty` updates the quantity for the matching line; `qty < 1` is a no-op.
5. `removeItem` removes only the matching line.
6. `clearItems` empties items AND blanks notes (matches the dialog's "Clear order" behavior at line 322–325).
7. `setCityId(newCity)` clears items when items is non-empty (mirrors `changeCityId` at line 268).
8. `setClientId(newClient)` clears items when items is non-empty (mirrors `changeClientId` at line 275).
9. `totalQty` / `totalAmount` / `totalCurrency` derivations are correct across multi-item carts; `totalCurrency` falls back to `"USD"` when empty.
10. `openDrawer` / `closeDrawer` / `toggleDrawer` flip `isDrawerOpen`.
11. **Persistence**: stub `localStorage` (`vi.spyOn(Storage.prototype, 'setItem')` + `getItem`); after `addItem`, `setItem` was called with key `sale-cart-v1:<userId>` and the JSON-serialized state.
12. **Hydration**: when the provider mounts and `localStorage` already contains a saved cart for the userId, the hook returns those items. (Use a wrapper that pre-seeds `localStorage.setItem` before render.)
13. `resetAll` empties everything AND removes the localStorage entry (`removeItem` called).

> CLAUDE.md: "Form components / Custom hooks: Test that validation errors display on invalid input, that successful submission calls the correct API/mutation, and that loading/error states render."

## Step 3 — Drawer + header trigger + layout wiring

### `frontend/src/components/sale-cart-drawer.tsx`

Right-side `Sheet` (uses [frontend/src/components/ui/sheet.tsx](frontend/src/components/ui/sheet.tsx) — already exists, default `side="right"`).

Skeleton:

```tsx
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useSaleCart } from "@/hooks/use-sale-cart"
import { useAuth } from "@/hooks/use-auth"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { SaleFormDialog } from "@/components/sale-form-dialog"
import { MinusIcon, PlusIcon, TrashIcon, ShoppingCartIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { i18n } from "@/lib/i18n"

function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat(i18n.language, { style: "currency", currency }).format(value)
}

export function SaleCartDrawer(): React.JSX.Element | null {
  const { user } = useAuth()
  const role = user?.role
  const { t } = useTranslation()
  const cart = useSaleCart()
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  if (role !== "admin" && role !== "salesPerson") return null

  return (
    <>
      <Sheet open={cart.isDrawerOpen} onOpenChange={(o) => (o ? cart.openDrawer() : cart.closeDrawer())}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("Order cart")}</SheetTitle>
            <SheetDescription>
              {t("{{count}} item", { count: cart.items.length })} · {formatPrice(cart.totalAmount, cart.totalCurrency)}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {cart.items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <ShoppingCartIcon className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("Your cart is empty")}</p>
                <p className="text-xs text-muted-foreground">{t("Add products from the catalog to get started.")}</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.items.map((item) => {
                  const isOne = item.requestedQty === 1
                  const subtotal = item.unitPrice * item.requestedQty
                  return (
                    <div key={item.productId} className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatPrice(item.unitPrice, item.currency)}
                          </div>
                        </div>
                        <div className="text-base font-semibold tabular-nums">
                          {formatPrice(subtotal, item.currency)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            isOne
                              ? cart.removeItem(item.productId)
                              : cart.updateQty(item.productId, item.requestedQty - 1)
                          }
                          aria-label={isOne ? t("Remove item") : t("Decrease quantity")}
                        >
                          {isOne ? <TrashIcon className="size-4" /> : <MinusIcon className="size-4" />}
                        </Button>
                        <div className={cn("min-w-10 text-center text-base font-semibold tabular-nums")} aria-label={t("Qty")}>
                          {item.requestedQty}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => cart.updateQty(item.productId, item.requestedQty + 1)}
                          aria-label={t("Increase quantity")}
                        >
                          <PlusIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <SheetFooter className="border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("Total")}</span>
              <span className="text-base font-semibold tabular-nums">
                {formatPrice(cart.totalAmount, cart.totalCurrency)}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={cart.clearItems}
              disabled={cart.items.length === 0}
            >
              {t("Clear order")}
            </Button>
            <Button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              disabled={cart.items.length === 0}
            >
              {t("Checkout")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <SaleFormDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  )
}
```

Notes:
- `SaleFormDialog` is mounted from inside the drawer so opening Checkout works regardless of which page the user is on. It still renders as a centered modal (its own root portal), independent of the sheet. The cart hook backs both — they share state.
- Reference for the per-row layout is lines 108–185 of [sale-form-dialog.tsx](frontend/src/components/sale-form-dialog.tsx) (`CartRow`). We don't import that subcomponent because it carries the city-stock query, which we deliberately don't show in the drawer (stock check stays at submit time per `overview.md`).
- The drawer renders nothing for `user` roles other than `admin` / `salesPerson` — keeps the SidebarProvider clean for plain users.

> CLAUDE.md: "**Use shadcn `Dialog`** for forms or content that appears in an overlay." (`Sheet` is the correct shadcn primitive for side panels.)
> CLAUDE.md: "Tailwind CSS only. No CSS modules or styled-components." — every class above is Tailwind via `className`. **No inline `style` prop.**
> CLAUDE.md: "Use `cn()` from `@/lib/utils` for conditional classes."
> CLAUDE.md: "Use lucide-react. Import specific icons by name." — already done.
> CLAUDE.md: "Default exports outside `pages/` and Vite entry points" — banned. Component is named export, correct.

### `frontend/src/components/sale-cart-button.tsx`

```tsx
import { useTranslation } from "react-i18next"
import { useAuth } from "@/hooks/use-auth"
import { useSaleCart } from "@/hooks/use-sale-cart"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCartIcon } from "lucide-react"

export function SaleCartButton(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { totalQty, openDrawer } = useSaleCart()

  if (user?.role !== "admin" && user?.role !== "salesPerson") return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openDrawer}
      aria-label={t("Open order cart")}
      className="relative"
    >
      <ShoppingCartIcon className="size-4" />
      {totalQty > 0 && (
        <Badge
          variant="default"
          className="absolute -right-1 -top-1 size-4 min-w-4 justify-center rounded-full p-0 text-[10px]"
        >
          {totalQty > 99 ? "99+" : totalQty}
        </Badge>
      )}
    </Button>
  )
}
```

> CLAUDE.md: "Use the built-in variants and sizes." — `Button variant="ghost" size="icon"`, `Badge variant="default"`. `className` overrides only for badge positioning, which the variant system doesn't cover.

### Wire into `DashboardLayout`

**File:** [frontend/src/components/dashboard-layout.tsx](frontend/src/components/dashboard-layout.tsx)

```tsx
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Outlet } from "react-router"
import { SaleCartProvider } from "@/hooks/use-sale-cart"
import { SaleCartDrawer } from "@/components/sale-cart-drawer"

export function DashboardLayout() {
  return (
    <SaleCartProvider>
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4">
            <Outlet />
          </div>
        </SidebarInset>
        <SaleCartDrawer />
      </SidebarProvider>
    </SaleCartProvider>
  )
}
```

`SaleCartProvider` wraps the whole subtree (sidebar, header, page content, drawer) so every consumer sees the same context.

### Wire into `SiteHeader`

**File:** [frontend/src/components/site-header.tsx](frontend/src/components/site-header.tsx)

Add `<SaleCartButton />` to the right-side action group:

```tsx
import { SaleCartButton } from "@/components/sale-cart-button"

// ...inside the JSX, in the right-side flex container:
<div className="ml-auto flex items-center gap-1">
  <SaleCartButton />
  <LanguageToggle />
  <ThemeToggle />
</div>
```

(The component returns `null` for non-sales roles, so no extra conditional needed at the call site.)

## Step 4 — Catalog page

**File:** `frontend/src/pages/catalog.tsx` (default export — `pages/` is the only place default exports are allowed outside Vite entry points)

> CLAUDE.md (ESLint frontend bans): "default exports outside `pages/` and Vite entry points."

Layout follows the same shape as [frontend/src/pages/products.tsx](frontend/src/pages/products.tsx) — heading, filters row, bordered `Table` with skeleton/error/empty states, pagination — plus an "Add to cart" action column.

Required sections (in order):

1. **Heading + description** — `t("Catalog")`, `t("Browse products and add them to your order.")`.
2. **Filter row** — wrapped in a `<div className="flex flex-wrap items-end gap-3">`. Inputs:
   - **Search** (`Input` `type="text"`, `placeholder={t("Search products")}`). Debounce with a 300 ms `setTimeout` + `clearTimeout` in a `useEffect` hook so each keystroke does not refetch. Store debounced value in a separate state (`searchInput` raw, `search` debounced).
   - **Kind** (`Select`): "All", "Groceries", "Liquor". Empty-string sentinel `""` means no filter.
   - **Liquor type** (`Select`): "All", "Rum", "Whisky", "Vodka", "Gin", "Tequila", "Other". **Disabled** unless `kind === "liquor"` (also clear `liquorType` to `""` when `kind` changes away from `liquor`).
   - **Min price** + **Max price** (`Input` `type="number" min={0} step="0.01"`). Empty string means no filter — `Number("")` is `0`, so check explicitly: `minPrice: minPriceStr === "" ? undefined : Number(minPriceStr)`.
   - **Reset filters** `Button variant="ghost"` that clears all five.
3. **Table** — columns: Name, Kind (Badge), Liquor type, Presentation, Price, **Action**. The action cell is an "Add to cart" button: `<Button variant="default" size="sm" onClick={() => cart.addItem(p)}>{t("Add to cart")}</Button>`. **Do NOT open the drawer on add.** The header badge bumps the count, which is the entire feedback loop — user opens the drawer themselves. Optional: a brief `toast.success(t("Added to cart"))` after each click for additional feedback (cheap to add; flag if undesired).
4. **Pagination** — reuse [frontend/src/components/data-pagination.tsx](frontend/src/components/data-pagination.tsx) exactly like [frontend/src/pages/products.tsx](frontend/src/pages/products.tsx) does (line 277–286).

Query setup:

```ts
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ["products", "catalog", { page, pageSize, kind, liquorType, minPrice, maxPrice, search }],
  queryFn: () =>
    fetchProductsApi({
      page,
      limit: pageSize,
      kind: kind || undefined,
      liquorType: kind === "liquor" ? liquorType || undefined : undefined,
      minPrice,
      maxPrice,
      search: search || undefined,
    }),
  placeholderData: keepPreviousData,
})
```

> CLAUDE.md: "Query keys are arrays — resource name first, then params … No prefixes, no camelCase variations." — `["products", "catalog", { ...filters }]` shares the `"products"` root so a successful sale's `invalidateQueries({ queryKey: ["products"] })` (none today, but for symmetry) would invalidate the catalog too. The `"catalog"` discriminator keeps it from clashing with the admin page's `["products", { page, pageSize }]` cache.
> CLAUDE.md: "Use `placeholderData: keepPreviousData` for paginated queries to avoid flash on page change."
> CLAUDE.md (loading/error/empty): "Loading: Show the shadcn `Skeleton` component … Error: Display an inline error message with a retry button (`refetch` from `useQuery`) … Empty: When data loads successfully but the list is empty, show a descriptive empty state."

Empty state should include the `ShoppingCartIcon` + `t("No products match your filters.")` + a Reset button.

Reset filters function: clears `search`, `kind`, `liquorType`, `minPrice`, `maxPrice`, and resets `page` to `1`.

When any filter changes, also reset `page` to `1` (mirror the existing `handlePageSizeChange` behavior on line 116 of `pages/products.tsx`).

## Step 5 — Refactor `SaleFormDialog` to consume the cart hook

**File:** [frontend/src/components/sale-form-dialog.tsx](frontend/src/components/sale-form-dialog.tsx)

The dialog keeps its existing structure — including the inline "Add product to order" `Card` (lines 434–512) as a quick-add fallback, per the locked decision in `overview.md`. The refactor swaps **state ownership** to the cart hook while leaving the UI intact.

Delete:
- `CartItem` interface (line 57) — moved to the hook (import from `@/hooks/use-sale-cart`).
- `PersistedCart` interface (line 66) — moved.
- `STORAGE_KEY_PREFIX`, `loadCart`, `saveCart`, `clearCart` (lines 73–102) — moved.
- All `useState` for `items`, `cityId`, `clientId`, `notes` (lines 200–203). Keep `draftProduct` and `draftQty` (lines 205–206) — they're for the inline picker, which stays.
- The two `useEffect` blocks that load/save the cart (lines 208–228) — the hook owns persistence now.
- `handleAddToOrder`, `handleQtyChange`, `handleRemove`, `handleClearOrder` (lines 282–325) — replaced by `cart.addItem`, `cart.updateQty`, `cart.removeItem`, `cart.clearItems`.
- `changeCityId`, `changeClientId` (lines 268–280) — replaced by `cart.setCityId`, `cart.setClientId` (the hook applies the same "clear items if value changed" rule).

Keep:
- The dialog frame (`<Dialog>` / `<DialogContent>` / `<DialogHeader>` / `<DialogTitle>` / `<DialogFooter>`).
- City `Select` (admin only) + Client `Select` + Notes `Input` — wire `value` to `cart.cityId` / `cart.clientId` / `cart.notes`, `onValueChange` / `onChange` to the cart setters.
- The whole `CartRow` component (lines 108–185) — the per-row stock query is still wanted at checkout.
- The `productOptions` query (lines 230–234) — feeds the inline Combobox.
- The `draftStockQuery` (lines 253–266) — feeds the inline picker's available-stock label.
- The inline "Add product to order" `Card` (lines 434–512). Update its `onClick={handleAddToOrder}` to:
  ```tsx
  onClick={() => {
    if (!draftProduct || draftQty < 1) return
    cart.addItem(
      // The hook's addItem accepts a Product. ProductOption lacks `kind` discrimination
      // — synthesize one or have the hook accept ProductOption too. See note below.
      { id: draftProduct.id, name: draftProduct.name, kind: draftProduct.kind, price: draftProduct.price } as Product,
      draftQty,
    )
    setDraftProduct(null)
    setDraftQty(1)
  }}
  ```
  **Important:** `as Product` is a type assertion, which CLAUDE.md bans. Two clean options:
  1. **Preferred:** widen `cart.addItem` to accept either a full `Product` or a `ProductOption` (`addItem: (product: Product | ProductOption, qty?: number) => void`). The discriminated `kind` field is in both types, and the hook only reads `id, name, kind, price`. No assertion needed.
  2. Add a new `cart.addOption(option, qty)` method on the hook for `ProductOption` callers.

  Pick option 1 — single entry point, less surface area.

- The `Order` section listing `items` via `CartRow` (now reading from `cart.items`).
- Totals row (now reading from `cart.totalQty` / `cart.totalAmount` / `cart.totalCurrency`).
- `mutation` (the React Query `useMutation` calling `createSaleApi`) and the `onSuccess` block — replace the manual state-clearing + `clearCart(userId)` with `cart.resetAll()`.

Replace local state with hook reads:

```tsx
const cart = useSaleCart()
// references: cart.items, cart.cityId, cart.clientId, cart.notes, cart.setCityId, etc.
```

`onSuccess`:

```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["sales"] })
  queryClient.invalidateQueries({ queryKey: ["inventory"] })
  queryClient.invalidateQueries({ queryKey: ["stock"] })
  toast.success(t("Sale created"))
  cart.resetAll()
  onOpenChange(false)
},
```

After the refactor, the dialog still exposes its quick-add picker AND reads/writes the same shared cart as the catalog page and the drawer. All three surfaces stay in sync because they share one source of truth.

> CLAUDE.md: "Avoid backwards-compatibility hacks like renaming unused `_vars`, re-exporting types, adding `// removed` comments for removed code, etc. If you are certain that something is unused, you can delete it completely."
> CLAUDE.md: "No commented-out code. Delete it; git has history."
> CLAUDE.md (TypeScript): "No type assertions (`as`). Use type guards, generics, or proper narrowing instead." — this is why option 1 above (widening the hook signature) beats `as Product`.

## Step 6 — Routing & sidebar

### `frontend/src/router.tsx`

Add the import at the top:

```tsx
import CatalogPage from "@/pages/catalog"
```

Add the route inside the `/dashboard` children array (after `clients`, before `settings`):

```tsx
{
  path: "catalog",
  element: (
    <RoleRoute allowed={["admin", "salesPerson"]}>
      <CatalogPage />
    </RoleRoute>
  ),
},
```

### `frontend/src/components/app-sidebar.tsx`

Add an entry to **both** `adminNavMain` and `salesPersonNavMain` (after `Sales`):

```tsx
import { ShoppingCartIcon } from "lucide-react"

// ...inside both nav arrays:
{ title: t("Catalog"), url: "/dashboard/catalog", icon: <ShoppingCartIcon /> },
```

> CLAUDE.md (ESLint frontend bans): icon libs other than `lucide-react` are banned.

## Step 7 — i18n strings

Add to **both** `frontend/src/locales/en.json` and `frontend/src/locales/es.json`:

| Key (English) | Spanish |
|---|---|
| `Catalog` | `Catálogo` |
| `Browse products and add them to your order.` | `Explora productos y agrégalos a tu pedido.` |
| `Search products` | `Buscar productos` |
| `Filters` | `Filtros` |
| `All` | `Todos` |
| `Min price` | `Precio mínimo` |
| `Max price` | `Precio máximo` |
| `Reset filters` | `Limpiar filtros` |
| `Add to cart` | `Agregar al carrito` |
| `Open order cart` | `Abrir carrito de pedido` |
| `Order cart` | `Carrito de pedido` |
| `Your cart is empty` | `Tu carrito está vacío` |
| `Add products from the catalog to get started.` | `Agrega productos desde el catálogo para comenzar.` |
| `No products match your filters.` | `Ningún producto coincide con los filtros.` |
| `Total` | `Total` |
| `Checkout` | `Finalizar pedido` |

Existing keys we reuse (already present — verify in the JSONs first, add only the missing ones): `{{count}} item`, `Qty`, `Decrease quantity`, `Increase quantity`, `Remove item`, `Clear order`, `Sale created`, `Try again`, `Cancel`, `New sale`, `Create sale`, `Creating...`, `Name`, `Kind`, `Liquor type`, `Presentation`, `Price`, `Actions`, `Liquor`, `Groceries`, `Rum`, `Whisky`, `Vodka`, `Gin`, `Tequila`, `Other`.

> CLAUDE.md: "When adding new UI strings: Add the key to both `en.json` and `es.json`, then use `t('key')` in the component."
> CLAUDE.md: "Translation keys are the exact English string — flat structure, no nested/semantic keys."

## Step 8 — Tests

### What to add

- **`frontend/src/lib/products.spec.ts`** — extended per Step 1 above (filter param assertions).
- **`frontend/src/hooks/use-sale-cart.spec.tsx`** — full coverage per Step 2 above.
- **`frontend/src/components/sale-cart-drawer.spec.tsx`** — render with a wrapper that mounts both `AuthProvider` (so `useAuth` resolves) and `SaleCartProvider`. Assertions:
  1. Renders `null` for a `user` role (not admin / not salesPerson).
  2. Renders empty state when `items.length === 0`.
  3. Renders rows for each item with the formatted subtotal.
  4. Increment / decrement / remove buttons fire the matching cart mutators.
  5. "Clear order" calls `cart.clearItems`.
  6. "Checkout" opens `<SaleFormDialog>` (assert it appears in the DOM).
- **`frontend/src/components/sale-cart-button.spec.tsx`** — render gating + badge logic:
  1. Renders `null` for `user` role.
  2. Renders without badge when `totalQty === 0`.
  3. Renders badge with the count when `totalQty > 0`; shows `99+` when `totalQty > 99`.
  4. Clicking calls `openDrawer`.
- **No test for `pages/catalog.tsx`** beyond what's covered above. The page wires queries and the cart hook to the table — both sides are tested in isolation. > CLAUDE.md: "Pages that only wire data to UI — if a page just fetches with `useQuery` and renders a table, the logic lives in the hook/service layer. Test those instead."

### What changes

- The existing `SaleFormDialog` tests (if any) will need updates; check `frontend/src/components/sale-form-dialog.spec.tsx` for the current state (if it does not exist, no work). The refactor removes private state but the user-facing behavior (city/client picking, totals, submit) stays the same.
- The existing `frontend/src/lib/sales.spec.ts` is untouched — `createSaleApi`'s shape did not change.

> CLAUDE.md: "When building a new feature, always write unit tests for the API functions in `src/lib/<feature>.ts`, any custom hooks with logic, and form/component behavior that involves conditional rendering or user interaction."

### Mocking patterns to follow

- For `useAuth` in the hook tests: import the real `AuthProvider` from `@/hooks/use-auth` and seed it via the same flow it uses in app — usually that means stubbing the auth API calls. Simpler: write a tiny test-only `<MockAuthProvider value={{ user: { id: 'u1', role: 'salesPerson', ... } }}>` if `AuthContext` is exported. If it isn't, mock the `@/hooks/use-auth` module with `vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: ... }) }))`.
- For localStorage: `vi.spyOn(Storage.prototype, 'setItem')` / `'getItem'` / `'removeItem'`. Reset between tests with `vi.restoreAllMocks()` or `Storage.prototype.setItem.mockClear()`.
- For `react-router` `Link` rendering inside the drawer / sidebar: wrap with `<MemoryRouter>` from `react-router`.

> CLAUDE.md: "Mocking modules: For feature API files (`auth.ts`, `users.ts`, `profile.ts`), mock the `@/lib/api` module with `vi.mock("@/lib/api")` and use `vi.mocked(authFetch)` / `vi.mocked(publicFetch)` to control behavior."

## Step 9 — Verify

```bash
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend build
```

Then **start the dev server and exercise the feature in a browser**:

> CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete. Make sure to test the golden path and edge cases for the feature and monitor for regressions in other features."

Manual checklist (golden path + edge cases):

1. Log in as `salesPerson`. Sidebar shows "Catalog". Click it.
2. Filter by Kind = "Liquor", confirm only liquor rows show. Pick Liquor type = "Rum". Add a price range. Type in search. Reset filters.
3. Add three different products to the cart. Header badge shows "3". Open the drawer. Verify rows, increment/decrement, remove behavior.
4. Click Checkout. Sale dialog opens with cart pre-loaded. Pick a client. Submit. Toast shows "Sale created", drawer empties, header badge clears.
5. Refresh the page mid-cart. Items should persist (localStorage hydration).
6. Switch to a different sales person account. Cart should be empty (different `userId` key).
7. Log in as `admin`. Catalog appears in sidebar. Browse + add. Open Checkout — the city `Select` is visible. Pick a city. If you change the city after adding items, items clear (matches today's behavior).
8. Log in as a plain `user`. Sidebar does NOT show Catalog. `SaleCartButton` and `SaleCartDrawer` render `null`.
9. **Regression check:** the admin Products page (`/dashboard/products`) still loads and lists products. Sort change to alphabetical is the only visible difference — confirm acceptable.
10. Pre-commit (`.husky/pre-commit`) runs `pnpm lint && pnpm typecheck && pnpm test` on commit. Make sure the commit goes through.

If type checking fails because `React.JSX.Element` isn't recognized, switch the return type annotation to `JSX.Element` or omit the return type (the lint rule `explicit-module-boundary-types` is **scoped to `lib/**` and `hooks/**`** per CLAUDE.md — components and pages are exempt; hook helpers should keep the annotation).

> CLAUDE.md (ESLint scoping): "missing return types on exported functions … scoped to backend code, frontend `lib/**`, and `hooks/**`. Components and pages are exempt."
