import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"
const PASSWORD = "Sup3rSecret!23"

async function signup(page, name) {
  const email = `wrapup-${name}-${Date.now()}@example.com`
  await page.goto(`${BASE}/signup`)
  await page.getByLabel("Full Name").fill(`Wrapup ${name}`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create Account" }).click()
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 })
}

async function api(page, path, options = {}) {
  return page.evaluate(
    async ([p, o]) => {
      const res = await fetch(p, {
        ...o,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("accessToken"),
          ...(o.headers || {}),
        },
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    },
    [path, options],
  )
}

const browser = await chromium.launch()

// Peer (the other side of the conversation)
const ctxA = await browser.newContext()
const pageA = await ctxA.newPage()
await signup(pageA, "peer")
const meA = await api(pageA, "/api/users/me")
const peerId = meA.body.id

// Main user creates an instant meeting with the peer, then wraps it up.
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const pageB = await ctxB.newPage()
await signup(pageB, "main")
const created = await api(pageB, "/api/meetings", {
  method: "POST",
  body: JSON.stringify({ peerUserId: peerId, instant: true }),
})
console.log("meeting:", created.status, created.body?.id)
const meetingId = created.body.id

await pageB.goto(`${BASE}/call/${meetingId}/wrap-up`, { waitUntil: "networkidle" })
await pageB.waitForTimeout(800)

// Exercise the form.
await pageB.getByRole("button", { name: "Yes" }).first().click()
await pageB.getByRole("button", { name: "Open", exact: true }).click()
await pageB.waitForTimeout(300)
await pageB
  .getByPlaceholder("What would you want them to know you noticed?")
  .fill("Loved how curious they were about everything.")
await pageB.getByRole("button", { name: "Rate 4 stars" }).click()
await pageB.waitForTimeout(300)
await pageB.screenshot({ path: join(OUT, "wrapup-form.png"), fullPage: true })
console.log("saved wrapup-form")

// Submit and capture the confirmation.
await pageB.getByRole("button", { name: "Done" }).click()
await pageB.waitForTimeout(1200)
await pageB.screenshot({ path: join(OUT, "wrapup-done.png"), fullPage: true })
console.log("saved wrapup-done")

await browser.close()
