import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const require = createRequire(import.meta.url)
// Render the REAL compiled email template (rebuild backend before running).
const { EMAIL_COPY, formatDayLabel, formatTimeRange, formatTimeZoneLabel } =
  require(join(__dirname, "..", "backend", "dist", "meetings", "meeting-email.js"))

// Match the mockup: Thu 12 June, 11:00–12:00, peer "Pepe". The recipient's
// timezone (UTC here) drives the rendered time; see shot-email-localtime.mjs
// for non-UTC recipients.
const scheduledAt = new Date("2025-06-12T11:00:00Z")
const timeZone = "UTC"
const dataFor = (locale) => ({
  otherFirst: "Pepe",
  dayLabel: formatDayLabel(scheduledAt, locale, timeZone),
  timeRange: formatTimeRange(scheduledAt, 60, locale, timeZone),
  tzLabel: formatTimeZoneLabel(scheduledAt, locale, timeZone),
  joinUrl: "https://www.sondratalk.com/call/demo",
})

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 640, height: 1000 } })
const page = await ctx.newPage()

for (const locale of ["en", "es"]) {
  const html = EMAIL_COPY[locale].bodyHtml(dataFor(locale))
  const file = join(tmpdir(), `sondra-email-${locale}.html`)
  writeFileSync(file, html)
  await page.goto(`file://${file}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: join(OUT, `email-confirmation-${locale}.png`),
    fullPage: true,
  })
  console.log(`${locale} saved`)
}

await browser.close()
