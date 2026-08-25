import assert from "node:assert/strict";
import test from "node:test";

import { isEmailSyncAllowed } from "./email-sync-allowlist.ts";

test("an allowlisted Username is allowed", () => {
  assert.equal(isEmailSyncAllowed("benbackhand", "someone@example.com", "amyace,benbackhand"), true);
});

test("a Username not on the list is rejected", () => {
  assert.equal(isEmailSyncAllowed("benbackhand2", "someone@example.com", "amyace,benbackhand"), false);
});

test("an allowlisted email is allowed even when the Username isn't on the list", () => {
  assert.equal(isEmailSyncAllowed("benbackhand", "amy@example.com", "amy@example.com"), true);
});

test("an email not on the list is rejected, same as an unmatched Username", () => {
  assert.equal(isEmailSyncAllowed("benbackhand", "ben@example.com", "amy@example.com"), false);
});

test("an unset allowlist rejects everyone rather than defaulting open", () => {
  assert.equal(isEmailSyncAllowed("amyace", "amy@example.com", undefined), false);
});

test("an empty-string allowlist rejects everyone", () => {
  assert.equal(isEmailSyncAllowed("amyace", "amy@example.com", ""), false);
});

test("a blank/whitespace-only allowlist rejects everyone", () => {
  assert.equal(isEmailSyncAllowed("amyace", "amy@example.com", "  ,  ,"), false);
});

test("a null Username and undefined email are rejected even against a non-empty allowlist", () => {
  assert.equal(isEmailSyncAllowed(null, undefined, "amyace"), false);
});

test("matching is case-insensitive, mirroring the unique index on lower(username)", () => {
  assert.equal(isEmailSyncAllowed("BenBackhand", "ben@example.com", "benbackhand"), true);
  assert.equal(isEmailSyncAllowed("benbackhand", "ben@example.com", "BenBackhand"), true);
});

test("email matching is also case-insensitive", () => {
  assert.equal(isEmailSyncAllowed("benbackhand", "Amy@Example.com", "amy@example.com"), true);
  assert.equal(isEmailSyncAllowed("benbackhand", "amy@example.com", "Amy@Example.com"), true);
});

test("surrounding whitespace in either the Username/email or the list entries is ignored", () => {
  assert.equal(isEmailSyncAllowed("  amyace  ", "amy@example.com", " amyace , benbackhand "), true);
  assert.equal(isEmailSyncAllowed("benbackhand2", "  amy@example.com  ", " amy@example.com "), true);
});

test("one Username on the list doesn't accidentally allow a prefix/substring match", () => {
  assert.equal(isEmailSyncAllowed("amyace2", "someone@example.com", "amyace"), false);
});
