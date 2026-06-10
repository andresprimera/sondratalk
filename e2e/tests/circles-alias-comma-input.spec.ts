import { test, expect } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

const SCREENSHOT_PATH =
  "/Users/andresprimera/apps/personal/sondratalk/screenshots/circles-alias-comma-input.png"

const ALIAS_TEXT = "GSD, Alsatian, German Shepherd"

test("English aliases input preserves commas while typing", async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const apiFailures: string[] = []

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (err) => pageErrors.push(err.message))
  page.on("response", (res) => {
    const url = res.url()
    if (url.includes("/api/") && res.status() >= 400) {
      apiFailures.push(`${res.status()} ${res.request().method()} ${url}`)
    }
  })

  // --- Log in via the real UI path ---
  await page.goto("/login")
  await page.getByLabel("Email").fill("andresprimera@gmail.com")
  await page.getByLabel("Password").fill("Test@123")
  await page.getByRole("button", { name: "Login", exact: true }).click()

  // Land in the dashboard
  await page.waitForURL(/\/dashboard/)

  // --- Navigate to circles ---
  await page.goto("/dashboard/circles")
  await expect(
    page.getByRole("button", { name: "Add Circle" }),
  ).toBeVisible()

  // --- Open the Add Circle dialog ---
  await page.getByRole("button", { name: "Add Circle" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Add Circle")).toBeVisible()

  // --- Locate the English aliases input (id="add-circle-aliases-en") ---
  const aliasInput = page.locator("#add-circle-aliases-en")
  await expect(aliasInput).toBeVisible()
  await expect(aliasInput).toHaveValue("")

  // --- Type the comma-separated string character-by-character ---
  await aliasInput.click()
  await aliasInput.pressSequentially(ALIAS_TEXT, { delay: 30 })

  // --- Confirm every comma survived ---
  await expect(aliasInput).toHaveValue(ALIAS_TEXT)
  const finalValue = await aliasInput.inputValue()

  // --- Screenshot proof of the filled dialog ---
  mkdirSync(dirname(SCREENSHOT_PATH), { recursive: true })
  await dialog.screenshot({ path: SCREENSHOT_PATH })

  // Surface diagnostics in the test output
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        finalAliasValue: finalValue,
        commasPreserved: finalValue === ALIAS_TEXT,
        commaCount: (finalValue.match(/,/g) ?? []).length,
        consoleErrors,
        pageErrors,
        apiFailures,
      },
      null,
      2,
    ),
  )

  expect(finalValue).toBe(ALIAS_TEXT)
  expect(pageErrors).toEqual([])
})
