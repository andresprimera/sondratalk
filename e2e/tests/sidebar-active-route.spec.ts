import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

// Verifies the sidebar nav highlights the active route via `isActive`
// (data-active on SidebarMenuButton). The /dashboard root item uses exact
// matching (`end: true`) so it only highlights on the dashboard index, not
// on child routes.

const EMAIL = "andresprimera@gmail.com";
const PASSWORD = "Test@123";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../screenshots");

function attachDiagnostics(page: Page, sink: string[]): void {
  page.on("pageerror", (err) => sink.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") sink.push(`console.error: ${msg.text()}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/api/") && res.status() >= 400) {
      sink.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });
}

async function loginViaUi(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 15_000 });
}

// The active SidebarMenuButton renders the anchor with a `data-active`
// attribute (base-ui sets it from `state.active`; its value is the empty
// string when active). Inactive items have no `data-active` attribute at all.
async function expectActive(page: Page, name: string): Promise<void> {
  const link = page.getByRole("link", { name, exact: true });
  await expect(link).toBeVisible();
  // Auto-retries until React has applied the active state.
  await expect(link).toHaveAttribute("data-active", /.*/);
}

async function expectInactive(page: Page, name: string): Promise<void> {
  const link = page.getByRole("link", { name, exact: true });
  await expect(link).toBeVisible();
  await expect(link).not.toHaveAttribute("data-active", /.*/);
}

test("sidebar highlights the active route and exact-matches the dashboard root", async ({
  page,
}) => {
  const diagnostics: string[] = [];
  attachDiagnostics(page, diagnostics);

  await loginViaUi(page);

  // The login may land on /dashboard or a child; force the index.
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard\/?(\?|$)/);
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();

  // 1) On /dashboard, only the Dashboard item is active.
  await expectActive(page, "Dashboard");
  await expectInactive(page, "Settings");
  await expectInactive(page, "Users");

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "sidebar-active-dashboard.png"),
    fullPage: false,
  });

  // 2) Navigate to a child route by clicking the nav item.
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.waitForURL(/\/dashboard\/settings/);

  // Settings becomes active; Dashboard de-highlights (exact-match fix).
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectActive(page, "Settings");
  await expectInactive(page, "Dashboard");

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "sidebar-active-settings.png"),
    fullPage: false,
  });

  // Ignore a pre-existing, out-of-scope base-ui `nativeButton` warning that
  // originates from pages/dashboard.tsx (not the sidebar under test).
  const relevant = diagnostics.filter(
    (d) => !d.includes("nativeButton") && !d.includes("native <button>"),
  );
  expect(relevant, relevant.join("\n")).toEqual([]);
});
