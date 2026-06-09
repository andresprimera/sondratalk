import { test, expect } from "@playwright/test"
import path from "path"

const SCREENSHOT_DIR = path.resolve(__dirname, "../../screenshots")
const EMAIL = "test@sondra.com"
const PASSWORD = "Test1234!"

async function loginOrSignup(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Login" }).click()

  // Race: land on dashboard OR see an error
  const result = await Promise.race([
    page.waitForURL("**/dashboard", { timeout: 8000 }).then(() => "dashboard"),
    page
      .waitForSelector("[data-sonner-toast], .text-destructive", {
        timeout: 8000,
      })
      .then(() => "error"),
  ]).catch(() => "timeout")

  if (result === "error" || result === "timeout") {
    // Try signup instead
    await page.goto("/signup")
    await page.getByLabel("Full Name").fill("Test User")
    await page.getByLabel("Email").fill(EMAIL)
    // Fill only first Password field (not confirm)
    const passwordFields = page.getByLabel("Password")
    await passwordFields.first().fill(PASSWORD)
    await page.getByLabel("Confirm Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Apply" }).click()
    // After signup, app redirects to /onboarding first — navigate directly to dashboard
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15000 })
    if (page.url().includes("/onboarding")) {
      await page.goto("/dashboard")
    }
    await page.waitForURL("**/dashboard", { timeout: 10000 })
    return
  }

  // If login failed silently and we didn't redirect, go to dashboard explicitly
  if (!page.url().includes("/dashboard")) {
    await page.goto("/dashboard")
    await page.waitForURL("**/dashboard", { timeout: 10000 })
  }
}

test("Screenshot 1: Talk Now offline toast", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("pageerror", (err) => consoleErrors.push(err.message))
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 400) {
      consoleErrors.push(`API ${res.status()} on ${res.url()}`)
    }
  })

  await loginOrSignup(page)
  await page.waitForURL("**/dashboard", { timeout: 15000 })

  // Wait for the availability section to load (skeleton disappears)
  await page.waitForFunction(
    () => !document.querySelector('[data-slot="skeleton"]'),
    { timeout: 10000 },
  )

  // Check current online/offline state and go offline if needed
  const goOfflineBtn = page.getByRole("button", { name: /go offline/i })
  const goOnlineBtn = page.getByRole("button", { name: /go online/i })

  // If user is currently online, click go offline
  const isOnline = await goOfflineBtn.isVisible().catch(() => false)
  if (isOnline) {
    await goOfflineBtn.click()
    // Wait for status to update
    await page.waitForSelector("text=You're offline for Talk Now", {
      timeout: 8000,
    })
  }

  // Confirm we're offline
  await expect(page.getByText("You're offline for Talk Now")).toBeVisible({
    timeout: 8000,
  })

  // Click Talk Now button — should trigger the offline toast
  await page.getByRole("button", { name: /talk now/i }).click()

  // Wait for the toast to appear
  await page.waitForSelector("[data-sonner-toast]", { timeout: 8000 })

  // Give the toast a moment to fully render
  await page.waitForTimeout(400)

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "talk-now-offline-toast.png"),
    fullPage: false,
  })

  // Verify toast content
  const toastEl = page.locator("[data-sonner-toast]").first()
  await expect(toastEl).toBeVisible()

  // The "Go online" action button should be in the toast
  await expect(
    page.getByRole("button", { name: /go online/i }).last(),
  ).toBeVisible()
})

test("Screenshot 2: find-conversation no simulate button", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("pageerror", (err) => consoleErrors.push(err.message))

  await loginOrSignup(page)
  await page.waitForURL("**/dashboard", { timeout: 15000 })

  // Go online first so the page is accessible
  await page.waitForFunction(
    () => !document.querySelector('[data-slot="skeleton"]'),
    { timeout: 10000 },
  )

  const goOnlineBtn = page.getByRole("button", { name: /go online/i })
  const isOffline = await goOnlineBtn.isVisible().catch(() => false)
  if (isOffline) {
    await goOnlineBtn.click()
    await page.waitForSelector("text=You're available for Talk Now", {
      timeout: 8000,
    })
  }

  // Navigate to find-conversation
  await page.goto("/dashboard/find-conversation")
  await page.waitForLoadState("networkidle")

  // Verify there is no "Simulate a match (preview)" button
  const simulateBtn = page.getByRole("button", {
    name: /simulate a match/i,
  })
  await expect(simulateBtn).not.toBeVisible()

  // Also check by text search
  const simulateText = page.getByText(/simulate a match/i)
  await expect(simulateText).not.toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "find-conversation-no-simulate.png"),
    fullPage: true,
  })
})
