import { test, expect } from "@playwright/test"
import path from "path"

// __dirname not available in ESM — derive from process.cwd (repo root)
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots")

// JWT with exp = 2 hours from now — safely within setTimeout's 32-bit maximum (~24.8 days)
// scheduleRefresh will set a timer for ~1h59m, not fire during the test run.
const FAKE_ACCESS = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NGEwMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJpYXQiOjE3ODE1MzA0MDQsImV4cCI6MTc4MTUzNzYwNH0.fake_signature"
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

const MOCK_USERS = [
  {
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
    conversationCount: 12,
  },
  {
    id: "64a000000000000000000002",
    name: "Carolina Ruiz",
    email: "carolina@example.com",
    role: "founding_member",
    timezone: "America/Bogota",
    city: "Bogotá",
    languages: [{ code: "es", fluency: "Native" }],
    locale: "es",
    createdAt: "2024-02-20T14:00:00.000Z",
    hostExpPoints: 210,
    conversationCount: 8,
  },
  {
    id: "64a000000000000000000003",
    name: "Diego Morales",
    email: "diego@example.com",
    role: "user",
    timezone: "America/Mexico_City",
    city: "Mexico City",
    languages: [{ code: "es", fluency: "Native" }],
    locale: "es",
    createdAt: "2024-03-05T09:00:00.000Z",
    hostExpPoints: 75,
    conversationCount: 3,
  },
  {
    id: "64a000000000000000000004",
    name: "Elena Vásquez",
    email: "elena@example.com",
    role: "user",
    timezone: "America/Lima",
    city: "Lima",
    languages: [{ code: "es", fluency: "Native" }],
    locale: "es",
    createdAt: "2024-04-10T16:45:00.000Z",
    hostExpPoints: 120,
    conversationCount: 6,
  },
  {
    id: "64a000000000000000000005",
    name: "Fernando López",
    email: "fernando@example.com",
    role: "user",
    timezone: "America/Buenos_Aires",
    city: "Buenos Aires",
    languages: [{ code: "es", fluency: "Native" }],
    locale: "es",
    createdAt: "2024-05-01T11:00:00.000Z",
    hostExpPoints: 20,
    conversationCount: 1,
  },
]

const USERS_RESPONSE_ASC = {
  data: MOCK_USERS,
  meta: { page: 1, limit: 10, total: 5, totalPages: 1 },
}

const USERS_RESPONSE_DESC = {
  data: [...MOCK_USERS].reverse(),
  meta: { page: 1, limit: 10, total: 5, totalPages: 1 },
}

async function setupMocks(page: Parameters<Parameters<typeof test>[1]>[0]) {
  // Intercept ALL requests and log them, fulfilling /api/* with mocks
  await page.route("**/*", (route) => {
    const url = route.request().url()

    if (url.includes("/api/auth/refresh")) {
      console.log("MOCK: /api/auth/refresh")
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(AUTH_RESPONSE) })
    } else if (url.includes("/api/auth/login")) {
      console.log("MOCK: /api/auth/login")
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(AUTH_RESPONSE) })
    } else if (url.includes("/api/auth/me")) {
      console.log("MOCK: /api/auth/me")
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ADMIN_USER) })
    } else if (url.includes("/api/users")) {
      const reqUrl = new URL(url)
      const sortDir = reqUrl.searchParams.get("sortDir") ?? "asc"
      const body = sortDir === "desc" ? USERS_RESPONSE_DESC : USERS_RESPONSE_ASC
      console.log(`MOCK: /api/users (sortDir=${sortDir})`)
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
    } else if (url.includes("/api/")) {
      console.log(`MOCK catch-all: ${url}`)
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    } else {
      // Let static assets through
      route.continue()
    }
  })
}

async function loginAndGoToUsers(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await setupMocks(page)

  // Inject auth tokens via addInitScript — this runs before any page script
  // so the AuthProvider sees tokens immediately on mount
  await page.addInitScript(
    ({ access, refresh }) => {
      localStorage.setItem("accessToken", access)
      localStorage.setItem("refreshToken", refresh)
    },
    { access: FAKE_ACCESS, refresh: FAKE_REFRESH }
  )

  // Navigate directly to the users page — addInitScript ensures tokens are pre-set
  await page.goto("/dashboard/users")

  // The auth context will call refreshTokens() on mount (tokens exist),
  // mock returns admin user, ProtectedRoute passes, AdminRoute passes.
  // Wait for the table or some dashboard content
  await page.waitForTimeout(2000)

  console.log("Current URL:", page.url())
}

test("screenshot: users table with new columns (checkbox, Conversations, Host Exp, Active since)", async ({ page }) => {
  await loginAndGoToUsers(page)

  // Wait for table to appear
  await expect(page.locator("table")).toBeVisible({ timeout: 10000 })

  // Wait for real data rows (not skeleton)
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll("tbody tr")
    return Array.from(rows).some(
      (row) => !row.querySelector('[class*="skeleton"]') && (row.textContent?.trim() ?? "").length > 0
    )
  }, { timeout: 10000 }).catch(() => {})

  // Verify column headers
  await expect(page.getByRole("columnheader", { name: "Conversations" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Host Exp" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Active since" })).toBeVisible()

  // Screenshot 1
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "task-30-users-admin.png"),
    fullPage: false,
  })
})

test("screenshot: users table after clicking Name to sort (sort arrow visible)", async ({ page }) => {
  await loginAndGoToUsers(page)

  await expect(page.locator("table")).toBeVisible({ timeout: 10000 })

  await page.waitForFunction(() => {
    const rows = document.querySelectorAll("tbody tr")
    return Array.from(rows).some(
      (row) => !row.querySelector('[class*="skeleton"]') && (row.textContent?.trim() ?? "").length > 0
    )
  }, { timeout: 10000 }).catch(() => {})

  // Default sort is name asc. Click Name header to toggle to desc.
  const nameHeader = page.getByRole("columnheader", { name: /name/i })
  await expect(nameHeader).toBeVisible()
  await nameHeader.click()
  await page.waitForTimeout(600)

  // Screenshot 2
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "task-30-users-sorted.png"),
    fullPage: false,
  })
})
