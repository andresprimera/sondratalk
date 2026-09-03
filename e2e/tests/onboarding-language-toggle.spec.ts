import { test, expect } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

// Verifies the LanguageToggle added to the header of the PUBLIC account-last
// registration flow (/register). It must (a) render on the opener step,
// (b) switch the whole UI from English to Spanish, and (c) still be present on
// a later survey step — proving it's on the shared header, not just the opener.
// Proof screenshots land in the repo-root screenshots/ directory.

const SCREENSHOTS_DIR = resolve(__dirname, "../../screenshots")

function shot(name: string): string {
  return resolve(SCREENSHOTS_DIR, name)
}

test.beforeAll(() => {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
})

test("language toggle switches /register from English to Spanish and rides along to later steps", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const apiFailures: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", (err) => pageErrors.push(err.message))
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 400) {
      apiFailures.push(`${res.status()} ${res.url()}`)
    }
  })

  // Force a deterministic English start regardless of any cached preference:
  // runs before the app's i18n LanguageDetector reads localStorage.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("i18nextLng", "en")
    } catch {
      /* ignore storage access issues */
    }
  })

  await page.goto("/register")

  // --- Step 1/2: opener renders in English, toggle present ---------------
  const startBtn = page.getByRole("button", { name: "Start", exact: true })
  await expect(startBtn).toBeVisible()
  await expect(
    page.getByText("Seven short questions. Two minutes. No account needed yet."),
  ).toBeVisible()

  const toggleEn = page.getByRole("button", { name: "Change language" })
  await expect(toggleEn).toBeVisible()
  await expect(toggleEn).toBeInViewport()

  // --- Step 3: screenshot English ----------------------------------------
  await page.screenshot({
    path: shot("onboarding-language-toggle-en.png"),
    fullPage: true,
  })

  // --- Step 4: open the toggle and pick Español --------------------------
  await toggleEn.click()
  const englishItem = page.getByRole("menuitem", { name: "English" })
  const spanishItem = page.getByRole("menuitem", { name: "Español" })
  await expect(englishItem).toBeVisible()
  await expect(spanishItem).toBeVisible()
  await spanishItem.click()

  // The menu closes itself on select (via a short CSS exit animation, so it
  // stays briefly mounted). Wait for it to fully dismiss before asserting the
  // Spanish state and shooting the proof — otherwise the screenshot catches
  // the closing popup mid-animation.
  await expect(spanishItem).toBeHidden()
  await expect(
    page.locator('[data-slot="dropdown-menu-content"]'),
  ).toHaveCount(0)

  // --- Step 5: UI is now Spanish -----------------------------------------
  const empezarBtn = page.getByRole("button", { name: "Empezar", exact: true })
  await expect(empezarBtn).toBeVisible()
  await expect(
    page.getByText(
      "Siete preguntas breves. Dos minutos. Aún no hace falta una cuenta.",
    ),
  ).toBeVisible()
  // The Spanish opener wraps to more lines than English, making the page
  // scrollable; the dropdown interaction can leave it scrolled past the (non-
  // fixed) header. Return to the top — where the header lives — before
  // asserting the toggle is within the viewport and shooting the proof.
  await page.evaluate(() => window.scrollTo(0, 0))
  // The toggle's accessible name is now the Spanish string.
  const toggleEs = page.getByRole("button", { name: "Cambiar idioma" })
  await expect(toggleEs).toBeVisible()
  await expect(toggleEs).toBeInViewport()
  // English trigger accessible name must be gone (confirms the swap).
  await expect(
    page.getByRole("button", { name: "Change language" }),
  ).toHaveCount(0)

  // --- Step 6: screenshot Spanish ----------------------------------------
  await page.screenshot({
    path: shot("onboarding-language-toggle-es.png"),
    fullPage: true,
  })

  // --- Step 7: advance to Q1 and confirm the toggle rides along ----------
  await empezarBtn.click()
  await expect(
    page.getByRole("heading", { name: "¿Qué te trajo aquí?" }),
  ).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(
    page.getByRole("button", { name: "Cambiar idioma" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Cambiar idioma" }),
  ).toBeInViewport()
  await page.screenshot({
    path: shot("onboarding-language-toggle-step.png"),
    fullPage: true,
  })

  // Diagnostics: the whole flow must be free of uncaught runtime errors.
  expect(pageErrors, `pageerrors: ${pageErrors.join(" | ")}`).toEqual([])
  expect(apiFailures, `api 4xx/5xx: ${apiFailures.join(" | ")}`).toEqual([])
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual(
    [],
  )
})
