import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { GmailMock } from "./support/gmail-mock.ts";
import { defineSyncFromEmailScenarios } from "./support/sync-from-email-scenarios.ts";
import { disconnectMailbox } from "./support/db-reset.ts";

/**
 * Connect / disconnect Gmail (issue #62), and the Gmail run of the shared
 * "Sync from Email" scenario set (`support/sync-from-email-scenarios.ts`,
 * which the Outlook suite runs too — spec #280).
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

/** Leaves Ben disconnected for the next test/run — straight at Postgres, so it
 * doesn't race the streamed Settings route under parallel load. */
test.afterEach(async ({ accounts }) => {
  await disconnectMailbox({ email: accounts.ben.email, password: accounts.password });
});

test("a non-allowlisted User sees the section but no Connect Gmail button", async ({ page, accounts }) => {
  await signIn(page, accounts.amy.email, "/booking-buddy/settings");

  await expect(page.getByRole("heading", { name: "Sync from Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toHaveCount(0);
  // The Outlook option isn't allowlist-gated (spec #280), and it's configured
  // for this run — so the section is present and usable, not an invite note.
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
});

test("an allowlisted User sees both connect options, with no Mailbox Link connected yet", async ({ page, accounts }) => {
  await signIn(page, accounts.ben.email, "/booking-buddy/settings");

  await expect(page.getByRole("heading", { name: "Sync from Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
});

test("connecting runs the real OAuth redirect and stores the Mailbox Link", async ({ page, accounts }) => {
  mock.registerAccount({
    email: "ben.pickleball@gmail.com",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  });

  await signIn(page, accounts.ben.email, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();

  await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");
  await expect(page.getByText("Connected as ben.pickleball@gmail.com")).toBeVisible();

  // Not just the optimistic redirect state — it survives a fresh read.
  await page.reload();
  await expect(page.getByText("Connected as ben.pickleball@gmail.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
});

test("disconnecting removes the Mailbox Link", async ({ page, accounts }) => {
  mock.registerAccount({
    email: "ben.pickleball@gmail.com",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  });

  await signIn(page, accounts.ben.email, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");

  // Disconnect is behind a confirm dialog; the trigger and the confirm button
  // share the accessible name, so the confirm click is scoped to the dialog.
  await page.getByRole("button", { name: "Disconnect" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Disconnect" })
    .click();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  await expect(page.getByText("Connected as", { exact: false })).toHaveCount(0);
});

test("a failed token exchange reports it honestly, without creating a Mailbox Link", async ({ page, accounts }) => {
  mock.registerTokenFailure("unreachable");

  await signIn(page, accounts.ben.email, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();

  await page.waitForURL((url) => url.searchParams.get("error") === "mailbox_connect_failed");
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't connect that mailbox" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
});

defineSyncFromEmailScenarios({
  label: "Gmail",
  // Gmail is allowlist-gated, and every worker's Ben is on EMAIL_SYNC_ALLOWLIST.
  resolveUser: (accounts) => accounts.ben.email,
  account: {
    email: "ben.pickleball@gmail.com",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  },
  connectButtonName: "Connect Gmail",
  reconnectButtonName: "Reconnect Gmail",
  reconnectPromptText: "Google needs you to reconnect Gmail before syncing again.",
  settingsExpiredText: "Google needs you to reconnect",
  getMock: () => mock,
});
