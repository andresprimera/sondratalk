import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"
const ADMIN = { email: "andresprimera@gmail.com", password: "Test@123" }
const USER_PW = "Sup3rSecret!23"
const EMAIL_FILE = join(tmpdir(), "sondra-width-user-email.txt")

// "after" (current code, max-w-3xl) creates the user; "before" (stashed,
// max-w-2xl) reuses the same user so it's a true side-by-side of the user
// dashboard (UserDashboardLayout, no sidebar) at the two container widths.
const mode = process.argv[2] === "before" ? "before" : "after"
const outFile =
  mode === "before" ? "dashboard-width-before.png" : "dashboard-width-after.png"
const viewport = { width: 1280, height: 900 }
const browser = await chromium.launch()

async function login(page, email, password) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()
  await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 20000 })
}

let email
if (mode === "before") {
  email = readFileSync(EMAIL_FILE, "utf8").trim()
} else {
  email = `goal-width-${Date.now()}@example.com`
  writeFileSync(EMAIL_FILE, email)

  // 1) Admin allowlists the @example.com domain (idempotent — a duplicate just
  // toasts an error, the domain is still allowlisted).
  const adminCtx = await browser.newContext({ viewport })
  const adminPage = await adminCtx.newPage()
  await login(adminPage, ADMIN.email, ADMIN.password)
  await adminPage.goto(`${BASE}/dashboard/allowlist`, {
    waitUntil: "networkidle",
  })
  await adminPage.getByRole("button", { name: "Add Entry" }).click()
  await adminPage.locator("#add-allowlist-value").fill("@example.com")
  await adminPage.getByRole("button", { name: "Add", exact: true }).click()
  await adminPage.waitForTimeout(1200)
  await adminCtx.close()

  // 2) Sign up the (non-first => role "user") account.
  const suCtx = await browser.newContext({ viewport })
  const suPage = await suCtx.newPage()
  await suPage.goto(`${BASE}/signup`)
  await suPage.getByLabel("Full Name").fill("Width Tester")
  await suPage.getByLabel("Email").fill(email)
  await suPage.getByLabel("Password", { exact: true }).fill(USER_PW)
  await suPage.getByLabel("Confirm Password").fill(USER_PW)
  await suPage.getByRole("button", { name: "Apply", exact: true }).click()
  await suPage.waitForURL(/\/onboarding/, { timeout: 20000 })
  await suCtx.close()
}

const ctx = await browser.newContext({ viewport })
const page = await ctx.newPage()
await login(page, email, USER_PW)
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
await page.waitForTimeout(1000)
const colWidth = await page
  .locator("main > div")
  .first()
  .evaluate((el) => el.getBoundingClientRect().width)
console.log(`${mode}: content column width = ${colWidth}px`)
await page.screenshot({ path: join(OUT, outFile) })
console.log(`saved ${outFile}`)
await browser.close()
