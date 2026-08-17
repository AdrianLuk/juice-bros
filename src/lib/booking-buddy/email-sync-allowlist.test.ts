import assert from "node:assert/strict";
import test from "node:test";

import { isEmailSyncAllowed } from "./email-sync-allowlist.ts";

test("an allowlisted Username is allowed", () => {
  assert.equal(isEmailSyncAllowed("benbackhand", "amyace,benbackhand"), true);
});

test("a Username not on the list is rejected", () => {
  assert.equal(isEmailSyncAllowed("benbackhand2", "amyace,benbackhand"), false);
});

test("an unset allowlist rejects everyone rather than defaulting open", () => {
  assert.equal(isEmailSyncAllowed("amyace", undefined), false);
});

test("an empty-string allowlist rejects everyone", () => {
  assert.equal(isEmailSyncAllowed("amyace", ""), false);
});

test("a blank/whitespace-only allowlist rejects everyone", () => {
  assert.equal(isEmailSyncAllowed("amyace", "  ,  ,"), false);
});

test("a null Username (never set) is rejected even against a non-empty allowlist", () => {
  assert.equal(isEmailSyncAllowed(null, "amyace"), false);
});

test("matching is case-insensitive, mirroring the unique index on lower(username)", () => {
  assert.equal(isEmailSyncAllowed("BenBackhand", "benbackhand"), true);
  assert.equal(isEmailSyncAllowed("benbackhand", "BenBackhand"), true);
});

test("surrounding whitespace in either the Username or the list entries is ignored", () => {
  assert.equal(isEmailSyncAllowed("  amyace  ", " amyace , benbackhand "), true);
});

test("one Username on the list doesn't accidentally allow a prefix/substring match", () => {
  assert.equal(isEmailSyncAllowed("amyace2", "amyace"), false);
});
