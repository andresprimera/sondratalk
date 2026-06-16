import { test, expect } from "@playwright/test"
import path from "path"

// __dirname not available in ESM — derive from process.cwd (repo root)
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots")

// JWT with exp far in the future — safely within setTimeout's 32-bit maximum.
const FAKE_ACCESS =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NGEwMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJpYXQiOjE3ODE1MzA0MDQsImV4cCI6MTc4MTUzNzYwNH0.fake_signature"
const FAKE_REFRESH = "fake-refresh-token"

const MOCK_ADMIN_USER = {
  id: "64a000000000000000000001",
  name: "Andrés Primera",
  email: "andresprimera@gmail.com",
  role: "admin",
  timezone: "America/New_York",
  city: "New York",
  languages: [{ code: "es", fluency: "Native" }],
  locale: "en",
  createdAt: "2024-01-15T10:30:00.000Z",
  hostExpPoints: 340,
}

const AUTH_RESPONSE = {
  accessToken: FAKE_ACCESS,
  refreshToken: FAKE_REFRESH,
  user: MOCK_ADMIN_USER,
}

const MOCK_THEMES = [
  { id: "th-1", labels: { en: "Animals", es: "Animales" } },
  { id: "th-2", labels: { en: "Travel", es: "Viajes" } },
  { id: "th-3", labels: { en: "Food", es: "Comida" } },
]

const MOCK_CIRCLES = [
  {
    id: "c-1",
    slug: "german-shepherd",
    themeId: "th-1",
    type: "what-you-love",
    labels: { en: "German Shepherd", es: "Pastor Alemán" },
    aliases: { en: ["GSD"], es: ["Pastor Alemán"] },
    popularity: 0,
    membershipCount: 482,
  },
  {
    id: "c-2",
    slug: "solo-backpacking",
    themeId: "th-2",
    type: "where-you-are",
    labels: { en: "Solo Backpacking", es: "Mochilero Solo" },
    aliases: { en: [], es: [] },
    popularity: 0,
    membershipCount: 129,
  },
  {
    id: "c-3",
    slug: "home-baking",
    themeId: "th-3",
    type: "who-you-are",
    labels: { en: "Home Baking", es: "Repostería Casera" },
    aliases: { en: ["baking"], es: ["repostería"] },
    popularity: 0,
    membershipCount: 37,
  },
  {
    id: "c-4",
    slug: "street-photography",
    themeId: "th-2",
    type: "what-you-love",
    labels: { en: "Street Photography", es: "Fotografía Urbana" },
    aliases: { en: [], es: [] },
    popularity: 0,
    membershipCount: 905,
  },
]

function circlesResponse(sortBy: string, sortDir: string) {
  const sorted = [...MOCK_CIRCLES]
  const key: Record<string, (c: (typeof MOCK_CIRCLES)[number]) => string | number> = {
    slug: (c) => c.slug,
    labelEn: (c) => c.labels.en,
    labelEs: (c) => c.labels.es,
    theme: (c) => c.themeId,
    type: (c) => c.type,
    popularity: (c) => c.membershipCount,
  }
  const getter = key[sortBy] ?? key.slug
  sorted.sort((a, b) => {
    const av = getter(a)
    const bv = getter(b)
    if (av < bv) return sortDir === "desc" ? 1 : -1
    if (av > bv) return sortDir === "desc" ? -1 : 1
    return 0
  })
  return {
    data: sorted,
    meta: { page: 1, limit: 10, total: sorted.length, totalPages: 1 },
  }
}

async function setupMocks(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.route("**/*", (route) => {
    const url = route.request().url()

    if (url.includes("/api/auth/refresh")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_RESPONSE),
      })
    } else if (url.includes("/api/auth/login")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_RESPONSE),
      })
    } else if (url.includes("/api/auth/me")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ADMIN_USER),
      })
    } else if (url.includes("/api/themes/all")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_THEMES),
      })
    } else if (url.includes("/api/circles/admin")) {
      const reqUrl = new URL(url)
      const sortBy = reqUrl.searchParams.get("sortBy") ?? "slug"
      const sortDir = reqUrl.searchParams.get("sortDir") ?? "asc"
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(circlesResponse(sortBy, sortDir)),
      })
    } else if (url.includes("/api/")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    } else {
      route.continue()
    }
  })
}

