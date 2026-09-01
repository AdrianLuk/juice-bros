import { test } from "@playwright/test";

import { AMY } from "./support/sign-in.ts";
import { MicrosoftMock } from "./support/microsoft-mock.ts";
import { defineSyncFromEmailScenarios } from "./support/sync-from-email-scenarios.ts";

/**
 * The Outlook run of the shared "Sync from Email" scenario set — the same
 * journeys `email-sync.spec.ts` runs for Gmail, against `MicrosoftMock`'s
 * Graph endpoints instead (spec #280 — "behaves identically to the Gmail
 * path"). The OAuth-pipe-only connect/disconnect coverage stays in
 * `outlook-connect.spec.ts`.
 *
 * Signs in as Amy, who is *not* in `EMAIL_SYNC_ALLOWLIST` — proving an Outlook
 * link needs no allowlist, unlike Gmail.
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

defineSyncFromEmailScenarios({
  label: "Outlook",
  user: AMY,
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
