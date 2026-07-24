import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

// Repo-root /screenshots dir (this spec lives at <repo>/e2e/tests/).
const SCREENSHOT_DIR = path.resolve(__dirname, "../../screenshots");

// Proves the responsive rewrite of /call/:meetingId (the Connecting state,
// which shares the exact `remoteTileClass` / `localTileClass` constants with
// the live VideoStage):
//
//   A) Mobile portrait (<640px, below `sm`): the two feeds STACK vertically as
//      two equal full-width tiles — local sits at/below the remote bottom, no
//      overlap, and the local tile is NOT a small corner PiP.
//   B) Desktop (>=640px, `sm:`+): UNCHANGED — remote fills the 16:9 stage and
//      the local feed is a small picture-in-picture overlapping the
//      bottom-right corner (local box inside the remote box, width < 35% of it).
//
// We reach the Connecting state by mocking the meeting fetch (200) and holding
// the call-token request pending forever so `ConnectingPlaceholder` renders.

const EMAIL = `call-resp-${Date.now()}@example.com`;
const PASSWORD = "Sup3rSecret!23";
const NAME = "Responsive Tester";
const MEETING_ID = "507f1f77bcf86cd799439011"; // ObjectId-shaped so the route resolves

const MEETING_BODY = {
  id: MEETING_ID,
  participants: ["a", "b"],
  initiatorId: "a",
  scheduledAt: "2026-06-17T15:00:00.000Z",
  expiresAt: "2026-06-17T17:00:00.000Z",
  cancelled: false,
  instant: true,
  createdAt: "2026-06-17T15:00:00.000Z",
  updatedAt: "2026-06-17T15:00:00.000Z",
  peer: { id: "b", firstName: "Marta" },
};

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
  await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 15_000 });
}

