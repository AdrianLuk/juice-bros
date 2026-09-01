import { expect, test } from "./support/accounts.ts";
import { signIn } from "./support/sign-in.ts";
import { MicrosoftMock } from "./support/microsoft-mock.ts";
import { defineSyncFromEmailScenarios } from "./support/sync-from-email-scenarios.ts";

/**
 * Everything Outlook (personal Microsoft account) — the OAuth pipe and Settings
 * UI (spec #280, issue #283), plus the Outlook run of the shared "Sync from
 * Email" scenario set (`defineSyncFromEmailScenarios` at the bottom — the same
 * journeys `email-sync.spec.ts` runs for Gmail, against `MicrosoftMock`'s Graph
 * endpoints).
 *
 * Both halves live in one file because `MicrosoftMock` binds a fixed port
 * (5604) — split across two spec files, `workers > 1` would land them on
 * different workers and the second `listen()` would EADDRINUSE.
 *
 * `MICROSOFT_OAUTH_CLIENT_ID` is set for the whole run in `playwright.config.ts`,
 * so the "Connect Outlook" button is always available. The Gmail allowlist is
 * not consulted for Microsoft, so Amy (never allowlisted) can connect Outlook
 * just as Ben can.
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

test("a non-allowlisted User can connect Outlook and see it named as the provider", async ({ page, accounts }) => {
  mock.registerAccount({
    email: "amy@hotmail.com",
    accessToken: "ms-access-token",
    refreshToken: "ms-refresh-token",
  });

  await signIn(page, accounts.amy.email, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Outlook" }).click();

  await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");
  await expect(page.getByText("Connected as amy@hotmail.com via Outlook")).toBeVisible();

  // Survives a fresh read, not just the optimistic redirect state.
  await page.reload();
  await expect(page.getByText("Connected as amy@hotmail.com via Outlook")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
});

test("connecting Outlook replaces an existing link and disconnecting clears it", async ({ page, accounts }) => {
  mock.registerAccount({
    email: "ben@outlook.com",
    accessToken: "ms-access-token",
    refreshToken: "ms-refresh-token",
  });

  await signIn(page, accounts.ben.email, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Outlook" }).click();
  await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");
  await expect(page.getByText("Connected as ben@outlook.com via Outlook")).toBeVisible();

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  await expect(page.getByText("Connected as", { exact: false })).toHaveCount(0);
});

test("a failed Microsoft token exchange reports it honestly, without creating a Mailbox Link", async ({ page, accounts }) => {
  mock.registerTokenFailure("unreachable");

  await signIn(page, accounts.ben.email, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Outlook" }).click();

  await page.waitForURL((url) => url.searchParams.get("error") === "mailbox_connect_failed");
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't connect that mailbox" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
});

test("the unified callback route rejects a state cookie mismatch", async ({ page, accounts }) => {
  await signIn(page, accounts.ben.email, "/booking-buddy/settings");

  // No OAuth flow was started, so there's no state cookie to match — hitting
  // the callback by hand must bounce, not connect anything.
  await page.goto("/booking-buddy/settings/mailbox-callback?code=abc&state=microsoft:forged");
  await page.waitForURL((url) => url.searchParams.get("error") === "mailbox_connect_failed");
  await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeVisible();
  await expect(page.getByText("Connected as", { exact: false })).toHaveCount(0);
});

// The Outlook run of the shared "Sync from Email" journeys. Signs in as Amy,
// who is never on EMAIL_SYNC_ALLOWLIST — proving an Outlook link needs no
// allowlist, unlike Gmail. Reuses the single `mock` above.
defineSyncFromEmailScenarios({
  label: "Outlook",
  resolveUser: (accounts) => accounts.amy.email,
  account: {
    email: "amy@hotmail.com",
    accessToken: "ms-access-token",
    refreshToken: "ms-refresh-token",
  },
  connectButtonName: "Connect Outlook",
  reconnectButtonName: "Reconnect Outlook",
  reconnectPromptText: "Microsoft needs you to reconnect Outlook before syncing again.",
  settingsExpiredText: "Microsoft needs you to reconnect",
  getMock: () => mock,
});
