/**
 * Screenshot helper for task-30: users admin table with new columns.
 * Uses API mocking to work without a live backend.
 * Captures two screenshots:
 *   screenshots/task-30-users-admin.png   – table with all columns visible (sorted by name asc)
 *   screenshots/task-30-users-sorted.png  – table after clicking Name header (sort toggled to desc)
 *
 * Usage: node e2e/shot-task30-users-admin.mjs
 * Requires: frontend Vite dev server at http://localhost:5174
 */
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "screenshots")
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5174"

mkdirSync(OUT_DIR, { recursive: true })

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_ADMIN_USER = {
  id: "64a000000000000000000001",
  name: "Andrés Primera",
  email: "andresprimera@gmail.com",
  role: "admin",
}

const MOCK_USERS = [
  {
    id: "64a000000000000000000001",
    name: "Andrés Primera",
    email: "andresprimera@gmail.com",
    role: "admin",
    conversationCount: 12,
    hostExpPoints: 340,
    createdAt: "2024-01-15T10:30:00.000Z",
  },
  {
    id: "64a000000000000000000002",
    name: "Carolina Ruiz",
    email: "carolina@example.com",
    role: "founding_member",
    conversationCount: 8,
    hostExpPoints: 210,
    createdAt: "2024-02-20T14:00:00.000Z",
  },
  {
    id: "64a000000000000000000003",
    name: "Diego Morales",
    email: "diego@example.com",
    role: "user",
    conversationCount: 3,
    hostExpPoints: 75,
    createdAt: "2024-03-05T09:00:00.000Z",
  },
  {
    id: "64a000000000000000000004",
    name: "Elena Vásquez",
    email: "elena@example.com",
    role: "user",
    conversationCount: 6,
    hostExpPoints: 120,
    createdAt: "2024-04-10T16:45:00.000Z",
  },
  {
    id: "64a000000000000000000005",
    name: "Fernando López",
    email: "fernando@example.com",
    role: "user",
    conversationCount: 1,
    hostExpPoints: 20,
    createdAt: "2024-05-01T11:00:00.000Z",
  },
]

const MOCK_USERS_RESPONSE = {
  data: MOCK_USERS,
  meta: {
    page: 1,
    limit: 10,
    total: 5,
    totalPages: 1,
  },
}

// Reversed for sorted (desc) screenshot
const MOCK_USERS_SORTED_DESC = {
  data: [...MOCK_USERS].reverse(),
  meta: { page: 1, limit: 10, total: 5, totalPages: 1 },
}

// ─── Token values (fake but structurally valid JWT-looking strings) ──────────
const FAKE_ACCESS = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NGEwMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.fake"
const FAKE_REFRESH = "fake-refresh-token"

// ─── Launch browser ──────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

// Intercept all API calls and return mock data
console.log("Registering /api/auth/me route")
page.route("**/api/auth/me", (route) => {
  process.stdout.write("INTERCEPTED /api/auth/me\n")
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(MOCK_ADMIN_USER),
  })
}).then(() => console.log("Route for /me registered"))

await page.route("**/api/auth/refresh", (route) => {
  const body = {
    accessToken: FAKE_ACCESS,
    refreshToken: FAKE_REFRESH,
    user: {
      ...MOCK_ADMIN_USER,
      timezone: "America/New_York",
      city: "",
      languages: [],
      locale: "en",
      createdAt: "2024-01-15T10:30:00.000Z",
      hostExpPoints: 340,
    },
  }
  console.log("Intercepting refresh request — returning mock user")
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
})

await page.route("**/api/auth/login", (route) => {
  const body = {
    accessToken: FAKE_ACCESS,
    refreshToken: FAKE_REFRESH,
    user: {
      ...MOCK_ADMIN_USER,
      timezone: "America/New_York",
      city: "",
      languages: [],
      locale: "en",
      createdAt: "2024-01-15T10:30:00.000Z",
      hostExpPoints: 340,
    },
  }
  console.log("Intercepting login request — returning mock user")
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
})

