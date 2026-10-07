import assert from "node:assert/strict";
import test from "node:test";

import {
  decideEmailSyncEntitlement,
  type EntitlementLink,
} from "./email-sync-entitlement.ts";

const ON_LIST = "amyace";
const OFF_LIST = "someoneelse";

function decide(link: EntitlementLink, allowlisted: boolean) {
  return decideEmailSyncEntitlement({
    username: allowlisted ? ON_LIST : OFF_LIST,
    email: "user@example.com",
    allowlistEnv: "amyace",
    link,
  });
}

test("Gmail connect needs the allowlist, whatever else the User has", () => {
  assert.equal(decide(null, true).canConnect.google, true);
  assert.equal(decide(null, false).canConnect.google, false);
  assert.equal(decide({ provider: "microsoft", status: "active" }, false).canConnect.google, false);
});

test("Outlook connect never needs the allowlist", () => {
  assert.equal(decide(null, true).canConnect.microsoft, true);
  assert.equal(decide(null, false).canConnect.microsoft, true);
});

test("no Mailbox Link: sync follows the allowlist and records under google", () => {
  assert.equal(decide(null, true).canSync, true);
  assert.equal(decide(null, false).canSync, false);
  assert.equal(decide(null, true).provider, "google");
  assert.equal(decide(null, false).provider, "google");
});

test("a Gmail link still needs the allowlist to sync", () => {
  for (const status of ["active", "expired"] as const) {
    assert.equal(decide({ provider: "google", status }, true).canSync, true);
    assert.equal(decide({ provider: "google", status }, false).canSync, false);
    assert.equal(decide({ provider: "google", status }, false).provider, "google");
  }
});

test("an Outlook link syncs with or without the allowlist, and records under microsoft", () => {
  for (const status of ["active", "expired"] as const) {
    for (const allowlisted of [true, false]) {
      const entitlement = decide({ provider: "microsoft", status }, allowlisted);
      assert.equal(entitlement.canSync, true);
      assert.equal(entitlement.provider, "microsoft");
    }
  }
});

test("an expired link changes nothing: expiry is the reconnect path, not a revocation", () => {
  for (const provider of ["google", "microsoft"] as const) {
    for (const allowlisted of [true, false]) {
      assert.deepEqual(
        decide({ provider, status: "expired" }, allowlisted),
        decide({ provider, status: "active" }, allowlisted),
      );
    }
  }
});

test("matches the allowlist by account email as well as Username", () => {
  const entitlement = decideEmailSyncEntitlement({
    username: null,
    email: "Amy@Example.com",
    allowlistEnv: "amy@example.com",
    link: null,
  });
  assert.equal(entitlement.canSync, true);
});

test("an unset allowlist fails closed for Gmail but not for an Outlook link", () => {
  const gmail = decideEmailSyncEntitlement({
    username: ON_LIST,
    email: undefined,
    allowlistEnv: undefined,
    link: { provider: "google", status: "active" },
  });
  const outlook = decideEmailSyncEntitlement({
    username: ON_LIST,
    email: undefined,
    allowlistEnv: undefined,
    link: { provider: "microsoft", status: "active" },
  });
  assert.equal(gmail.canSync, false);
  assert.equal(outlook.canSync, true);
});
