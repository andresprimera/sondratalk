import { test, type Page } from "@playwright/test"

const EMAIL = `call-mock-${Date.now()}@example.com`
const PASSWORD = "Sup3rSecret!23"
const NAME = "Mock Tester"
const FAKE_MEETING_ID = "507f1f77bcf86cd799439011"

async function signup(page: Page): Promise<void> {
  await page.goto("/signup")
  await page.getByLabel("Full Name").fill(NAME)
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create Account" }).click()
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15_000 })
}

test.describe("Call page — simulated video streams", () => {
  test("captures focus layout with mocked remote + local video tiles", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await signup(page)

    await page.goto(`/call/${FAKE_MEETING_ID}`)
    // Wait for the stage card to mount (it's the first <div> child under <main>).
    await page.waitForSelector("main > div", { timeout: 15_000 })

    // Append simulated tiles ON TOP of React's existing stage content without
    // touching React-managed children. innerHTML= would cause React to crash
    // on its next reconciliation.
    await page.evaluate(() => {
      const stage = document.querySelector("main > div") as HTMLElement | null
      if (!stage) throw new Error("Stage card not found")

      const remoteImg =
        "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1600&q=80"
      const localImg =
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80"

      const overlay = document.createElement("div")
      overlay.setAttribute("data-mock", "stage-overlay")
      overlay.style.cssText =
        "position:absolute;inset:0;z-index:50;pointer-events:none;"
      overlay.innerHTML = `
        <img
          src="${remoteImg}"
          alt="Remote"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
        />
        <div
          style="
            position:absolute;
            right:1rem;
            bottom:1rem;
            width:25%;
            max-width:13.75rem;
            min-width:8.75rem;
            aspect-ratio:16/9;
            overflow:hidden;
            border-radius:0.75rem;
            box-shadow:0 10px 15px -3px rgba(0,0,0,0.35);
            outline:2px solid rgba(255,255,255,0.85);
            outline-offset:-2px;
          "
        >
          <img
            src="${localImg}"
            alt="Local"
            style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);"
          />
        </div>
      `
      stage.appendChild(overlay)
    })

    // Wait for both overlay images to finish loading before screenshotting.
    await page.waitForFunction(
      () => {
        const imgs = document.querySelectorAll("[data-mock=stage-overlay] img")
        if (imgs.length < 2) return false
        return Array.from(imgs).every(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        )
      },
      { timeout: 15_000 },
    )

    await page.screenshot({
      path: "test-results/call-mocked-streams-1280x800.png",
      fullPage: false,
    })
  })
})