// Users API — sorted desc when sortDir=desc
let sortedState = "asc"
await page.route("**/api/users**", (route) => {
  const url = new URL(route.request().url())
  const dir = url.searchParams.get("sortDir") ?? "asc"
  const resp = dir === "desc" ? MOCK_USERS_SORTED_DESC : MOCK_USERS_RESPONSE
  sortedState = dir
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(resp),
  })
})

// Intercept any other /api/* calls
await page.route("**/api/**", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
})

const errors = []
const allRequests = []
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text())
})
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`))
page.on("request", (req) => {
  if (req.url().includes("/api/")) allRequests.push(`REQ: ${req.method()} ${req.url()}`)
})
page.on("response", (res) => {
  if (res.url().includes("/api/")) allRequests.push(`RES: ${res.status()} ${res.url()}`)
})

// ─── Log in via the mocked login form ─────────────────────────────────────────
// This follows the same path as a real user: fills in login form, submits,
// and the mocked /api/auth/login response sets up the auth context.
console.log("Navigating to /login…")
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
await page.waitForTimeout(500)

// Fill login form
const emailInput = page.getByLabel("Email")
const passwordInput = page.getByLabel("Password")
if (await emailInput.isVisible()) {
  await emailInput.fill("andresprimera@gmail.com")
  await passwordInput.fill("Test@123")
  await page.getByRole("button", { name: /^Login$/i }).click()
  // Wait for redirect away from /login
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {
    console.log("Warning: did not redirect to /dashboard after login")
  })
  console.log("After login, URL:", page.url())
} else {
  // Already logged in, go directly
  console.log("Login form not found — injecting tokens directly")
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem("accessToken", access)
      localStorage.setItem("refreshToken", refresh)
    },
    { access: FAKE_ACCESS, refresh: FAKE_REFRESH }
  )
}

// Now navigate to the users page
console.log("Navigating to /dashboard/users…")
await page.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" })
await page.waitForTimeout(3000)

console.log("Page URL after navigate:", page.url())

// If we got bounced to /login, try waiting for auth and navigating again
if (page.url().includes("/login")) {
  console.log("Bounced to /login — waiting for auth context to settle and retrying…")
  await page.waitForTimeout(3000)
  await page.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" })
  await page.waitForTimeout(3000)
  console.log("Page URL after retry:", page.url())
}

// Debug: check localStorage and auth state
const localStorageState = await page.evaluate(() => ({
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: localStorage.getItem("refreshToken"),
}))
console.log("LocalStorage tokens present:", {
  access: !!localStorageState.accessToken,
  refresh: !!localStorageState.refreshToken,
})

// Check headers
const headers = await page.locator("thead th").allTextContents()
console.log("Table headers:", headers)

// Wait for real data (not skeleton)
try {
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll("tbody tr")
    return Array.from(rows).some(
      (row) => !row.querySelector('[class*="skeleton"]') && (row.textContent?.trim() ?? "").length > 0
    )
  }, { timeout: 8000 })
  console.log("Data rows loaded")
} catch {
  console.log("Warning: no data rows visible within 8s")
}

// ─── Screenshot 1: table with all columns ────────────────────────────────────
const shot1 = join(OUT_DIR, "task-30-users-admin.png")
await page.screenshot({ path: shot1, fullPage: false })
console.log(`Saved: ${shot1}`)

// ─── Click Name header to toggle sort to desc ────────────────────────────────
// Default is name asc, so first click switches to desc
const nameHeader = page.getByRole("columnheader", { name: /name/i })
if (await nameHeader.isVisible()) {
  // Click once to toggle to desc (since default is asc)
  await nameHeader.click()
  await page.waitForTimeout(800)
  console.log("Clicked Name header → sort toggled to desc")
} else {
  console.log("Name header not found")
}

// ─── Screenshot 2: sorted state ───────────────────────────────────────────────
const shot2 = join(OUT_DIR, "task-30-users-sorted.png")
await page.screenshot({ path: shot2, fullPage: false })
console.log(`Saved: ${shot2}`)

console.log("\nAPI requests made:")
allRequests.forEach((r) => console.log(" ", r))

if (errors.length) {
  console.log("\nConsole/page errors:")
  errors.forEach((e) => console.log(" -", e))
}

await browser.close()
console.log("Done.")
