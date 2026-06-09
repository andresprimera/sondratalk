import { test, expect } from "@playwright/test"
import path from "path"

const SCREENSHOT_DIR = path.resolve(__dirname, "../../screenshots")

// Fake JWT: header.payload.sig — browser only needs to decode payload for exp
const FAKE_EXP = Math.floor(Date.now() / 1000) + 3600
const FAKE_PAYLOAD = Buffer.from(
  JSON.stringify({ sub: "test-user-id", email: "test@sondra.com", exp: FAKE_EXP }),
).toString("base64url")
const FAKE_ACCESS_TOKEN = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${FAKE_PAYLOAD}.fakesig`
const FAKE_REFRESH_TOKEN = "fake-refresh-token-abc"

const FAKE_USER = {
  id: "test-user-id",
  email: "test@sondra.com",
  name: "Test User",
  role: "admin",
  timezone: "America/New_York",
  languages: [],
  locale: "en",
  createdAt: new Date().toISOString(),
}

const FAKE_AUTH_RESPONSE = {
  accessToken: FAKE_ACCESS_TOKEN,
  refreshToken: FAKE_REFRESH_TOKEN,
  user: FAKE_USER,
}

async function setupAuthMocks(page: import("@playwright/test").Page) {
  // Register the catch-all FIRST (Playwright matches last-registered first,
  // so this will be lowest priority)
  await page.route("**/api/**", (route) => {
    // Fallback: return empty success for any unhandled API call
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  })

  // Register more specific routes AFTER — they will match first
  await page.route("**/api/users/me/availability", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ available: false }),
    })
  })

  await page.route("**/api/users/me/circles", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "circle-1", labels: { en: "Work", es: "Trabajo" }, description: "" },
        { id: "circle-2", labels: { en: "Family", es: "Familia" }, description: "" },
      ]),
    })
  })

  await page.route("**/api/auth/refresh", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_AUTH_RESPONSE),
    })
  })

  // Inject tokens into localStorage before app scripts execute
  await page.addInitScript(
    (tokens: { accessToken: string; refreshToken: string }) => {
      localStorage.setItem("accessToken", tokens.accessToken)
      localStorage.setItem("refreshToken", tokens.refreshToken)
    },
    { accessToken: FAKE_ACCESS_TOKEN, refreshToken: FAKE_REFRESH_TOKEN },
  )
}

test("Screenshot 1: intent order with beta hints", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (err) => pageErrors.push(err.message))

  await setupAuthMocks(page)

  await page.goto("/dashboard/find-conversation")

  // Wait for the intent section — auth guard passes, page renders
  await page.waitForSelector("text=Is there something specific on your mind?", {
    timeout: 15000,
  })

  // Verify intent option order: find the three intent buttons and check their order
  // (circle toggle buttons also use aria-pressed, so we filter by known text)
  const notReallyBtn = page.getByRole("button", { name: /Not really — just talk/i })
  const specificBtn = page.getByRole("button", { name: /Yes, I have something specific/i })
  const heardBtn = page.getByRole("button", { name: /I just need to be heard/i })

  // All three must exist
  await expect(notReallyBtn).toBeVisible()
  await expect(specificBtn).toBeVisible()
  await expect(heardBtn).toBeVisible()

  // "Not really — just talk" must appear above "Yes, I have something specific" in DOM order
  const notReallyY = (await notReallyBtn.boundingBox())?.y ?? 0
  const specificY = (await specificBtn.boundingBox())?.y ?? 0
  const heardY = (await heardBtn.boundingBox())?.y ?? 0
  expect(notReallyY).toBeLessThan(specificY)
  expect(specificY).toBeLessThan(heardY)

  // Beta hint text should appear on the page (shown for "specific" and "heard")
  const betaHints = page.getByText("Not available in Beta yet.")
  await expect(betaHints.first()).toBeVisible()

  // All three options must be present
  await expect(page.getByRole("button", { name: /Not really — just talk/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /Yes, I have something specific/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /I just need to be heard/i })).toBeVisible()

  await page.waitForTimeout(300)

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "intent-order-beta.png"),
    fullPage: true,
  })

  expect(pageErrors).toHaveLength(0)
})

test("Screenshot 2: beta toast when selecting specific and clicking Find someone", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (err) => pageErrors.push(err.message))

  await setupAuthMocks(page)

  await page.goto("/dashboard/find-conversation")

  await page.waitForSelector("text=Is there something specific on your mind?", {
    timeout: 15000,
  })

  // Select "Yes, I have something specific"
  const specificBtn = page.getByRole("button", { name: /Yes, I have something specific/i })
  await specificBtn.click()
  await expect(specificBtn).toHaveAttribute("aria-pressed", "true")

  // Click "Find someone"
  await page.getByRole("button", { name: /Find someone/i }).click()

  // The toast "Not available in Beta yet." should appear
  await page.waitForSelector("[data-sonner-toast]", { timeout: 8000 })
  const toastEl = page.locator("[data-sonner-toast]").first()
  await expect(toastEl).toBeVisible()
  await expect(toastEl).toContainText("Not available in Beta yet.")

  await page.waitForTimeout(400)

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "intent-beta-toast.png"),
    fullPage: false,
  })

  expect(pageErrors).toHaveLength(0)
})
