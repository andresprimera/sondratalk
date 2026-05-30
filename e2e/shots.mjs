// Ad-hoc screenshot helper for /goal proof shots.
// Usage: node shots.mjs <name> <path> [auth]
//   name : output file name (without extension) -> ../screenshots/<name>.png
//   path : route to visit, e.g. /dashboard
//   auth : "auth" to sign up a fresh user first (token stored in localStorage)
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "screenshots")
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5174"

const [, , name, path, auth] = process.argv
if (!name || !path) {
  console.error("usage: node shots.mjs <name> <path> [auth]")
  process.exit(1)
}

const PASSWORD = "Sup3rSecret!23"

async function signup(page) {
  const email = `goal-shot-${Date.now()}@example.com`
  await page.goto(`${BASE}/signup`)
  await page.getByLabel("Full Name").fill("Sondra Tester")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create Account" }).click()
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 })
  return email
}

mkdirSync(OUT_DIR, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

if (auth === "auth") await signup(page)

await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
await page.waitForTimeout(1200)
const file = join(OUT_DIR, `${name}.png`)
await page.screenshot({ path: file, fullPage: true })
console.log(`saved ${file}`)
await browser.close()
