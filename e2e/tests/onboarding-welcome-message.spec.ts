import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Proves the onboarding welcome screen (OnboardingWelcomeStep) no longer uses
// the old "application / we review / 48 hours" waitlist framing. The flow is:
//   signup -> /onboarding
//   step 1: location  -> "Looks right →"
//   step 2: languages -> "Continue →"      (a native language is pre-selected)
//   step 3: circles   -> pick >=3 chips -> "Enter Sondra →"
//   step 4: welcome   -> assert new copy + screenshot
//
// The screenshot lands at repo-root /screenshots/onboarding-welcome-message.png.

const NEW_HEADLINE_EN = "you're in.";
const NEW_HEADLINE_ES = "ya estás dentro.";
const NEW_LINE_EN = "if you're here, you are welcome";
const NEW_LINE_ES = "si estás aquí, eres bienvenido";
// The waitlist/"application" framing that must no longer appear on this screen.
const OLD_LINES = [
  "Your application is in.",
  "We review every application personally",
];

const SCREENSHOTS_DIR = resolve(__dirname, "../../screenshots");
const SCREENSHOT_PATH = resolve(SCREENSHOTS_DIR, "onboarding-welcome-message.png");

// A clearly-disposable, unique account for this run.
const TIMESTAMP = Date.now();
const TEST_EMAIL = `todo-onboarding-${TIMESTAMP}@example.com`;
const TEST_PASSWORD = "Test1234!";
const TEST_NAME = "Todo Onboarding";

function wireDiagnostics(page: Page): { consoleErrors: string[]; apiErrors: string[] } {
  const consoleErrors: string[] = [];
  const apiErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/api/") && res.status() >= 400) {
      apiErrors.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });
  return { consoleErrors, apiErrors };
}

test("onboarding welcome screen shows the new welcome copy", async ({ page }) => {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const { apiErrors } = wireDiagnostics(page);

  // --- Sign up a fresh throwaway account ---------------------------------
  await page.goto("/signup");
  await page.getByLabel("Full Name").fill(TEST_NAME);
  await page.getByLabel("Email").fill(TEST_EMAIL);
  // Two password fields ("Password", "Confirm Password"); target by id to be exact.
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#confirm-password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();

  // Signup redirects to /onboarding on success.
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });

  // --- Step 1: Location --------------------------------------------------
  // Timezone is auto-detected; just accept it.
  await page.getByRole("button", { name: "Looks right →" }).click();

  // --- Step 2: Languages -------------------------------------------------
  // A native browser language is pre-selected + starred as primary, so the
  // "Continue →" button should be enabled without further input.
  const continueBtn = page.getByRole("button", { name: "Continue →" });
  await expect(continueBtn).toBeVisible({ timeout: 15000 });
  await expect(continueBtn).toBeEnabled();
  await continueBtn.click();

  // --- Step 3: Circles ---------------------------------------------------
  // Need at least 3 circle chips selected to enable "Enter Sondra →".
  // Circles load from the API; wait for the heading, then pick the first
  // three non-private chips (private ones open a password dialog).
  await expect(
    page.getByRole("heading", { name: "What are your circles?" }),
  ).toBeVisible({ timeout: 15000 });

  const enterBtn = page.getByRole("button", { name: "Enter Sondra →" });
  // Chips are <button> elements inside .onboarding-chip-row. Selecting by the
  // stable class keeps us off private-circle chips only by luck, so instead we
  // click chips until the submit button is enabled (max a handful of tries).
  const chips = page.locator("button.onboarding-chip");
  await expect(chips.first()).toBeVisible({ timeout: 15000 });

  const chipCount = await chips.count();
  let selected = 0;
  for (let i = 0; i < chipCount && selected < 4; i += 1) {
    const chip = chips.nth(i);
    await chip.click();
    // If a private-circle password dialog appears, dismiss it and skip.
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      continue;
    }
    // Count as selected only if the chip now reports pressed.
    if ((await chip.getAttribute("aria-pressed")) === "true") selected += 1;
    if (await enterBtn.isEnabled()) break;
  }

  await expect(enterBtn).toBeEnabled({ timeout: 10000 });
  await enterBtn.click();

  // --- Step 4: Welcome --------------------------------------------------
  // Clicking "Enter Sondra →" submits circles and lands straight on the
  // welcome screen — there is no longer an "application" step in between.
  const newHeadline = page.getByText(
    new RegExp(`${NEW_HEADLINE_EN}|${NEW_HEADLINE_ES}`),
  );
  await expect(newHeadline).toBeVisible({ timeout: 15000 });

  // The new copy must be present (English or Spanish, depending on detected
  // locale), and every trace of the old waitlist/application framing gone.
  const newLine = page.getByText(new RegExp(`${NEW_LINE_EN}|${NEW_LINE_ES}`));
  await expect(newLine).toBeVisible();
  for (const oldLine of OLD_LINES) {
    await expect(page.getByText(oldLine)).toHaveCount(0);
  }

  // The dashboard CTA should be reachable.
  await expect(page.getByRole("button", { name: "Go to dashboard →" })).toBeVisible();

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

  // Surface any API failures encountered along the happy path.
  expect(apiErrors, `Unexpected /api errors: ${apiErrors.join(", ")}`).toEqual([]);
});
