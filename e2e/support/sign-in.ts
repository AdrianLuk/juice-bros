import type { Cookie, Page } from "@playwright/test";

/**
 * The local test account password, documented in
 * booking-buddy/docs/local-test-accounts.md. Local-only and public on purpose.
 * Account emails/handles come from the `accounts` fixture (`accounts.ts`), not
 * from here.
 */
export const TEST_PASSWORD = "pickleball123";

/**
 * Session cookies from a recent real form sign-in of each account, reused
 * within one Playwright worker.
 *
 * The first `signIn` for an account drives the real form — that flow is part
 * of what these tests cover, and a hand-built cookie would drift from whatever
 * @supabase/ssr actually writes. Later calls replant those cookies and do one
 * `goto` instead, turning a ~3s navigation + auth round trip into near-nothing.
 *
 * Re-authed once an entry is older than `MAX_AGE_MS`: with several workers
 * hammering one server, a mid-test token refresh can rotate the refresh token
 * and strand a long-lived cached copy, so a later replant lands a dead
 * session. Keeping entries fresh sidesteps that; the `/sign-in` bounce check
 * below is the backstop.
 */
const sessionCookies = new Map<string, { cookies: Cookie[]; at: number }>();
const MAX_AGE_MS = 90_000;

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
  if (cached && Date.now() - cached.at < MAX_AGE_MS) {
    await page.context().addCookies(cached.cookies);
    await page.goto(next);
    if (!new URL(page.url()).pathname.includes("/sign-in")) return;
    // The cached session went stale mid-run — drop it and sign in for real.
    sessionCookies.delete(email);
  }

  await formSignIn(page, email, next);
  sessionCookies.set(email, { cookies: await page.context().cookies(), at: Date.now() });
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
