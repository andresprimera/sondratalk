import { test, expect } from "@playwright/test"

const EXPECTED_TOAST =
  "This email isn't on the early access list. Sondra is invite-only right now."

test("signup with a non-allowlisted email is blocked with 403 and an error toast", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (err) => pageErrors.push(err.message))

  // Capture the signup API response status.
  const signupResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/auth/signup") && res.request().method() === "POST",
  )

  await page.goto("/signup")

  const email = `blocked-user-${Date.now()}@example-not-allowed.com`

  await page.getByLabel("Full Name").fill("Test Applicant")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill("Test@1234")
  await page.getByLabel("Confirm Password").fill("Test@1234")

  await page.getByRole("button", { name: "Apply" }).click()

  // Wait for the backend response and assert 403.
  const signupResponse = await signupResponsePromise
  expect(signupResponse.status()).toBe(403)

  // The error toast must appear with the exact message.
  const toast = page.getByText(EXPECTED_TOAST)
  await expect(toast).toBeVisible({ timeout: 5000 })

  // Let the toast finish its fade/slide-in animation so it renders fully in
  // the screenshot, then confirm it is still on screen.
  await page.waitForTimeout(600)
  await expect(toast).toBeVisible()

  // Capture proof while the toast is still on screen.
  await page.screenshot({
    path: "/Users/andresprimera/apps/personal/sondratalk/screenshots/early-access-signup-blocked.png",
    fullPage: false,
  })

  // The user must remain on /signup, not proceed to /onboarding.
  expect(new URL(page.url()).pathname).toBe("/signup")

  expect(pageErrors, `pageerrors: ${pageErrors.join("; ")}`).toHaveLength(0)
})
