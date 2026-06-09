import { test, expect } from "@playwright/test"
import path from "path"

const SCREENSHOT_DIR = path.resolve(__dirname, "../../screenshots")

// Build a minimal fake JWT that the client-side getTokenExpiry() can decode.
// The payload just needs an `exp` field far in the future.
// Format: base64url(header).base64url(payload).signature
function makeFakeJwt(expiresInMs = 3_600_000): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ sub: "fake-user-id", exp: Math.floor((Date.now() + expiresInMs) / 1000) }),
  ).toString("base64url")
  return `${header}.${payload}.fakesignature`
}

const FAKE_ACCESS_TOKEN = makeFakeJwt(3_600_000)  // 1 hour
const FAKE_REFRESH_TOKEN = makeFakeJwt(86_400_000) // 24 hours

const FAKE_USER = {
  id: "507f1f77bcf86cd799439001",
  email: "raul.harlev@gmail.com",
  name: "Raul",
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

const MOCK_CIRCLES = [
  {
    id: "507f1f77bcf86cd799439013",
    labels: { en: "Work stress", es: "Estrés laboral" },
    description: "Talking about work-related stress",
    createdAt: new Date().toISOString(),
  },
]

// One candidate who is NOT available now — produces the "Next available" + slots section
const now = Date.now()
const MOCK_MATCH_RESPONSE = {
  candidates: [
    {
      id: "507f1f77bcf86cd799439011",
      firstName: "Jordan",
      availableNow: false,
      sharedCircles: [
        {
          id: "507f1f77bcf86cd799439012",
          labels: { en: "Work stress", es: "Estrés laboral" },
        },
      ],
      slots: [
        {
          startsAt: new Date(now + 3600 * 1000).toISOString(),
          requesterDate: new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(now + 3600 * 1000)),
          requesterTime: new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(now + 3600 * 1000)),
        },
        {
          startsAt: new Date(now + 7200 * 1000).toISOString(),
          requesterDate: new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(now + 7200 * 1000)),
          requesterTime: new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(now + 7200 * 1000)),
        },
      ],
    },
  ],
}

test("matches stage: Next available card shows slot-propose helper note", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (err) => pageErrors.push(err.message))
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 500) {
      pageErrors.push(`API ${res.status()} on ${res.url()}`)
    }
  })

  // --- Mock all API calls before any navigation ---

  // Auth refresh — called on mount by AuthProvider to restore session
  await page.route("**/api/auth/refresh", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_AUTH_RESPONSE),
    })
  })

  // Logout — called when auth clears; just 204
  await page.route("**/api/auth/logout", (route) => {
    route.fulfill({ status: 204 })
  })

  // My circles
  await page.route("**/api/users/me/circles", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_CIRCLES),
    })
  })

  // My availability (dashboard widgets may query this)
  await page.route("**/api/users/me/availability", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ available: false }),
    })
  })

  // Talk-match mutation
  await page.route("**/api/matching/talk", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_MATCH_RESPONSE),
    })
  })

  // Seed tokens in localStorage before the app initializes so AuthProvider
  // picks them up and calls /api/auth/refresh on mount.
  await page.goto("/")
  await page.evaluate(
    ([accessToken, refreshToken]) => {
      localStorage.setItem("accessToken", accessToken)
      localStorage.setItem("refreshToken", refreshToken)
    },
    [FAKE_ACCESS_TOKEN, FAKE_REFRESH_TOKEN],
  )

  // Navigate to find-conversation — ProtectedRoute will wait for auth to resolve
  await page.goto("/dashboard/find-conversation")

  // Wait for the request-stage UI (circles section) to appear —
  // this means AuthProvider resolved and ProtectedRoute let us through.
  await expect(
    page.getByText(/showing up as/i).first(),
  ).toBeVisible({ timeout: 10000 })

  // Wait for circles skeleton to clear
  await page
    .waitForFunction(
      () => !document.querySelector('[data-slot="skeleton"]'),
      { timeout: 5000 },
    )
    .catch(() => {})

  // Select "Not really — just talk" intent
  const justTalkBtn = page.getByRole("button", { name: /not really.*just talk/i })
  await expect(justTalkBtn).toBeVisible({ timeout: 5000 })
  await justTalkBtn.click()

  // Click Find someone — triggers the match mutation
  const findBtn = page.getByRole("button", { name: /find someone/i })
  await expect(findBtn).toBeVisible({ timeout: 3000 })
  await findBtn.click()

  // Wait for the matches stage — "Next available" label should appear
  await expect(
    page.getByText(/next available/i).first(),
  ).toBeVisible({ timeout: 10000 })

  // Core assertion: the helper note is visible
  const helperNote = page.getByText(
    "Not seeing a good time? You can propose another time after scheduling.",
  )
  await expect(helperNote).toBeVisible({ timeout: 5000 })

  // Give the page a moment to fully settle
  await page.waitForTimeout(300)

  // Save the screenshot
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "slot-propose-note.png"),
    fullPage: true,
  })

  // No unhandled page errors
  expect(pageErrors, `Page errors: ${pageErrors.join(", ")}`).toHaveLength(0)
})