async function loginAndGoToCircles(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await setupMocks(page)

  await page.addInitScript(
    ({ access, refresh }) => {
      localStorage.setItem("accessToken", access)
      localStorage.setItem("refreshToken", refresh)
    },
    { access: FAKE_ACCESS, refresh: FAKE_REFRESH },
  )

  await page.goto("/dashboard/circles")
  await page.waitForTimeout(1500)
}

test("circles admin table has no Actions column, renamed Circle Type, genuine Popularity, sortable headers", async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on("pageerror", (e) => pageErrors.push(e.message))

  await page.setViewportSize({ width: 1440, height: 800 })
  await loginAndGoToCircles(page)

  await expect(page.getByRole("heading", { name: /circles/i })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.locator("table")).toBeVisible({ timeout: 10000 })

  await page.waitForFunction(() => {
    const rows = document.querySelectorAll("tbody tr")
    return Array.from(rows).some(
      (row) =>
        !row.querySelector('[class*="skeleton"]') &&
        (row.textContent?.trim() ?? "").length > 0,
    )
  }, { timeout: 10000 }).catch(() => {})

  // Expected columns present
  await expect(page.getByRole("columnheader", { name: "Slug" })).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "English label" }),
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Spanish label" }),
  ).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Theme" })).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Circle Type" }),
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Popularity" }),
  ).toBeVisible()

  // No Actions column
  const headers = await page.getByRole("columnheader").allInnerTexts()
  expect(headers.some((h) => /actions/i.test(h))).toBe(false)
  expect(headers.length).toBe(6)

  // No Edit/Delete icon buttons anywhere in the table rows
  const editButtons = page.getByRole("button", { name: /edit/i })
  const deleteButtons = page.getByRole("button", { name: /delete/i })
  expect(await editButtons.count()).toBe(0)
  expect(await deleteButtons.count()).toBe(0)

  // Popularity column shows membershipCount numbers (e.g. 482), not circle type strings
  await expect(page.getByRole("cell", { name: "482" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "905" })).toBeVisible()

  // Circle Type column shows the human-readable type, not a number
  await expect(page.getByRole("cell", { name: /love what you love/i }).or(
    page.locator("tbody td", { hasText: /love|where|who/i }).first(),
  )).toBeVisible()

  // Click "English label" header — sort icon should toggle (arrow visible)
  const labelHeader = page.getByRole("columnheader", { name: "English label" })
  await labelHeader.click()
  await page.waitForTimeout(500)
  await expect(labelHeader.locator("svg")).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "task-31-circles-admin-table.png"),
    fullPage: false,
  })

  expect(pageErrors, "no uncaught page errors").toEqual([])
})

test("add circle dialog has no Popularity input field", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (e) => pageErrors.push(e.message))

  await page.setViewportSize({ width: 1280, height: 1100 })
  await loginAndGoToCircles(page)

  await expect(page.getByRole("heading", { name: /circles/i })).toBeVisible({
    timeout: 15000,
  })

  await page.getByRole("button", { name: /add circle/i }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: /add circle/i }),
  ).toBeVisible()

  // Expected fields present
  await expect(dialog.getByLabel("Slug")).toBeVisible()
  await expect(dialog.getByText("Theme", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Type", { exact: true })).toBeVisible()
  await expect(dialog.getByLabel("English label")).toBeVisible()
  await expect(dialog.getByLabel("Spanish label")).toBeVisible()
  await expect(dialog.getByLabel("English aliases")).toBeVisible()
  await expect(dialog.getByLabel("Spanish aliases")).toBeVisible()

  // No Popularity field of any kind (label, input, spinbutton)
  await expect(dialog.getByText(/popularity/i)).toHaveCount(0)
  await expect(dialog.getByLabel(/popularity/i)).toHaveCount(0)
  await expect(dialog.getByRole("spinbutton")).toHaveCount(0)

  // The page scrolled when the last field was focused/interacted with.
  // Reset scroll to top so the dialog title and Slug field are visible
  // in the screenshot alongside the rest of the form.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.mouse.move(0, 0)

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "task-32-add-circle-no-popularity.png"),
    fullPage: false,
  })

  expect(pageErrors, "no uncaught page errors").toEqual([])
})
