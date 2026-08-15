import { test, expect } from "@playwright/test";

// The total-user count — the old "N founding members · Applications open" line
// under the hero CTAs — is admin-only information now. It must not appear
// anywhere on the PUBLIC landing page, where any visitor (logged out or a
// regular user) could read it. This guards against re-introducing a member
// count in the hero.

test("public landing hero shows no total-user / founding-members count", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Someone is waiting/i }),
  ).toBeVisible();

  const body = page.locator("body");
  await expect(body).not.toContainText(/founding members/i);
  await expect(body).not.toContainText(/applications open/i);
  await expect(body).not.toContainText(/\d+\s+founding member/i);
});
