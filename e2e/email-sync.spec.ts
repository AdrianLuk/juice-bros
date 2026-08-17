import { expect, test } from "@playwright/test";

import { AMY, BEN, signIn } from "./support/sign-in.ts";
import { GmailMock } from "./support/gmail-mock.ts";

/**
 * Connect/disconnect Gmail (issue #62). Only the OAuth pipe — no "Sync from
 * Email" button, candidates, or review screen yet (that's #64).
 *
 * `EMAIL_SYNC_ALLOWLIST` is fixed to `benbackhand` in `playwright.config.ts`,
 * so Ben stands in for an approved User throughout and Amy stands in for an
 * unapproved one — real allowlist config, not a per-test override, mirroring
 * how `GMAIL_API_BASE_URL` is fixed for the whole run rather than per test.
 */

let mock: GmailMock;

test.beforeAll(async () => {
  mock = new GmailMock();
  await mock.start();
});

test.afterAll(async () => {
  await mock.stop();
});

test.beforeEach(() => {
  mock.reset();
});

/** Leaves Ben disconnected for the next test/run, same discipline settings.spec.ts uses for Username. */
test.afterEach(async ({ page }) => {
  await page.goto("/booking-buddy/settings");
  const disconnect = page.getByRole("button", { name: "Disconnect" });
  if (await disconnect.isVisible().catch(() => false)) {
    await disconnect.click();
    await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  }
});

test("a non-allowlisted User never sees the Sync from Email section at all", async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy/settings");

  await expect(page.getByRole("heading", { name: "Sync from Email" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toHaveCount(0);
});

test("an allowlisted User sees the section, with no Mailbox Link connected yet", async ({ page }) => {
  await signIn(page, BEN, "/booking-buddy/settings");

  await expect(page.getByRole("heading", { name: "Sync from Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
});

test("connecting runs the real OAuth redirect and stores the Mailbox Link", async ({ page }) => {
  mock.registerAccount({
    email: "ben.pickleball@gmail.com",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  });

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();

  await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");
  await expect(page.getByText("Connected as ben.pickleball@gmail.com")).toBeVisible();

  // Not just the optimistic redirect state — it survives a fresh read.
  await page.reload();
  await expect(page.getByText("Connected as ben.pickleball@gmail.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
});

test("disconnecting removes the Mailbox Link", async ({ page }) => {
  mock.registerAccount({
    email: "ben.pickleball@gmail.com",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  });

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  await expect(page.getByText("Connected as", { exact: false })).toHaveCount(0);
});

test("a failed token exchange reports it honestly, without creating a Mailbox Link", async ({ page }) => {
  mock.registerTokenFailure("unreachable");

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();

  await page.waitForURL((url) => url.searchParams.get("error") === "gmail_connect_failed");
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't connect Gmail" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
});
