/**
 * Screenshot script proving the new admin Users page search box:
 *   - before: full mocked user list, no filter
 *   - after: typed into the search box, filtered result
 *
 * Mocks /api/auth/login and /api/users directly — no real backend/Atlas
 * needed. Drives the real interactive login form (rather than pre-seeding
 * localStorage tokens) since the mount-time session-restore path currently
 * has an unrelated bug under React StrictMode; logging in through the UI
 * goes through AuthProvider.login(), which sets user state directly and
 * isn't affected by that path.
 */
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "screenshots")
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5174"

mkdirSync(OUT_DIR, { recursive: true })

const FAKE_ADMIN = {
  _id: "000000000000000000000001",
  name: "Admin Tester",
  email: "admin@example.com",
  role: "admin",
  timezone: "America/New_York",
  languages: [{ code: "en", name: "English", fluency: "Native" }],
  locale: "en",
  applicationText: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function b64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}
const FAKE_ACCESS = [
  b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  b64url(
    JSON.stringify({
      sub: FAKE_ADMIN._id,
      exp: Math.floor(new Date("2099-01-01").getTime() / 1000),
    }),
  ),
  "fakesignature",
].join(".")
const FAKE_REFRESH = "fake-refresh-token"

const AUTH_RESPONSE = {
  accessToken: FAKE_ACCESS,
  refreshToken: FAKE_REFRESH,
  user: FAKE_ADMIN,
}

const ALL_USERS = [
  { id: "u1", name: "Ana García", email: "ana@example.com", role: "user", conversationCount: 4, hostExpPoints: 0, createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "u2", name: "Carlos Ruiz", email: "carlos@example.com", role: "user", conversationCount: 1, hostExpPoints: 0, createdAt: "2026-04-01T00:00:00.000Z" },
  { id: "u3", name: "Jane Smith", email: "jane@example.com", role: "founding_member", conversationCount: 12, hostExpPoints: 5, createdAt: "2026-01-15T00:00:00.000Z" },
  { id: "u4", name: "Marta López", email: "marta@example.com", role: "user", conversationCount: 2, hostExpPoints: 0, createdAt: "2026-05-10T00:00:00.000Z" },
]

function fulfill(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

let lastUsersUrl = ""

async function setupMocks(page) {
  await page.route("**/api/**", (route) => fulfill(route, {}))
  await page.route("**/api/auth/login", (route) =>
    fulfill(route, AUTH_RESPONSE),
  )
  // The dashboard index route (briefly visited between login and the client-
  // side nav to Users) needs these to not crash on load.
  await page.route("**/api/users/me/circles", (route) => fulfill(route, []))
  await page.route("**/api/meetings/stats", (route) =>
    fulfill(route, { totalConversations: 0, activeSince: null }),
  )
  await page.route("**/api/users?*", (route) => {
    const url = new URL(route.request().url())
    lastUsersUrl = route.request().url()
    const q = (url.searchParams.get("q") ?? "").toLowerCase()
    const filtered = q
      ? ALL_USERS.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
        )
      : ALL_USERS
    return fulfill(route, {
      data: filtered,
      meta: { page: 1, limit: 10, total: filtered.length, totalPages: 1 },
    })
  })
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
})
const page = await context.newPage()

page.on("pageerror", (err) => console.error("UNCAUGHT:", err.message))

await setupMocks(page)

await page.goto(`${BASE}/login`)
await page.getByLabel("Email").fill(FAKE_ADMIN.email)
await page.getByLabel("Password", { exact: true }).fill("irrelevant-mocked")
await page.getByRole("button", { name: "Login", exact: true }).click()
await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
await page.waitForTimeout(500)

// Client-side navigation (not page.goto, which hard-reloads and re-triggers
// the mount-time session-restore path) to keep AuthProvider's in-memory user
// state from the login above.
await page.getByRole("link", { name: "Users" }).click()
await page.waitForURL(/\/dashboard\/users/, { timeout: 15_000 })
await page.waitForTimeout(1000)

const rowsBefore = await page.locator("table tbody tr").count()
console.log("rows before filtering:", rowsBefore)

await page.screenshot({
  path: join(OUT_DIR, "users-search-before.png"),
  fullPage: false,
})
console.log("saved users-search-before.png")

const searchBox = page.getByPlaceholder("Search users...")
await searchBox.fill("jane")
// Debounce is 250ms; give it margin plus the mocked request round-trip.
await page.waitForTimeout(1000)

console.log("request URL after typing:", lastUsersUrl)
const rowsAfter = await page.locator("table tbody tr").count()
console.log("rows after filtering to 'jane':", rowsAfter)

await page.screenshot({
  path: join(OUT_DIR, "users-search-after.png"),
  fullPage: false,
})
console.log("saved users-search-after.png")

await browser.close()
console.log("Done.")
