// One-shot screenshot: landing page hero with founding-members counter
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "screenshots")
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5176"

mkdirSync(OUT_DIR, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

// Collect console output and network errors for diagnostics
const consoleMessages = []
page.on("console", msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`))
page.on("pageerror", err => consoleMessages.push(`[pageerror] ${err.message}`))
page.on("response", res => {
  if (res.url().includes("/api/") && res.status() >= 400) {
    consoleMessages.push(`[network] ${res.status()} ${res.url()}`)
  }
})

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30000 })
// Extra wait for any async counter fetch to resolve (or gracefully not appear)
await page.waitForTimeout(3000)

const file = join(OUT_DIR, "founding-members-counter.png")
await page.screenshot({ path: file, fullPage: false })
console.log(`saved: ${file}`)

// Print visible hero text for reference
const heroText = await page.evaluate(() => {
  const hero = document.querySelector("main, .hero, [class*='hero'], section")
    ?? document.body
  return hero.innerText.trim().substring(0, 600)
})
console.log("\n--- visible hero text (first 600 chars) ---")
console.log(heroText)

if (consoleMessages.length) {
  console.log("\n--- console / network events ---")
  consoleMessages.forEach(m => console.log(m))
}

await browser.close()
