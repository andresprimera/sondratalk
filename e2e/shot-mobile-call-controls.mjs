/**
 * Screenshot script proving the mobile call-footer overflow/letterboxing fix:
 *   - the control row (mic/camera/blur + End call) no longer overflows a
 *     ~390px phone viewport (text labels hidden below `sm:`, icon + color +
 *     aria-label communicate state instead).
 *
 * Reaches the ConnectingPlaceholder (DisabledCallControls + CallFooter) by
 * mocking auth (fake JWT, matching shot-onboarding-task15.mjs's pattern) and
 * holding the call-token request pending forever — no real LiveKit
 * connection or camera needed, mirrors e2e/tests/responsive-call-layout.spec.ts.
 */
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "screenshots")
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5174"
const MEETING_ID = "507f1f77bcf86cd799439011"

mkdirSync(OUT_DIR, { recursive: true })

const FAKE_USER = {
  _id: "000000000000000000000001",
  name: "Mobile Tester",
  email: "tester@example.com",
  role: "user",
  timezone: "America/New_York",
  languages: [{ code: "en", name: "English", fluency: "Native" }],
  locale: "en",
  applicationText: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function b64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}
const FAKE_ACCESS = [
  b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  b64url(
    JSON.stringify({
      sub: FAKE_USER._id,
      exp: Math.floor(new Date("2099-01-01").getTime() / 1000),
    }),
  ),
  "fakesignature",
].join(".")
const FAKE_REFRESH = "fake-refresh-token"

const AUTH_RESPONSE = {
  accessToken: FAKE_ACCESS,
  refreshToken: FAKE_REFRESH,
  user: FAKE_USER,
}

const MEETING_BODY = {
  id: MEETING_ID,
  participants: ["000000000000000000000001", "000000000000000000000002"],
  initiatorId: "000000000000000000000001",
  scheduledAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  cancelled: false,
  instant: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  peer: { id: "000000000000000000000002", firstName: "Marta" },
}

function fulfill(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

async function setupMocks(page) {
  await page.route("**/api/**", (route) => fulfill(route, {}))
  await page.route("**/api/auth/refresh", (route) =>
    fulfill(route, AUTH_RESPONSE),
  )
  await page.route(`**/api/meetings/${MEETING_ID}`, (route) =>
    fulfill(route, MEETING_BODY),
  )
  // Hold pending forever so the page settles into ConnectingPlaceholder
  // (DisabledCallControls + CallFooter) without ever needing a real LiveKit
  // connection / camera — matches e2e/tests/responsive-call-layout.spec.ts.
  await page.route("**/api/calls/token", () => {})
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
})
const page = await context.newPage()

page.on("console", (msg) => {
  if (msg.type() === "error") console.error("PAGE ERROR:", msg.text())
})
page.on("pageerror", (err) => console.error("UNCAUGHT:", err.message))

await page.addInitScript(
  ([accessToken, refreshToken]) => {
    localStorage.setItem("accessToken", accessToken)
    localStorage.setItem("refreshToken", refreshToken)
  },
  [FAKE_ACCESS, FAKE_REFRESH],
)

await setupMocks(page)
await page.goto(`${BASE}/call/${MEETING_ID}`)
await page.waitForTimeout(2000)

const footer = page.locator("footer")
const visible = await footer.isVisible({ timeout: 5000 }).catch(() => false)
console.log("footer visible:", visible)

// Confirm no horizontal overflow: footer's right edge must not exceed the
// viewport width (the original bug clipped the leftmost button off-screen).
const box = await footer.boundingBox()
if (box) {
  console.log(
    `footer box: x=${box.x.toFixed(1)} width=${box.width.toFixed(1)} right=${(box.x + box.width).toFixed(1)} viewport=390`,
  )
}
const micButton = page.getByLabel("Microphone")
const micBox = await micButton.boundingBox()
if (micBox) {
  console.log(
    `mic button box: x=${micBox.x.toFixed(1)} (should be >= 0, not clipped off left edge)`,
  )
}

await page.screenshot({
  path: join(OUT_DIR, "mobile-call-footer-fixed.png"),
  fullPage: false,
})
console.log("saved mobile-call-footer-fixed.png")

await browser.close()
console.log("Done.")
