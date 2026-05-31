import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"
const PASSWORD = "Sup3rSecret!23"
const suffix = process.argv[2] ?? "before"
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const email = `goal-ob-${Date.now()}@example.com`
await page.goto(`${BASE}/signup`)
await page.getByLabel("Full Name").fill("Sondra Tester")
await page.getByLabel("Email").fill(email)
await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
await page.getByLabel("Confirm Password").fill(PASSWORD)
await page.getByRole("button", { name: "Create Account" }).click()
await page.waitForURL(/\/onboarding/, { timeout: 20000 })
await page.waitForTimeout(800)
// Step 1 -> click "Looks right"
await page.getByRole("button", { name: /Looks right/ }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: join(OUT, `onboarding-step2-${suffix}.png`), fullPage: true })
console.log("step2 saved")
await browser.close()
