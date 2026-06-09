import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// Smoke test for the per-session refresh-token refactor: each login/signup
// now mints its own session entry (with a `jti` JWT claim) on the user
// document, so two browsers logged into the same account must not evict
// each other.

const UNIQUE_EMAIL = `sondra-test-${Date.now()}@example.com`;
const PASSWORD = "Sup3rSecret!23";
const NAME = "Sondra Tester";

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload {
  const middle = token.split(".")[1];
  if (!middle) throw new Error("Token has no payload segment");
  // base64url -> base64
  const b64 = middle.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  // atob is available in node 18+ via global
  const json = Buffer.from(padded, "base64").toString("utf-8");
  return JSON.parse(json) as JwtPayload;
}

async function readTokensFromContext(page: Page): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  return await page.evaluate(() => ({
    accessToken: window.localStorage.getItem("accessToken"),
    refreshToken: window.localStorage.getItem("refreshToken"),
  }));
}

function attachDiagnostics(page: Page, label: string, sink: string[]) {
  page.on("pageerror", (err) => {
    sink.push(`[${label}] pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      sink.push(`[${label}] console.error: ${msg.text()}`);
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/api/") && res.status() >= 400) {
      sink.push(`[${label}] ${res.status()} ${res.request().method()} ${url}`);
    }
  });
}

async function signupViaUi(page: Page): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Full Name").fill(NAME);
  await page.getByLabel("Email").fill(UNIQUE_EMAIL);
  // Two PasswordInputs share the type, distinguish by label.
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Apply" }).click();
  // Signup form navigates to /onboarding on success.
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
}

async function loginViaUi(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(UNIQUE_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 15_000 });
}

async function logoutViaApi(page: Page): Promise<number> {
  // Hit /api/auth/logout directly with the stored access token so we can
  // assert the response code without depending on the dropdown UI being
  // open.
  return await page.evaluate(async () => {
    const token = window.localStorage.getItem("accessToken");
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    // mirror the FE clearTokens() behavior so the AuthProvider on next
    // reload treats this context as logged out.
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("refreshToken");
    return res.status;
  });
}

async function fetchMeStatus(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const token = window.localStorage.getItem("accessToken");
    const res = await fetch("/api/users/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.status;
  });
}

// We share state across tests deliberately: signup must precede login,
// and the multi-session test reuses the same account.
test.describe.configure({ mode: "serial" });

test.describe("auth: per-session refresh tokens", () => {
  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let pageA: Page;
  let pageB: Page;
  const errors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext();
    ctxB = await browser.newContext();
    pageA = await ctxA.newPage();
    pageB = await ctxB.newPage();
    attachDiagnostics(pageA, "A", errors);
    attachDiagnostics(pageB, "B", errors);
  });

  test.afterAll(async () => {
    await ctxA.close();
    await ctxB.close();
  });

  test("1. signup lands the new user in the authenticated app", async () => {
    await signupViaUi(pageA);
    expect(pageA.url()).toContain("/onboarding");

    const tokens = await readTokensFromContext(pageA);
    expect(tokens.accessToken, "access token stored after signup").toBeTruthy();
    expect(tokens.refreshToken, "refresh token stored after signup").toBeTruthy();
  });

  test("2. JWT payload includes a UUID-shaped jti claim", async () => {
    const tokens = await readTokensFromContext(pageA);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const accessPayload = decodeJwtPayload(tokens.accessToken!);
    const refreshPayload = decodeJwtPayload(tokens.refreshToken!);

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(accessPayload.jti, "access token must carry jti").toBeTruthy();
    expect(accessPayload.jti).toMatch(uuidRe);

    expect(refreshPayload.jti, "refresh token must carry jti").toBeTruthy();
    expect(refreshPayload.jti).toMatch(uuidRe);

    // The two tokens minted by the same login should share a jti.
    expect(refreshPayload.jti).toBe(accessPayload.jti);
  });

  test("3. logout then re-login on the same context still works", async () => {
    // Use the in-app logout endpoint to terminate the signup session,
    // then re-authenticate via /login.
    const logoutStatus = await logoutViaApi(pageA);
    expect(logoutStatus, "/api/auth/logout should return 204").toBe(204);

    await loginViaUi(pageA);
    expect(pageA.url()).toContain("/dashboard");

    const tokens = await readTokensFromContext(pageA);
    expect(tokens.accessToken).toBeTruthy();
    const payload = decodeJwtPayload(tokens.accessToken!);
    expect(payload.email).toBe(UNIQUE_EMAIL);
  });

  test("4. logging the same user in on a second context does NOT evict context A", async () => {
    // Context A is logged in (carried over from previous test). Now log B in.
    await loginViaUi(pageB);
    expect(pageB.url()).toContain("/dashboard");

    const tokensA = await readTokensFromContext(pageA);
    const tokensB = await readTokensFromContext(pageB);
    expect(tokensA.accessToken).toBeTruthy();
    expect(tokensB.accessToken).toBeTruthy();

    // The two sessions must be distinct (different jti's).
    const jtiA = decodeJwtPayload(tokensA.accessToken!).jti;
    const jtiB = decodeJwtPayload(tokensB.accessToken!).jti;
    expect(jtiA).toBeTruthy();
    expect(jtiB).toBeTruthy();
    expect(jtiA, "each context should have its own jti").not.toBe(jtiB);

    // Move around in A: reload + navigate. If the old token was nuked by
    // B's login, the refresh-on-mount call would 401 and we'd land on
    // /login.
    await pageA.reload();
    await expect(pageA).not.toHaveURL(/\/login/);
    expect(pageA.url()).toContain("/dashboard");

    const meAStatus = await fetchMeStatus(pageA);
    expect(meAStatus, "context A access token should still authenticate").toBe(
      200,
    );

    // Same drill for B.
    await pageB.reload();
    await expect(pageB).not.toHaveURL(/\/login/);
    expect(pageB.url()).toContain("/dashboard");

    const meBStatus = await fetchMeStatus(pageB);
    expect(meBStatus, "context B access token should still authenticate").toBe(
      200,
    );
  });

  test("5. logging out of context A does NOT log out context B", async () => {
    const logoutStatus = await logoutViaApi(pageA);
    expect(logoutStatus).toBe(204);

    // After clearing tokens, navigating to /dashboard in A should bounce
    // to /login (this is the expected, non-regression behavior).
    await pageA.goto("/dashboard");
    await pageA.waitForURL(/\/login/, { timeout: 10_000 });

    // Context B must still be fully usable.
    const meBStatus = await fetchMeStatus(pageB);
    expect(meBStatus, "context B should still be authenticated").toBe(200);

    // Probe B's refresh endpoint directly so we can prove the backend
    // session for B was not evicted.
    const refreshBStatus = await pageB.evaluate(async () => {
      const rt = window.localStorage.getItem("refreshToken");
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: rt
          ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${rt}`,
            }
          : { "Content-Type": "application/json" },
      });
      return res.status;
    });
    expect(
      refreshBStatus,
      "context B refresh endpoint should still succeed after A logs out",
    ).toBe(200);

    await pageB.reload();
    await expect(pageB).not.toHaveURL(/\/login/);
    expect(pageB.url()).toContain("/dashboard");
  });

  test("6. no unexpected runtime/console errors during the flow", async () => {
    // Filter out anything the user wouldn't see as a regression (e.g.
    // expected 401s once we deliberately logged out). We only flag
    // unhandled pageerrors and unexpected /api/ failures.
    const blocking = errors.filter((line) => {
      // 401s after our deliberate logout in test 5 are expected.
      if (/401 .*\/api\/users\/me/.test(line)) return false;
      if (/401 .*\/api\/auth\/refresh/.test(line)) return false;
      // Pre-existing Base UI `nativeButton` warnings on the dashboard
      // page are out of scope for the auth refactor (see <Button> usage
      // inside DashboardPage / AvailabilitySection). Surface in the
      // report as an observation, not a blocker.
      if (/Base UI: A component that acts as a button/.test(line)) return false;
      return true;
    });
    expect(blocking, blocking.join("\n")).toEqual([]);
  });
});
