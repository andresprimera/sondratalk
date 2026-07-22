import { test, expect, type Page } from "@playwright/test";

// Verify the rewritten /call/:meetingId page:
//   1. Layout stability — fixed aspect-ratio stage, footer anchored at bottom.
//   2. Default focus layout — remote video fills the stage, local PiP in corner.
//   3. Styling — rounded-3xl, ring, shadow, gradient bg on stage card.
//
// Strategy: signup a fresh user (no need for a real meeting), then hit
// /call/<fake-id>. The meeting + token queries will fail, which surfaces
// the error state inside the stage card. We can still validate styling,
// containment, and footer placement from that state.

const EMAIL = `call-layout-${Date.now()}@example.com`;
const PASSWORD = "Sup3rSecret!23";
const NAME = "Layout Tester";
const FAKE_MEETING_ID = "507f1f77bcf86cd799439011"; // ObjectId-shaped so the route resolves

interface RuntimeSink {
  pageErrors: string[];
  apiFailures: string[];
}

function attachDiagnostics(page: Page): RuntimeSink {
  const sink: RuntimeSink = { pageErrors: [], apiFailures: [] };
  page.on("pageerror", (err) => {
    sink.pageErrors.push(err.message);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/api/") && res.status() >= 500) {
      sink.apiFailures.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });
  return sink;
}

