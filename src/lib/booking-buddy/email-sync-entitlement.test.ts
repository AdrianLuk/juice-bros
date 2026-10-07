import assert from "node:assert/strict";
import test from "node:test";

import {
  decideCanConnect,
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
  assert.equal(decide({ provider: "microsoft" }, false).canConnect.google, false);
});

test("Outlook connect never needs the allowlist", () => {
  assert.equal(decide(null, true).canConnect.microsoft, true);
  assert.equal(decide(null, false).canConnect.microsoft, true);
});

test("connect is decided from the allowlist alone, with no Mailbox Link in play", () => {
  const input = { email: undefined, allowlistEnv: "amyace" };
  assert.deepEqual(decideCanConnect({ ...input, username: ON_LIST }), {
    google: true,
    microsoft: true,
  });
  assert.deepEqual(decideCanConnect({ ...input, username: OFF_LIST }), {
    google: false,
    microsoft: true,
  });
});

test("no Mailbox Link: sync follows the allowlist and records under google", () => {
  assert.equal(decide(null, true).canSync, true);
  assert.equal(decide(null, false).canSync, false);
  assert.equal(decide(null, true).provider, "google");
  assert.equal(decide(null, false).provider, "google");
});

test("a Gmail link still needs the allowlist to sync", () => {
  assert.equal(decide({ provider: "google" }, true).canSync, true);
  assert.equal(decide({ provider: "google" }, false).canSync, false);
  assert.equal(decide({ provider: "google" }, false).provider, "google");
});

test("an Outlook link syncs with or without the allowlist, and records under microsoft", () => {
  for (const allowlisted of [true, false]) {
    const entitlement = decide({ provider: "microsoft" }, allowlisted);
    assert.equal(entitlement.canSync, true);
    assert.equal(entitlement.provider, "microsoft");
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
    link: { provider: "google" },
  });
  const outlook = decideEmailSyncEntitlement({
    username: ON_LIST,
    email: undefined,
    allowlistEnv: undefined,
    link: { provider: "microsoft" },
  });
  assert.equal(gmail.canSync, false);
  assert.equal(outlook.canSync, true);
});
