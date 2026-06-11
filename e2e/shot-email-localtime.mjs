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

// One conversation at a fixed UTC instant; each recipient sees it in their own
// timezone. 14:30 UTC on 1 June => 10:30 in New York (EDT) and 16:30 in Madrid.
const scheduledAt = new Date("2026-06-01T14:30:00Z")
const recipients = [
  { slug: "newyork", locale: "en", timeZone: "America/New_York" },
  { slug: "madrid", locale: "es", timeZone: "Europe/Madrid" },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 640, height: 1000 } })
const page = await ctx.newPage()

for (const { slug, locale, timeZone } of recipients) {
  const data = {
    otherFirst: "Pepe",
    dayLabel: formatDayLabel(scheduledAt, locale, timeZone),
    timeRange: formatTimeRange(scheduledAt, 60, locale, timeZone),
    tzLabel: formatTimeZoneLabel(scheduledAt, locale, timeZone),
    joinUrl: "https://www.sondratalk.com/call/demo",
  }
  console.log(`${slug} (${timeZone}): ${data.timeRange} ${data.tzLabel}`)
  const html = EMAIL_COPY[locale].bodyHtml(data)
  const file = join(tmpdir(), `sondra-email-${slug}.html`)
  writeFileSync(file, html)
  await page.goto(`file://${file}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: join(OUT, `email-localtime-${slug}.png`),
    fullPage: true,
  })
  console.log(`saved email-localtime-${slug}.png`)
}

await browser.close()
