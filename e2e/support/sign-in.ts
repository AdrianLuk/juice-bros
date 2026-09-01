import type { Cookie, Page } from "@playwright/test";

/**
 * The local test accounts, documented in
 * booking-buddy/docs/local-test-accounts.md. Local-only: these addresses have
 * no inbox and the password is public on purpose.
 */
export const TEST_PASSWORD = "pickleball123";

export const AMY = "amyace@example.com";
export const BEN = "benbackhand@example.com";
export const BEN2 = "benbackhand2@example.com";

/**
 * Session cookies from the first real form sign-in of each account, kept for
 * the life of the Playwright worker (with `workers: 1`, the whole run).
 *
 * The first `signIn` for an account still drives the real form — that flow is
 * part of what these tests cover, and a hand-built cookie would drift from
 * whatever @supabase/ssr actually writes. Every later `signIn` for the same
 * account replants those cookies and does one `goto` instead, turning a
 * ~3s navigation + auth round trip into near-nothing.
 *
 * Safe because @supabase/ssr only refreshes a session once its access token
 * has expired (`jwt_expiry`, 1h locally) — a full suite run finishes well
 * inside that window, so the cached cookies are never rotated out from under a
 * later test. If a run somehow outlives the token, the fast path notices it
 * landed back on `/sign-in` and falls back to the real form.
 */
const sessionCookies = new Map<string, Cookie[]>();

async function formSignIn(page: Page, email: string, next: string) {
  await page.goto(`/booking-buddy/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

/**
 * Signs in as one of the seeded accounts, password mode.
 *
 * Real form on the first call per account; a cookie replant on every call
 * after that (see `sessionCookies`).
 */
export async function signIn(page: Page, email: string, next = "/booking-buddy") {
  const cached = sessionCookies.get(email);
  if (cached) {
    await page.context().addCookies(cached);
    await page.goto(next);
    if (!new URL(page.url()).pathname.includes("/sign-in")) return;
    // The cached session went stale mid-run — drop it and sign in for real.
    sessionCookies.delete(email);
  }

  await formSignIn(page, email, next);
  sessionCookies.set(email, await page.context().cookies());
}

/**
 * Signs up a brand-new account through the real form, password mode — for
 * specs that need a fresh, throwaway User rather than one of the fixed
 * seeded accounts above (e.g. onboarding.spec.ts, where the whole point is a
 * zero-Facility account with no risk of another suite's Facility-count
 * drift). Never deleted afterward: there's no "delete account" feature to
 * reuse, and RLS scopes every assertion to the caller's own rows regardless
 * of how many other accounts exist.
 *
 * Not cookie-cached the way `signIn` is: every caller uses a unique email
 * exactly once, so there's nothing to reuse.
 *
 * The form's own success state shows a "confirm your email" message — copy
 * aimed at a real deploy, where confirmation is required. Locally,
 * `supabase/config.toml` has `enable_confirmations = false`, so the Server
 * Action already has a session by the time it returns; the sign-in page's
 * own "already signed in? redirect" guard (`SignInPage`) reruns as part of
 * the action's route refresh and sends the browser straight to `next` before
 * that message ever has a User to show it to. Waiting for the URL to leave
 * `/sign-in` — same as `signIn` above — is what actually observes that,
 * rather than a message that a real deploy's User would see but this local
 * flow never does.
 */
export async function signUp(page: Page, email: string, next = "/booking-buddy") {
  await page.goto(`/booking-buddy/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "Create an account with a password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}
