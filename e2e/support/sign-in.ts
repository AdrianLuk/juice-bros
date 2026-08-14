import type { Page } from "@playwright/test";

/**
 * The local test accounts, documented in
 * booking-buddy/docs/local-test-accounts.md. Local-only: these addresses have
 * no inbox and the password is public on purpose.
 */
export const TEST_PASSWORD = "pickleball123";

export const AMY = "amyace@example.com";
export const BEN = "benbackhand@example.com";

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
