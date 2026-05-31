import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"
const API = "http://localhost:3030"
const PASSWORD = "Sup3rSecret!23"

async function signup(page, email) {
  await page.goto(`${BASE}/signup`)
  await page.getByLabel("Full Name").fill(email.startsWith("a-") ? "Ana Lopez" : "Marta Ruiz")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create Account" }).click()
  await page.waitForURL(/\/onboarding/, { timeout: 20000 })
  return page.evaluate(() => localStorage.getItem("accessToken"))
}

const browser = await chromium.launch()
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const pageA = await ctxA.newPage()
const pageB = await ctxB.newPage()
const stamp = Date.now()
const tokenA = await signup(pageA, `a-${stamp}@example.com`)
const tokenB = await signup(pageB, `b-${stamp}@example.com`)

const meB = await (await fetch(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${tokenB}` } })).json()
const scheduledAt = new Date(Date.now() + 3 * 86400000)
scheduledAt.setHours(15, 0, 0, 0)
const meeting = await (await fetch(`${API}/api/meetings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
  body: JSON.stringify({ peerUserId: meB.id, scheduledAt: scheduledAt.toISOString() }),
})).json()
const mid = meeting.id
console.log("meeting:", mid)

// A proposes a time
await pageA.goto(`${BASE}/dashboard/conversations/${mid}/schedule`, { waitUntil: "networkidle" })
await pageA.waitForTimeout(600)
await pageA.getByRole("button", { name: "Tomorrow" }).click()
await pageA.waitForTimeout(200)
await pageA.getByRole("button", { name: /AM|PM/ }).first().click()
await pageA.getByRole("button", { name: /Propose this time/ }).click()
await pageA.waitForTimeout(1000)
await pageA.screenshot({ path: join(OUT, "scheduling-proposed.png"), fullPage: true })
console.log("proposed shot saved")

// B sees the proposal and accepts
await pageB.goto(`${BASE}/dashboard/conversations/${mid}/schedule`, { waitUntil: "networkidle" })
await pageB.waitForTimeout(800)
await pageB.getByRole("button", { name: /^Yes$/ }).first().click()
await pageB.waitForTimeout(1500)
await pageB.screenshot({ path: join(OUT, "scheduling-confirmed.png"), fullPage: true })
console.log("confirmed shot saved")

await browser.close()
