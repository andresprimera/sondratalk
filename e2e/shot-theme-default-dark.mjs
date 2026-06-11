import { chromium } from "@playwright/test"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "screenshots")
const BASE = "http://localhost:5174"

const browser = await chromium.launch()
// Fresh context => empty localStorage => the cold-load case (e.g. arriving
// at beta.sondratalk.com from sondratalk.com). Must render dark immediately.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
const htmlClass = await page.locator("html").getAttribute("class")
console.log(`<html class="${htmlClass}">`)
await page.screenshot({ path: join(OUT, "theme-default-dark.png") })
console.log("saved theme-default-dark.png")
await browser.close()
