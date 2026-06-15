import { test, expect } from "@playwright/test"
import path from "path"
import fs from "fs"

const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots")

// JWT with exp = 2 hours from now — safely within setTimeout's 32-bit maximum (~24.8 days)
const FAKE_ACCESS =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NGEwMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJpYXQiOjE3ODE1MzA0MDQsImV4cCI6MTc4MTUzNzYwNH0.fake_signature"
const FAKE_REFRESH = "fake-refresh-token"

// Admin user = self (id 001)
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

// Three distinct roles: admin (self), founding_member, and user
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
]

const USERS_RESPONSE = {
  data: MOCK_USERS,
  meta: { page: 1, limit: 10, total: 3, totalPages: 1 },
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
    } else if (url.includes("/api/users")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(USERS_RESPONSE),
      })
    } else if (url.includes("/api/")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    } else {
      route.continue()
    }
  })
}

async function navigateToUsersPage(
  page: Parameters<Parameters<typeof test>[1]>[0]
) {
  await setupMocks(page)

  await page.addInitScript(
    ({ access, refresh }) => {
      localStorage.setItem("accessToken", access)
      localStorage.setItem("refreshToken", refresh)
    },
    { access: FAKE_ACCESS, refresh: FAKE_REFRESH }
  )

  await page.goto("/dashboard/users")
  await page.waitForTimeout(2000)
}

test("role label: founding_member user shows 'Founding Member' in Select trigger", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`))

  await navigateToUsersPage(page)

  // Wait for table with real data
  await expect(page.locator("table")).toBeVisible({ timeout: 10000 })
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr")
      return Array.from(rows).some(
        (row) =>
          !row.querySelector('[class*="skeleton"]') &&
          (row.textContent?.trim() ?? "").length > 0
      )
    },
    { timeout: 10000 }
  )

  // Carolina Ruiz has role "founding_member" — the Select trigger should display "Founding Member"
  // Find the row containing Carolina Ruiz and look for the Select trigger text
  const carolinaRow = page.locator("tr", { hasText: "Carolina Ruiz" })
  await expect(carolinaRow).toBeVisible()

  // The SelectTrigger in that row should show "Founding Member", not "founding_member"
  const selectTrigger = carolinaRow.locator('[role="combobox"]')
  await expect(selectTrigger).toBeVisible()
  await expect(selectTrigger).toContainText("Founding Member")
  // Ensure the raw snake_case value is NOT showing
  await expect(selectTrigger).not.toContainText("founding_member")
})

test("role label: regular user shows 'User' in Select trigger", async ({
  page,
}) => {
  await navigateToUsersPage(page)

  await expect(page.locator("table")).toBeVisible({ timeout: 10000 })
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr")
      return Array.from(rows).some(
        (row) =>
          !row.querySelector('[class*="skeleton"]') &&
          (row.textContent?.trim() ?? "").length > 0
      )
    },
    { timeout: 10000 }
  )

  // Diego Morales has role "user"
  const diegoRow = page.locator("tr", { hasText: "Diego Morales" })
  await expect(diegoRow).toBeVisible()

  const selectTrigger = diegoRow.locator('[role="combobox"]')
  await expect(selectTrigger).toBeVisible()
  await expect(selectTrigger).toContainText("User")
  await expect(selectTrigger).not.toContainText('"user"')
})

test("role label: admin self-user shows 'Admin' badge (not Select)", async ({
  page,
}) => {
  await navigateToUsersPage(page)

  await expect(page.locator("table")).toBeVisible({ timeout: 10000 })
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr")
      return Array.from(rows).some(
        (row) =>
          !row.querySelector('[class*="skeleton"]') &&
          (row.textContent?.trim() ?? "").length > 0
      )
    },
    { timeout: 10000 }
  )

  // Andrés Primera is the logged-in admin (self). They should get a Badge, not a Select.
  const andresRow = page.locator("tr", { hasText: "Andrés Primera" })
  await expect(andresRow).toBeVisible()

  // No combobox in the self row
  await expect(andresRow.locator('[role="combobox"]')).toHaveCount(0)

  // Badge showing "Admin"
  const badge = andresRow.locator('[class*="badge"], [data-slot="badge"]').first()
  await expect(badge).toBeVisible()
  await expect(badge).toContainText("Admin")
})

test("screenshot: users page role column shows human-readable labels", async ({
  page,
}) => {
  await navigateToUsersPage(page)

  await expect(page.locator("table")).toBeVisible({ timeout: 10000 })
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr")
      return Array.from(rows).some(
        (row) =>
          !row.querySelector('[class*="skeleton"]') &&
          (row.textContent?.trim() ?? "").length > 0
      )
    },
    { timeout: 10000 }
  )

  // Ensure screenshots dir exists
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "task-30-users-role-labels.png"),
    fullPage: false,
  })
})
