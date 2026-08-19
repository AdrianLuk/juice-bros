import type { Page } from "@playwright/test";

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
 * Signs in through the real form, password mode.
 *
 * Not by planting a cookie: the sign-in form is part of what these tests are
 * meant to cover, and a hand-built session cookie would drift from whatever
 * @supabase/ssr actually writes.
 */
export async function signIn(page: Page, email: string, next = "/booking-buddy") {
  await page.goto(`/booking-buddy/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
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
