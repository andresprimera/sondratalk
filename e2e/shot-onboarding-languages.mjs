import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"
import { tmpdir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"
const USER_PW = "Sup3rSecret!23"
const email = readFileSync(
  join(tmpdir(), "sondra-font-user-email.txt"),
  "utf8",
).trim()

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`)
await page.getByLabel("Email").fill(email)
await page.getByLabel("Password", { exact: true }).fill(USER_PW)
await page.getByRole("button", { name: "Login", exact: true }).click()
await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 20000 })

await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" })
// Step 1 (location) -> step 2 (languages) where the fluency pills live.
await page.getByRole("button", { name: "Looks right" }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, "font-size-onboarding-languages.png") })
const pills = await page
  .getByText("Conversational", { exact: false })
  .first()
  .isVisible()
  .catch(() => false)
console.log(`languages step captured; fluency pills visible = ${pills}`)
await browser.close()