// Mock the meeting fetch (200) and hold the token request pending so the page
// settles into the Connecting placeholder (which renders the responsive tiles).
async function installCallMocks(page: Page): Promise<void> {
  await page.route(`**/api/meetings/${MEETING_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MEETING_BODY),
    }),
  );
  // Intentionally never resolve — keeps the token query loading so the
  // ConnectingPlaceholder stays mounted (a fulfilled error would swap to the
  // error placeholder instead).
  await page.route("**/api/calls/token", () => {
    /* hold pending forever */
  });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function tileBoxes(page: Page): Promise<{ remote: Box; local: Box }> {
  const remoteTile = page.locator("main > div > div:nth-child(1)");
  const localTile = page.locator("main > div > div:nth-child(2)");
  await expect(remoteTile).toBeVisible();
  await expect(localTile).toBeVisible();
  const remote = await remoteTile.boundingBox();
  const local = await localTile.boundingBox();
  if (!remote || !local) throw new Error("tile bounding boxes unavailable");
  return { remote, local };
}

test.describe.configure({ mode: "serial" });

test.describe("responsive call layout (connecting state)", () => {
  let sink: RuntimeSink;

  test.beforeEach(async ({ page }) => {
    sink = attachDiagnostics(page);
  });

  test("mobile portrait 390x844: feeds stack vertically (no PiP overlap)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installCallMocks(page);
    await signup(page);

    await page.goto(`/call/${MEETING_ID}`);

    // Connecting placeholder confirms we're in the right state.
    await expect(page.getByText("Connecting to Marta…")).toBeVisible({
      timeout: 15_000,
    });
    // Below `sm`, the control's text label is hidden (icon + aria-label only)
    // to fix control-row overflow on narrow phones — check via aria-label.
    await expect(page.getByLabel("Camera")).toBeVisible();

    // Measure the GENUINE tiles before any visual injection.
    const { remote, local } = await tileBoxes(page);

    // --- STACKING: local tile starts at/below the remote tile's bottom ---
    const remoteBottom = remote.y + remote.height;
    const tolerance = 8; // gap-3 + anti-aliasing slack
    expect(
      local.y,
      `local tile top (${local.y.toFixed(1)}) should be at/below remote bottom (${remoteBottom.toFixed(1)}) — proving vertical stacking, not overlap`,
    ).toBeGreaterThanOrEqual(remoteBottom - tolerance);

    // No vertical overlap between the two tiles.
    const overlap = remoteBottom - local.y;
    expect(
      overlap,
      `tiles should not overlap vertically (overlap=${overlap.toFixed(1)}px)`,
    ).toBeLessThanOrEqual(tolerance);

    // --- Local tile is full-width (NOT a small corner PiP) ---
    const widthRatio = local.width / remote.width;
    expect(
      widthRatio,
      `local tile width (${local.width.toFixed(1)}) should ~match remote width (${remote.width.toFixed(1)}) — local=${(widthRatio * 100).toFixed(1)}% of remote`,
    ).toBeGreaterThan(0.9);
    expect(widthRatio).toBeLessThan(1.1);

    // Optional visual overlay to make the two feeds obvious in the screenshot.
    // Geometry was already measured above on the un-injected tiles.
    await page.evaluate(() => {
      const stage = document.querySelector("main > div");
      const tiles = stage?.querySelectorAll(":scope > div");
      const labels = ["OTHER PERSON", "YOU"];
      const colors = ["rgba(37,99,235,0.18)", "rgba(220,38,38,0.18)"];
      tiles?.forEach((tile, i) => {
        if (i > 1) return;
        const badge = document.createElement("div");
        badge.textContent = labels[i];
        badge.style.cssText = `position:absolute;top:8px;left:8px;z-index:50;pointer-events:none;background:${colors[i]};color:#fff;font:700 12px sans-serif;padding:2px 8px;border-radius:6px;border:2px solid rgba(255,255,255,0.7);`;
        (tile as HTMLElement).appendChild(badge);
      });
    });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "responsive-call-mobile-stacked.png"),
      fullPage: false,
    });

    expect(sink.pageErrors, sink.pageErrors.join("\n")).toEqual([]);
    expect(sink.apiFailures, sink.apiFailures.join("\n")).toEqual([]);
  });

  test("desktop 1280x800: local feed is a corner PiP overlay (original behavior)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installCallMocks(page);

    // Already signed up in the first test (serial). Log in via UI.
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });

    await page.goto(`/call/${MEETING_ID}`);

    await expect(page.getByText("Connecting to Marta…")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Camera off")).toBeVisible();

    const { remote, local } = await tileBoxes(page);

    // --- PiP OVERLAY: local box sits INSIDE the remote stage box ---
    const pad = 4; // anti-aliasing slack
    expect(
      local.x,
      `local.x (${local.x.toFixed(1)}) should be inside remote box left (${remote.x.toFixed(1)})`,
    ).toBeGreaterThanOrEqual(remote.x - pad);
    expect(
      local.y,
      `local.y (${local.y.toFixed(1)}) should be inside remote box top (${remote.y.toFixed(1)})`,
    ).toBeGreaterThanOrEqual(remote.y - pad);
    expect(
      local.x + local.width,
      `local right edge should be inside remote right edge`,
    ).toBeLessThanOrEqual(remote.x + remote.width + pad);
    expect(
      local.y + local.height,
      `local bottom edge should be inside remote bottom edge`,
    ).toBeLessThanOrEqual(remote.y + remote.height + pad);

    // --- It's a SMALL PiP: width < 35% of the remote tile ---
    const widthRatio = local.width / remote.width;
    expect(
      widthRatio,
      `local PiP width (${local.width.toFixed(1)}) should be < 35% of remote width (${remote.width.toFixed(1)}) — got ${(widthRatio * 100).toFixed(1)}%`,
    ).toBeLessThan(0.35);

    // --- And it's anchored bottom-right (overlap, not stacked) ---
    expect(
      local.x,
      `local PiP should sit in the right half of the stage`,
    ).toBeGreaterThan(remote.x + remote.width * 0.5);
    expect(
      local.y,
      `local PiP should sit in the lower half of the stage`,
    ).toBeGreaterThan(remote.y + remote.height * 0.5);

    // Optional visual overlay (measured already above on genuine tiles).
    await page.evaluate(() => {
      const stage = document.querySelector("main > div");
      const tiles = stage?.querySelectorAll(":scope > div");
      const labels = ["OTHER PERSON", "YOU"];
      const colors = ["rgba(37,99,235,0.18)", "rgba(220,38,38,0.18)"];
      tiles?.forEach((tile, i) => {
        if (i > 1) return;
        const badge = document.createElement("div");
        badge.textContent = labels[i];
        badge.style.cssText = `position:absolute;top:8px;left:8px;z-index:50;pointer-events:none;background:${colors[i]};color:#fff;font:700 12px sans-serif;padding:2px 8px;border-radius:6px;border:2px solid rgba(255,255,255,0.7);`;
        (tile as HTMLElement).appendChild(badge);
      });
    });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "responsive-call-desktop-pip.png"),
      fullPage: false,
    });

    expect(sink.pageErrors, sink.pageErrors.join("\n")).toEqual([]);
    expect(sink.apiFailures, sink.apiFailures.join("\n")).toEqual([]);
  });
});
