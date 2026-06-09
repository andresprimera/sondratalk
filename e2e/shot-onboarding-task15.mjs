/**
 * Screenshot script for Task 15 onboarding screens:
 *   1. Application step (step 4 of 4)
 *   2. Welcome step with 48h copy (step 5)
 *
 * All API calls are intercepted so the backend does not need to be running.
 * NOTE: In Playwright, the LAST registered route handler takes priority.
 * Register catch-alls first, specific routes last.
 */
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "screenshots")
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5174"

mkdirSync(OUT_DIR, { recursive: true })

// ── Fake JWT ───────────────────────────────────────────────────────────────
const FAKE_USER = {
  _id: "000000000000000000000001",
  name: "Sondra Tester",
  email: "tester@example.com",
  role: "user",
  timezone: "America/New_York",
  languages: [{ code: "en", name: "English", fluency: "Native" }],
  locale: "en",
  applicationText: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function b64url(str) {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
const FAKE_ACCESS = [
  b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  b64url(JSON.stringify({ sub: FAKE_USER._id, exp: Math.floor(new Date("2099-01-01").getTime() / 1000) })),
  "fakesignature",
].join(".")
const FAKE_REFRESH = "fake-refresh-token"

const AUTH_RESPONSE = {
  accessToken: FAKE_ACCESS,
  refreshToken: FAKE_REFRESH,
  user: FAKE_USER,
}

// Fake circles so the grid renders and "Enter Sondra →" becomes clickable
const FAKE_CIRCLES = {
  data: [
    { id: "c1", labels: { en: "Startups", es: "Startups" }, themes: [] },
    { id: "c2", labels: { en: "Climate", es: "Clima" }, themes: [] },
    { id: "c3", labels: { en: "Design", es: "Diseño" }, themes: [] },
    { id: "c4", labels: { en: "Music", es: "Música" }, themes: [] },
    { id: "c5", labels: { en: "Teaching", es: "Enseñanza" }, themes: [] },
    { id: "c6", labels: { en: "Philosophy", es: "Filosofía" }, themes: [] },
  ],
  meta: { page: 1, limit: 24, total: 6, totalPages: 1 },
}

function fulfill(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

async function setupMocks(page) {
  // CATCH-ALL first (lowest priority — last registered wins in Playwright)
  await page.route("**/api/**", (route) => {
    console.warn("Catch-all API:", route.request().method(), route.request().url())
    return fulfill(route, {})
  })

  // SPECIFIC routes (higher priority, registered last)

  // Auth refresh — called by AuthProvider on mount
  await page.route("**/api/auth/refresh", (route) =>
    fulfill(route, AUTH_RESPONSE),
  )

  // My circles — empty on GET so no redirect to /dashboard
  await page.route("**/api/users/me/circles", (route) => {
    if (route.request().method() === "GET") return fulfill(route, [])
    // PATCH — submission after selecting circles (step 3 → step 4)
    return fulfill(route, [{ id: "c1", labels: { en: "Startups", es: "Startups" }, themes: [] }])
  })

  // Available circles list (step 3 grid)
  await page.route("**/api/circles**", (route) =>
    fulfill(route, FAKE_CIRCLES),
  )

  // Timezone PATCH (step 1 → 2)
  await page.route("**/api/users/me/timezone", (route) =>
    fulfill(route, { ...FAKE_USER, timezone: "America/New_York" }),
  )

  // Languages PATCH (step 2 → 3)
  await page.route("**/api/users/me/languages", (route) =>
    fulfill(route, FAKE_USER),
  )

  // Application PATCH (step 4 → 5)
  await page.route("**/api/users/me/application", (route) =>
    fulfill(route, { ...FAKE_USER, applicationText: "I want meaningful conversations." }),
  )
}

async function seedAndGo(page) {
  // Set tokens BEFORE page load so AuthProvider finds them immediately
  await page.addInitScript(
    ([accessToken, refreshToken]) => {
      localStorage.setItem("accessToken", accessToken)
      localStorage.setItem("refreshToken", refreshToken)
    },
    [FAKE_ACCESS, FAKE_REFRESH],
  )
  await page.goto(`${BASE}/onboarding`)
  await page.waitForTimeout(1500)
}

async function getPageText(page) {
  return page.evaluate(() => document.body.innerText.slice(0, 500))
}

async function walkToStep4(page) {
  // ── Step 1 ──
  const step1Btn = page.getByRole("button", { name: /looks right →/i })
  if (await step1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await step1Btn.click()
    await page.waitForTimeout(1000)
    console.log("Step 1 passed")
  } else {
    console.warn("Step 1 button not found. Page text:", await getPageText(page))
  }

  // ── Step 2 ──
  const step2Btn = page.getByRole("button", { name: /continue →/i })
  if (await step2Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await step2Btn.click()
    await page.waitForTimeout(1000)
    console.log("Step 2 passed")
  } else {
    console.warn("Step 2 button not found. Page text:", await getPageText(page))
  }

  // ── Step 3 ── select one circle, then submit
  // Wait for circles grid to load
  const firstCircleChip = page.getByRole("button", { name: "Startups" })
  if (await firstCircleChip.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstCircleChip.click()
    await page.waitForTimeout(400)
    console.log("Selected a circle")
  } else {
    console.warn("Circle chip not found. Page text:", await getPageText(page))
  }

  const enterBtn = page.getByRole("button", { name: /enter sondra →/i })
  if (await enterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await enterBtn.click()
    await page.waitForTimeout(1000)
    console.log("Step 3 submitted")
  } else {
    console.warn("Enter Sondra button not found. Page text:", await getPageText(page))
  }
}

const browser = await chromium.launch({ headless: true })

// ══════════════════════════════════════════════════════════════════════════
// SCREENSHOT 1: Application step (step 4 of 4)
// ══════════════════════════════════════════════════════════════════════════
{
  console.log("\n--- Screenshot 1: Application step ---")
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("PAGE ERROR:", msg.text())
  })
  page.on("pageerror", (err) => console.error("UNCAUGHT:", err.message))

  await setupMocks(page)
  await seedAndGo(page)
  await walkToStep4(page)

  const heading = page.getByText("One last thing before you join")
  const visible = await heading.isVisible({ timeout: 5000 }).catch(() => false)
  console.log("Application step heading visible:", visible)
  if (!visible) {
    console.warn("Page text:", await getPageText(page))
  }

  const out1 = join(OUT_DIR, "onboarding-application-step.png")
  await page.screenshot({ path: out1, fullPage: true })
  console.log("Saved:", out1)

  await context.close()
}

// ══════════════════════════════════════════════════════════════════════════
// SCREENSHOT 2: Welcome step (step 5) — post-submit 48h copy
// ══════════════════════════════════════════════════════════════════════════
{
  console.log("\n--- Screenshot 2: Welcome step ---")
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("PAGE ERROR:", msg.text())
  })
  page.on("pageerror", (err) => console.error("UNCAUGHT:", err.message))

  await setupMocks(page)
  await seedAndGo(page)
  await walkToStep4(page)

  // Step 4: fill textarea, then submit
  const textarea = page.getByRole("textbox")
  if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await textarea.fill("I want to have meaningful conversations with people from all walks of life.")
    await page.waitForTimeout(400)

    const submitBtn = page.getByRole("button", { name: /submit application/i })
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(1500)
      console.log("Submitted application")
    } else {
      console.warn("Submit button not found")
    }
  } else {
    console.warn("Textarea not found at step 4. Page text:", await getPageText(page))
  }

  const welcomeEl = page.getByText("Your application is in.")
  const welcomeVisible = await welcomeEl.isVisible({ timeout: 5000 }).catch(() => false)
  console.log("'Your application is in.' visible:", welcomeVisible)
  if (!welcomeVisible) {
    console.warn("Page text:", await getPageText(page))
  }

  const out2 = join(OUT_DIR, "onboarding-welcome-48h.png")
  await page.screenshot({ path: out2, fullPage: true })
  console.log("Saved:", out2)

  await context.close()
}

await browser.close()
console.log("\nDone.")
