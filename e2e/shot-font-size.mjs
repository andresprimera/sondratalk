import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"
const USER_PW = "Sup3rSecret!23"
const EMAIL_FILE = join(tmpdir(), "sondra-font-user-email.txt")

// "after" = current code (21px base); "before" = stashed (19px base). Captures
// the landing (public) and the logged-in dashboard at both sizes, plus an
// onboarding integrity shot (the layout that previously broke on font bumps).
const mode = process.argv[2] === "before" ? "before" : "after"
const viewport = { width: 1280, height: 900 }
const browser = await chromium.launch()

async function login(page, email, password) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()
  await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 20000 })
}

// Landing (public — no auth).
{
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, `font-size-landing-${mode}.png`) })
  console.log(`saved font-size-landing-${mode}.png`)
  await ctx.close()
}

let email
if (mode === "before") {
  email = readFileSync(EMAIL_FILE, "utf8").trim()
} else {
  email = `goal-font-${Date.now()}@example.com`
  writeFileSync(EMAIL_FILE, email)

  const suCtx = await browser.newContext({ viewport })
  const suPage = await suCtx.newPage()
  await suPage.goto(`${BASE}/signup`)
  await suPage.getByLabel("Full Name").fill("Font Tester")
  await suPage.getByLabel("Email").fill(email)
  await suPage.getByLabel("Password", { exact: true }).fill(USER_PW)
  await suPage.getByLabel("Confirm Password").fill(USER_PW)
  await suPage.getByRole("button", { name: "Sign up", exact: true }).click()
  await suPage.waitForURL(/\/onboarding/, { timeout: 20000 })
  // Onboarding integrity: capture the languages step where the fluency pills
  // previously wrapped/overflowed when the font was enlarged.
  await suPage.waitForTimeout(800)
  await suPage.screenshot({ path: join(OUT, "font-size-onboarding.png") })
  console.log("saved font-size-onboarding.png")
  await suCtx.close()
}

// Logged-in dashboard at this font size.
{
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await login(page, email, USER_PW)
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  const rootFont = await page
    .locator("html")
    .evaluate((el) => getComputedStyle(el).fontSize)
  console.log(`${mode}: root font-size = ${rootFont}`)
  await page.screenshot({ path: join(OUT, `font-size-dashboard-${mode}.png`) })
  console.log(`saved font-size-dashboard-${mode}.png`)
  await ctx.close()
}

await browser.close()
