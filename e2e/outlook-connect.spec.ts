import { expect, test } from "@playwright/test";

import { AMY, BEN, signIn } from "./support/sign-in.ts";
import { MicrosoftMock } from "./support/microsoft-mock.ts";

/**
 * Connect / disconnect an Outlook (personal Microsoft account) Mailbox Link
 * (spec #280, issue #283 — "Microsoft connect"). Syncing an Outlook inbox is a
 * later slice; this covers only the OAuth pipe and the Settings UI.
 *
 * `MICROSOFT_OAUTH_CLIENT_ID` is set for the whole run in `playwright.config.ts`,
 * so the "Connect Outlook" button is always available here. The Gmail allowlist
 * is not consulted for Microsoft, so Amy (unlisted) can connect Outlook just as
 * Ben (listed) can.
 */

let mock: MicrosoftMock;

test.beforeAll(async () => {
  mock = new MicrosoftMock();
  await mock.start();
});

test.afterAll(async () => {
  await mock.stop();
});

test.beforeEach(() => {
  mock.reset();
});

/** Leaves the account disconnected for the next test/run, same discipline email-sync.spec.ts uses. */
test.afterEach(async ({ page }) => {
  await page.goto("/booking-buddy/settings");
  await expect(page.getByRole("heading", { name: "Sync from Email" })).toBeVisible();

  const disconnect = page.getByRole("button", { name: "Disconnect" });
  if (await disconnect.isVisible()) {
    await disconnect.click();
    await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  }
});

test("a non-allowlisted User can connect Outlook and see it named as the provider", async ({ page }) => {
  mock.registerAccount({
    email: "amy@hotmail.com",
    accessToken: "ms-access-token",
    refreshToken: "ms-refresh-token",
  });

  await signIn(page, AMY, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Outlook" }).click();

  await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");
  await expect(page.getByText("Connected as amy@hotmail.com via Outlook")).toBeVisible();

  // Survives a fresh read, not just the optimistic redirect state.
  await page.reload();
  await expect(page.getByText("Connected as amy@hotmail.com via Outlook")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
});

test("connecting Outlook replaces an existing link and disconnecting clears it", async ({ page }) => {
  mock.registerAccount({
    email: "ben@outlook.com",
    accessToken: "ms-access-token",
    refreshToken: "ms-refresh-token",
  });

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Outlook" }).click();
  await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");
  await expect(page.getByText("Connected as ben@outlook.com via Outlook")).toBeVisible();

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  await expect(page.getByText("Connected as", { exact: false })).toHaveCount(0);
});

test("a failed Microsoft token exchange reports it honestly, without creating a Mailbox Link", async ({ page }) => {
  mock.registerTokenFailure("unreachable");

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Outlook" }).click();

  await page.waitForURL((url) => url.searchParams.get("error") === "mailbox_connect_failed");
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't connect that mailbox" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
});

test("the unified callback route rejects a state cookie mismatch", async ({ page }) => {
  await signIn(page, BEN, "/booking-buddy/settings");

  // No OAuth flow was started, so there's no state cookie to match — hitting
  // the callback by hand must bounce, not connect anything.
  await page.goto("/booking-buddy/settings/mailbox-callback?code=abc&state=microsoft:forged");
  await page.waitForURL((url) => url.searchParams.get("error") === "mailbox_connect_failed");
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  await expect(page.getByText("Connected as", { exact: false })).toHaveCount(0);
});
