import { test, expect } from "@playwright/test";

test("landing page has updated title and favicon", async ({ page, request }) => {
  await page.goto("/");

  const title = await page.title();
  console.log(`Document title: "${title}"`);
  expect(title).toBe("Sondra. Human Real Conversation");

  const faviconHref = await page.evaluate(() => {
    const link = document.querySelector('link[rel="icon"]');
    return link instanceof HTMLLinkElement ? link.href : null;
  });
  console.log(`Favicon href: ${faviconHref}`);
  expect(faviconHref).toBe("http://localhost:5174/icon.png");

  const faviconResponse = await request.get(faviconHref as string);
  console.log(`Favicon fetch status: ${faviconResponse.status()}`);
  console.log(`Favicon content-type: ${faviconResponse.headers()["content-type"]}`);
  expect(faviconResponse.status()).toBe(200);
  expect(faviconResponse.headers()["content-type"]).toBe("image/png");

  await page.screenshot({
    path: "screenshots/favicon-title-update.png",
    fullPage: true,
  });
});
