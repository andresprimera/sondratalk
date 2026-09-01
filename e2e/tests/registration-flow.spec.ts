import { test, expect, type Page } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

// Exercises the account-last registration survey at /register end-to-end:
// the opener, all seven questions (single-select reveal-gating + the Q6
// multi-select min-2 gate), both interstitials, and the account step. Also
// asserts the landing "Sign up" CTA routes to /register. Proof screenshots
// land in the repo-root screenshots/ directory.

const SCREENSHOTS_DIR = resolve(__dirname, "../../screenshots")

function shot(name: string): string {
  return resolve(SCREENSHOTS_DIR, name)
}

test.beforeAll(() => {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
})

// Selects a single-select chip, submits, asserts the reply reveals and the
// button flips to Continue, then advances.
async function answerSingle(page: Page, chip: string, exact = false): Promise<void> {
  await page.getByRole("button", { name: chip, exact }).click()
  await page.getByRole("button", { name: "Submit answer" }).click()
  const continueBtn = page.getByRole("button", { name: "Continue" })
  await expect(continueBtn).toBeVisible()
  await expect(page.locator(".onboarding-reply")).toHaveAttribute(
    "data-visible",
    "true",
  )
  await continueBtn.click()
}

test("registration survey walks every step and reveal-gating works", async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on("pageerror", (err) => pageErrors.push(err.message))

  await page.goto("/register")

  // --- Screen 0: opener ---
  await expect(
    page.getByRole("heading", {
      name: /The most valuable connections start with/i,
    }),
  ).toBeVisible()
  await page.screenshot({ path: shot("registration-flow-01-opener.png"), fullPage: true })
  await page.getByRole("button", { name: "Start" }).click()

  // --- Q1: intent (single-select) — assert the reveal gate explicitly ---
  await expect(page.getByRole("heading", { name: "What brought you here?" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeDisabled()
  await page.getByRole("button", { name: "Curiosity" }).click()
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled()
  await page.getByRole("button", { name: "Submit answer" }).click()
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible()
  await expect(page.locator(".onboarding-reply")).toHaveAttribute("data-visible", "true")
  await expect(page.getByText(/Curiosity is the most durable reason/i)).toBeVisible()
  await page.waitForTimeout(900) // let the reveal transition settle for the shot
  await page.screenshot({ path: shot("registration-flow-02-question-reply.png"), fullPage: true })
  await page.getByRole("button", { name: "Continue" }).click()

  // --- Q2–Q5 ---
  await expect(page.getByRole("heading", { name: "How old are you?" })).toBeVisible()
  await answerSingle(page, "25–34")

  await expect(
    page.getByRole("heading", { name: /Do you feel like you have real conversations/i }),
  ).toBeVisible()
  await answerSingle(page, "Yes", true)

  await expect(page.getByRole("heading", { name: "Where do your days happen?" })).toBeVisible()
  await answerSingle(page, "A bit of both")

  await expect(
    page.getByRole("heading", { name: /How far are you from where you're from/i }),
  ).toBeVisible()
  await answerSingle(page, "Another country")

  // --- Beta interstitial ---
  await expect(
    page.getByRole("heading", { name: /Sondra is in beta, and beta is free/i }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Next" }).click()

  // --- Q6: circles (multi-select, min 2) ---
  await expect(page.getByRole("heading", { name: "What are your circles?" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeDisabled()
  await page.getByRole("button", { name: "Parenthood" }).click()
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeDisabled()
  await page.getByRole("button", { name: "Grief" }).click()
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled()
  await page.screenshot({ path: shot("registration-flow-03-circles.png"), fullPage: true })
  await page.getByRole("button", { name: "Submit answer" }).click()
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()

  // --- Q7: blocker ---
  await expect(
    page.getByRole("heading", { name: /Is there something that stops you from talking/i }),
  ).toBeVisible()
  await answerSingle(page, "It'll be awkward")

  // --- Account step ---
  await expect(page.getByRole("heading", { name: "Where should we reach you?" })).toBeVisible()
  await expect(page.getByPlaceholder("Your name")).toBeVisible()
  await expect(page.getByPlaceholder("Email address")).toBeVisible()
  await expect(page.getByPlaceholder("Choose a password")).toBeVisible()
  await expect(page.getByRole("button", { name: "Enter Sondra" })).toBeVisible()
  await page.screenshot({ path: shot("registration-flow-04-account.png"), fullPage: true })

  // The whole survey walk must be free of uncaught runtime errors.
  expect(pageErrors).toEqual([])
})

test("landing Sign up CTA routes to /register", async ({ page }) => {
  await page.goto("/")
  const signUp = page.getByRole("link", { name: "Sign up" }).first()
  await expect(signUp).toBeVisible()
  await signUp.click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(
    page.getByRole("heading", {
      name: /The most valuable connections start with/i,
    }),
  ).toBeVisible()
  await page.screenshot({ path: shot("registration-flow-05-landing-cta.png"), fullPage: true })
})
