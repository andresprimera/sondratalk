import { test, expect } from "@playwright/test";

// The app must be dark by default the instant the page loads — including cold
// loads where a user arrives at beta.sondratalk.com from sondratalk.com. The
// pre-paint bootstrap script in index.html sets the `dark` class on <html>
// before next-themes mounts, so there's no flash of the light :root theme.
//
// Each test blocks the app module (/src/main.tsx) so next-themes never mounts.
// That isolates the inline bootstrap: if <html> ends up correct, the pre-paint
// script — not React — produced it.

test("cold load (no stored theme) is dark before the app bundle runs", async ({
  page,
}) => {
  await page.route("**/src/main.tsx*", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("bootstrap respects an explicit light theme choice", async ({ page }) => {
  await page.route("**/src/main.tsx*", (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("theme", "light");
  });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("bootstrap respects an explicit dark theme choice", async ({ page }) => {
  await page.route("**/src/main.tsx*", (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
});
