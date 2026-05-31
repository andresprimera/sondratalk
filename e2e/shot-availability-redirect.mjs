import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"
const PASSWORD = "Sup3rSecret!23"
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto(`${BASE}/signup`)
await page.getByLabel("Full Name").fill("Sondra Tester")
await page.getByLabel("Email").fill(`goal-av-${Date.now()}@example.com`)
await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
await page.getByLabel("Confirm Password").fill(PASSWORD)
await page.getByRole("button", { name: "Create Account" }).click()
await page.waitForURL(/\/onboarding/, { timeout: 20000 })
// Go straight to availability page (no onboarding gate on dashboard)
await page.goto(`${BASE}/dashboard/availability`, { waitUntil: "networkidle" })
await page.waitForTimeout(800)
// Toggle a couple of grid cells so we save a real window
const grid = page.locator(".flex.flex-col.gap-1\\.5").first()
const cells = grid.getByRole("button")
const count = await cells.count()
if (count > 0) { await cells.nth(0).click(); await cells.nth(1).click() }
await page.waitForTimeout(300)
await page.getByRole("button", { name: /Save windows/ }).click()
await page.waitForURL(/\/dashboard$/, { timeout: 10000 })
await page.waitForTimeout(1200)
console.log("URL after save:", page.url())
await page.screenshot({ path: join(OUT, "availability-save-redirect.png"), fullPage: true })
console.log("saved")
await browser.close()
