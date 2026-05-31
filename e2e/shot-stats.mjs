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
await page.getByLabel("Email").fill(`goal-st-${Date.now()}@example.com`)
await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
await page.getByLabel("Confirm Password").fill(PASSWORD)
await page.getByRole("button", { name: "Create Account" }).click()
await page.waitForURL(/\/onboarding/, { timeout: 20000 })
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
await page.waitForTimeout(1000)
// English: crop to the stats card
const card = page.locator(".rounded-xl, [data-slot=card]").filter({ hasText: "Conversations" }).first()
await card.screenshot({ path: join(OUT, "stats-en.png") })
console.log("en saved")
// Switch to Spanish via localStorage and reload
await page.evaluate(() => localStorage.setItem("i18nextLng", "es"))
await page.reload({ waitUntil: "networkidle" })
await page.waitForTimeout(1000)
const cardEs = page.locator("[data-slot=card]").filter({ hasText: "Conversaciones" }).first()
await cardEs.screenshot({ path: join(OUT, "stats-es.png") })
console.log("es saved")
await browser.close()
