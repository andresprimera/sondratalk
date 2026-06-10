import { test, expect } from "@playwright/test"

const SCREENSHOT_DIR =
  "/Users/andresprimera/apps/personal/sondratalk/screenshots"

// Heuristic: a UUID / hex object id looks like a long run of hex chars
// (often with dashes). A human-readable theme name does not.
const UUID_LIKE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
const LONG_HEX = /^[0-9a-f]{16,}$/i

function looksLikeId(text: string): boolean {
  const t = text.trim()
  return UUID_LIKE.test(t) || LONG_HEX.test(t)
}

test("circles theme filter trigger shows readable label, not a UUID", async ({
  page,
}) => {
  const apiErrors: string[] = []
  const pageErrors: string[] = []
  page.on("pageerror", (e) => pageErrors.push(e.message))
  page.on("response", (res) => {
    const url = res.url()
    if (url.includes("/api/") && res.status() >= 400) {
      apiErrors.push(`${res.status()} ${res.request().method()} ${url}`)
    }
  })

  // --- Login as seeded admin ---
  await page.goto("/login")
  await page.getByLabel("Email").fill("andresprimera@gmail.com")
  await page.getByLabel("Password").fill("Test@123")
  await page.getByRole("button", { name: /sign in|log in|login/i }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // --- Navigate to circles ---
  await page.goto("/dashboard/circles")
  await expect(
    page.getByRole("heading", { name: /circles/i }),
  ).toBeVisible({ timeout: 15000 })

  // The theme filter Select trigger. It starts as the "All themes" placeholder.
  const filterTrigger = page
    .getByRole("combobox")
    .filter({ hasText: /all themes/i })
    .first()
  await expect(filterTrigger).toBeVisible()

  await filterTrigger.click()

  // Collect the option labels (excluding "All themes").
  const options = page.getByRole("option")
  await expect(options.first()).toBeVisible()
  const optionTexts = (await options.allInnerTexts()).map((s) => s.trim())
  const themeOptions = optionTexts.filter((t) => !/^all themes$/i.test(t))

  test
    .info()
    .annotations.push({ type: "filter-options", description: optionTexts.join(" | ") })

  if (themeOptions.length === 0) {
    await page.keyboard.press("Escape")
    throw new Error(
      `No theme options seeded in the filter dropdown. Options seen: ${JSON.stringify(
        optionTexts,
      )}`,
    )
  }

  const chosen = themeOptions[0]
  await page.getByRole("option", { name: chosen, exact: true }).click()

  // Re-resolve the trigger (now collapsed) and read its visible text.
  // The trigger button also contains a decorative chevron glyph, so we
  // assert the label is contained and strip non-label glyphs when reading.
  const collapsedTrigger = page.getByRole("combobox").first()
  await expect(collapsedTrigger).toContainText(chosen, { timeout: 5000 })

  const triggerText = (await collapsedTrigger.innerText())
    .replace(/[▲▼⌄⌃]/g, "")
    .trim()
  test
    .info()
    .annotations.push({ type: "filter-trigger-text", description: triggerText })

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/circles-dropdown-label.png`,
    fullPage: false,
  })

  expect(
    looksLikeId(triggerText),
    `Filter trigger should show a readable label but showed "${triggerText}"`,
  ).toBe(false)
  expect(triggerText).toBe(chosen)

  expect(pageErrors, "no uncaught page errors").toEqual([])
  expect(apiErrors, "no 4xx/5xx on /api during flow").toEqual([])
})

test("add circle dialog theme select trigger shows readable label, not a UUID", async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on("pageerror", (e) => pageErrors.push(e.message))

  await page.goto("/login")
  await page.getByLabel("Email").fill("andresprimera@gmail.com")
  await page.getByLabel("Password").fill("Test@123")
  await page.getByRole("button", { name: /sign in|log in|login/i }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  await page.goto("/dashboard/circles")
  await expect(
    page.getByRole("heading", { name: /circles/i }),
  ).toBeVisible({ timeout: 15000 })

  // Open the Add Circle dialog.
  await page.getByRole("button", { name: /add circle/i }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: /add circle/i }),
  ).toBeVisible()

  // The Theme select inside the dialog shows "Select a theme" placeholder.
  const themeTrigger = dialog
    .getByRole("combobox")
    .filter({ hasText: /select a theme/i })
    .first()
  await expect(themeTrigger).toBeVisible()
  await themeTrigger.click()

  const options = page.getByRole("option")
  await expect(options.first()).toBeVisible()
  const optionTexts = (await options.allInnerTexts()).map((s) => s.trim())

  test
    .info()
    .annotations.push({ type: "dialog-options", description: optionTexts.join(" | ") })

  if (optionTexts.length === 0) {
    await page.keyboard.press("Escape")
    throw new Error("No theme options seeded in the Add Circle dialog.")
  }

  const chosen = optionTexts[0]
  await page.getByRole("option", { name: chosen, exact: true }).click()

  const collapsedTrigger = dialog.getByRole("combobox").first()
  await expect(collapsedTrigger).toContainText(chosen, { timeout: 5000 })
  const triggerText = (await collapsedTrigger.innerText())
    .replace(/[▲▼⌄⌃]/g, "")
    .trim()

  test
    .info()
    .annotations.push({ type: "dialog-trigger-text", description: triggerText })

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/circles-dropdown-add-dialog.png`,
    fullPage: false,
  })

  expect(
    looksLikeId(triggerText),
    `Dialog theme trigger should show a readable label but showed "${triggerText}"`,
  ).toBe(false)
  expect(triggerText).toBe(chosen)
  expect(pageErrors, "no uncaught page errors").toEqual([])
})
