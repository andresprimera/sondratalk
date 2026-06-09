// Screenshot helper: capture "Apply" button on landing page and signup form.
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "screenshots")
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5174"

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

// --- 1. Landing page ---
console.log("Navigating to landing page…")
await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
const landingFile = join(OUT_DIR, "apply-landing.png")
await page.screenshot({ path: landingFile, fullPage: true })
console.log(`saved ${landingFile}`)

// Log any buttons found on the page
const buttons = await page.getByRole("button").allTextContents()
const links = await page.getByRole("link").allTextContents()
console.log("Landing page buttons:", buttons)
console.log("Landing page links:", links)

// --- 2. Signup page ---
console.log("Navigating to signup page…")
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
const signupFile = join(OUT_DIR, "apply-signup.png")
await page.screenshot({ path: signupFile, fullPage: true })
console.log(`saved ${signupFile}`)

// Log any buttons on the signup page
const signupButtons = await page.getByRole("button").allTextContents()
console.log("Signup page buttons:", signupButtons)

await browser.close()
console.log("Done.")