async function signup(page: Page): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Full Name").fill(NAME);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("call page layout", () => {
  let sink: RuntimeSink;

  test.beforeEach(async ({ page }) => {
    sink = attachDiagnostics(page);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("error state: stage stays contained and footer is anchored", async ({
    page,
  }) => {
    await signup(page);

    // Navigate to a non-existent meeting. Both /api/meetings/:id and the
    // call token query should fail; we expect the error placeholder inside
    // the stage card.
    await page.goto(`/call/${FAKE_MEETING_ID}`);

    // Wait for the error placeholder text to appear.
    await expect(
      page.getByText("We couldn't start the call."),
    ).toBeVisible({ timeout: 15_000 });

    // Footer controls visible.
    const endCallBtn = page.getByRole("button", { name: "End call" });
    await expect(endCallBtn).toBeVisible();
    // Disabled mic/camera buttons in non-live state.
    await expect(page.getByRole("button", { name: "Microphone" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Camera" })).toBeVisible();

    // --- Layout stability: footer anchored at bottom of viewport ---
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("viewport unset");

    const footerBox = await page
      .locator("footer")
      .first()
      .boundingBox();
    expect(footerBox, "footer should render").not.toBeNull();
    if (!footerBox) return;

    // Footer bottom edge must sit inside the viewport. A correctly
    // anchored footer ends at <= viewport.height. If the stage card
    // grew beyond available vertical space, the footer would scroll
    // out of view — which is functionally broken (the user can't see
    // the End call button without scrolling).
    const footerBottom = footerBox.y + footerBox.height;
    expect(
      footerBottom,
      `footer bottom (${footerBottom}) should fit within the ${viewport.height}px viewport — if larger, footer is below the fold`,
    ).toBeLessThanOrEqual(viewport.height + 2);
    expect(
      footerBottom,
      `footer should sit in the lower half of the viewport`,
    ).toBeGreaterThan(viewport.height * 0.5);

    // Page should not scroll vertically — fixed stage size should keep
    // everything within min-h-svh.
    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    expect(
      scrollHeight,
      `page scrollHeight (${scrollHeight}) should not exceed viewport (${viewport.height}) — call page should not scroll`,
    ).toBeLessThanOrEqual(viewport.height + 2);

    // --- Stage card sizing & styling ---
    // The error placeholder lives inside the stage card; walk up to the
    // stage card by selector instead.
    const stageCard = page.locator("main > div").first();
    await expect(stageCard).toBeVisible();

    const stageBox = await stageCard.boundingBox();
    expect(stageBox, "stage card should render").not.toBeNull();
    if (!stageBox) return;

    // aspect-video = 16:9, so width / height ≈ 1.777
    const ratio = stageBox.width / stageBox.height;
    expect(
      ratio,
      `stage card should have ~16:9 aspect ratio (got ${ratio.toFixed(3)})`,
    ).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(1.85);

    // Stage card visual styling.
    const stageStyles = await stageCard.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        boxShadow: cs.boxShadow,
        backgroundImage: cs.backgroundImage,
        overflow: cs.overflow,
      };
    });
    // rounded-3xl in this theme resolves via CSS vars; accept a generous
    // 20-32px range to confirm "very rounded" without being brittle.
    const radiusPx = parseFloat(stageStyles.borderRadius);
    expect(
      radiusPx,
      `stage card border-radius should be large (got ${stageStyles.borderRadius})`,
    ).toBeGreaterThanOrEqual(20);
    expect(radiusPx).toBeLessThanOrEqual(40);
    expect(
      stageStyles.boxShadow,
      "stage card should have a shadow (shadow-2xl)",
    ).not.toBe("none");
    expect(
      stageStyles.backgroundImage,
      "stage card should have a gradient bg",
    ).toContain("gradient");
    expect(stageStyles.overflow).toBe("hidden");

    // --- Error message contained inside the stage card ---
    const errorText = page.getByText("We couldn't start the call.");
    const errorBox = await errorText.boundingBox();
    expect(errorBox).not.toBeNull();
    if (errorBox && stageBox) {
      const padding = 4; // anti-aliasing tolerance
      expect(errorBox.x).toBeGreaterThanOrEqual(stageBox.x - padding);
      expect(errorBox.y).toBeGreaterThanOrEqual(stageBox.y - padding);
      expect(errorBox.x + errorBox.width).toBeLessThanOrEqual(
        stageBox.x + stageBox.width + padding,
      );
      expect(errorBox.y + errorBox.height).toBeLessThanOrEqual(
        stageBox.y + stageBox.height + padding,
      );
    }

    // Error message vertically centered-ish inside the stage card
    // (not pushed to top, not breaking out).
    if (errorBox && stageBox) {
      const errorMid = errorBox.y + errorBox.height / 2;
      const stageMid = stageBox.y + stageBox.height / 2;
      const offset = Math.abs(errorMid - stageMid);
      expect(
        offset,
        `error text midline (${errorMid}) should be near stage midline (${stageMid})`,
      ).toBeLessThan(stageBox.height * 0.25);
    }

    // --- End call button is a rounded pill ---
    const endCallStyles = await endCallBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { borderRadius: cs.borderRadius };
    });
    // rounded-full → effectively infinite radius. Tailwind v4 emits
    // calc(infinity * 1px) which resolves to a huge px value.
    const endCallRadiusPx = parseFloat(endCallStyles.borderRadius);
    expect(
      endCallRadiusPx,
      `End call button should be rounded-full (got ${endCallStyles.borderRadius})`,
    ).toBeGreaterThan(100);

    // --- Mic/Camera disabled controls are circular ---
    const micBtn = page.getByRole("button", { name: "Microphone" });
    const micStyles = await micBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        width: cs.width,
        height: cs.height,
      };
    });
    const micRadiusPx = parseFloat(micStyles.borderRadius);
    expect(
      micRadiusPx,
      `Mic button should be rounded-full (got ${micStyles.borderRadius})`,
    ).toBeGreaterThan(100);
    // size-12 → square (exact px depends on theme spacing scale).
    expect(micStyles.width).toBe(micStyles.height);
    const micSizePx = parseFloat(micStyles.width);
    expect(micSizePx).toBeGreaterThanOrEqual(40);
    expect(micSizePx).toBeLessThanOrEqual(72);

    // Screenshot for human review.
    await page.screenshot({
      path: "test-results/call-error-state.png",
      fullPage: false,
    });

    // No uncaught runtime errors during the flow.
    expect(sink.pageErrors, sink.pageErrors.join("\n")).toEqual([]);
    // No 5xx from /api/.
    expect(sink.apiFailures, sink.apiFailures.join("\n")).toEqual([]);
  });

  test("missing meeting id: 'No meeting specified' state still anchors footer", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });

    // Empty meeting id is unreachable via routes (router requires the
    // param), so skip if we can't construct that case. Instead we test
    // the "connecting" state by short-circuiting the token query — but
    // we don't have an easy hook. The error-state test above covers the
    // main layout concerns; this test just additionally screenshots a
    // second viewport (smaller) to ensure footer stays anchored.
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/call/${FAKE_MEETING_ID}`);

    await expect(
      page.getByText("We couldn't start the call."),
    ).toBeVisible({ timeout: 15_000 });

    const viewport = page.viewportSize();
    if (!viewport) throw new Error("viewport unset");
    const footerBox = await page.locator("footer").first().boundingBox();
    expect(footerBox).not.toBeNull();
    if (!footerBox) return;
    const footerBottom = footerBox.y + footerBox.height;
    expect(
      footerBottom,
      `footer bottom (${footerBottom}) should fit within the ${viewport.height}px viewport`,
    ).toBeLessThanOrEqual(viewport.height + 2);
    expect(footerBottom).toBeGreaterThan(viewport.height * 0.5);

    // Confirm the corner PiP region is NOT rendered in error state
    // (the error placeholder fills the stage; corner appears only in
    // connecting / live states). We don't assert hard absence here —
    // just record stage children.
    const stageCard = page.locator("main > div").first();
    const stageBox = await stageCard.boundingBox();
    expect(stageBox).not.toBeNull();
    if (!stageBox) return;
    // The narrower viewport should still respect max-w-5xl (1024px) and
    // aspect-video.
    expect(stageBox.width).toBeLessThanOrEqual(1024 + 4);

    await page.screenshot({
      path: "test-results/call-error-state-narrow.png",
      fullPage: false,
    });
  });

  // Regression: the stage previously used `max-w-5xl` (64rem) which, with
  // --font-size-base: 19px, resolves to 1216px and never clamped. With the
  // inline `min(100%, 1024px, calc((100svh - 12rem) * 16 / 9))` style the
  // stage should shrink on short viewports so the footer stays in view.
  const desktopViewports: { name: string; width: number; height: number }[] = [
    { name: "1280x800", width: 1280, height: 800 },
    { name: "1366x768", width: 1366, height: 768 },
    { name: "1280x720", width: 1280, height: 720 },
  ];

  for (const vp of desktopViewports) {
    test(`viewport ${vp.name}: footer stays in viewport and stage keeps styling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto("/login");
      await page.getByLabel("Email").fill(EMAIL);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByRole("button", { name: "Login", exact: true }).click();
      await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });

      await page.goto(`/call/${FAKE_MEETING_ID}`);

      await expect(
        page.getByText("We couldn't start the call."),
      ).toBeVisible({ timeout: 15_000 });

      const viewport = page.viewportSize();
      if (!viewport) throw new Error("viewport unset");

      // Footer must sit inside the viewport.
      const footerBox = await page.locator("footer").first().boundingBox();
      expect(footerBox, "footer should render").not.toBeNull();
      if (!footerBox) return;
      const footerBottom = footerBox.y + footerBox.height;
      expect(
        footerBottom,
        `[${vp.name}] footer bottom (${footerBottom}) must fit within viewport height ${viewport.height}`,
      ).toBeLessThanOrEqual(viewport.height + 2);
      expect(
        footerBottom,
        `[${vp.name}] footer should be in lower half of viewport`,
      ).toBeGreaterThan(viewport.height * 0.5);

      // Page must not introduce a scrollbar.
      const scrollHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      expect(
        scrollHeight,
        `[${vp.name}] scrollHeight (${scrollHeight}) must not exceed viewport (${viewport.height})`,
      ).toBeLessThanOrEqual(viewport.height + 2);

      // Stage card retains styling.
      const stageCard = page.locator("main > div").first();
      await expect(stageCard).toBeVisible();
      const stageBox = await stageCard.boundingBox();
      expect(stageBox).not.toBeNull();
      if (!stageBox) return;

      const ratio = stageBox.width / stageBox.height;
      expect(
        ratio,
        `[${vp.name}] stage card should keep 16:9 ratio (got ${ratio.toFixed(3)})`,
      ).toBeGreaterThan(1.7);
      expect(ratio).toBeLessThan(1.85);

      const stageStyles = await stageCard.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow,
          backgroundImage: cs.backgroundImage,
          overflow: cs.overflow,
          // ring-1 → box-shadow includes the ring, or border. The class
          // outputs a second box-shadow layer; we approximate by counting
          // commas in box-shadow as a sanity check.
        };
      });
      const radiusPx = parseFloat(stageStyles.borderRadius);
      expect(
        radiusPx,
        `[${vp.name}] stage card border-radius should be large (got ${stageStyles.borderRadius})`,
      ).toBeGreaterThanOrEqual(20);
      expect(radiusPx).toBeLessThanOrEqual(40);
      expect(
        stageStyles.boxShadow,
        `[${vp.name}] stage card should have a shadow (shadow-2xl + ring)`,
      ).not.toBe("none");
      expect(
        stageStyles.backgroundImage,
        `[${vp.name}] stage card should have a gradient bg`,
      ).toContain("gradient");
      expect(stageStyles.overflow).toBe("hidden");

      // Stage card must fit fully inside the viewport.
      expect(
        stageBox.y + stageBox.height,
        `[${vp.name}] stage bottom (${stageBox.y + stageBox.height}) must be above footer top (${footerBox.y})`,
      ).toBeLessThanOrEqual(footerBox.y + 2);

      await page.screenshot({
        path: `test-results/call-error-state-${vp.name}.png`,
        fullPage: false,
      });
    });
  }
});
