import { chromium } from "@playwright/test"

const dir = "/private/tmp/claude-501/-Users-raulharlev-Documents-Sondra--no-en-claude--sondratalk/d269532e-51cc-4ecf-adf2-f450543af07b/scratchpad"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
page.on("console", (m) => console.log("BROWSER:", m.text()))
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message))

await page.goto("http://localhost:5174/register", { waitUntil: "load" })
await page.waitForSelector("button:has-text('Start')", { timeout: 10000 })

// Switch to Spanish via language toggle
await page.click("header button, header [role=button], header span >> nth=0").catch(() => {})
await page.waitForTimeout(200)

await page.getByRole("button", { name: "Start" }).click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${dir}/q1.png` })

// answer Q1 with "A new city" to check reply text
const q1btn = page.getByRole("button", { name: /new city|ciudad nueva/i })
if (await q1btn.count()) {
  await q1btn.first().click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${dir}/q1-reply.png` })
  await page.getByRole("button", { name: /Continue|Continuar/i }).click().catch(() => {})
}
await page.waitForTimeout(200)

// Q2 age -> pick 18-24
const ageBtn = page.getByRole("button", { name: "18–24" })
if (await ageBtn.count()) { await ageBtn.click(); await page.waitForTimeout(200) }
await page.getByRole("button", { name: /Continue|Continuar/i }).click().catch(() => {})
await page.waitForTimeout(200)
await page.screenshot({ path: `${dir}/q3.png` })

// Q3 pick No
const noBtn = page.getByRole("button", { name: /^No$/ })
if (await noBtn.count()) { await noBtn.click(); await page.waitForTimeout(200) }
await page.getByRole("button", { name: /Continue|Continuar/i }).click().catch(() => {})
await page.waitForTimeout(200)
await page.screenshot({ path: `${dir}/q4-days.png` })

await browser.close()
