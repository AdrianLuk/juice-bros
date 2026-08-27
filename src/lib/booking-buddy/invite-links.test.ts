import assert from "node:assert/strict";
import test from "node:test";

import {
  INVITE_TOKEN_PATTERN,
  inviteRelationMessage,
  parseInviteToken,
} from "./invite-links.ts";

test("a well-formed token is returned, trimmed", () => {
  assert.equal(parseInviteToken("On50PU-xRzWq5iKjnpJRXjil"), "On50PU-xRzWq5iKjnpJRXjil");
  assert.equal(
    parseInviteToken("  On50PU-xRzWq5iKjnpJRXjil  "),
    "On50PU-xRzWq5iKjnpJRXjil",
  );
});

test("missing or empty input is null, not a throw", () => {
  assert.equal(parseInviteToken(null), null);
  assert.equal(parseInviteToken(undefined), null);
  assert.equal(parseInviteToken(""), null);
  assert.equal(parseInviteToken("   "), null);
});

test("a token with URL-unsafe or out-of-charset characters is rejected", () => {
  assert.equal(parseInviteToken("On50PU/xRzWq5iKjnpJRXjil"), null); // raw base64 slash
  assert.equal(parseInviteToken("On50PU+xRzWq5iKjnpJRXjil"), null); // raw base64 plus
  assert.equal(parseInviteToken("On50PU xRzWq5iKjnpJRXjil"), null); // space
  assert.equal(parseInviteToken("token.with.dots"), null);
  assert.equal(parseInviteToken("../../etc/passwd"), null);
});

test("a token outside the length bounds is rejected", () => {
  assert.equal(parseInviteToken("a".repeat(15)), null);
  assert.equal(parseInviteToken("a".repeat(16)), "a".repeat(16));
  assert.equal(parseInviteToken("a".repeat(64)), "a".repeat(64));
  assert.equal(parseInviteToken("a".repeat(65)), null);
});

test("the pattern matches what the SQL generator actually emits", () => {
  // 18 bytes -> 24 base64 chars, then +/ -> -_. Every such string must pass.
  for (const sample of [
    "HR7hJdkbQrvn41hFKEjIZ027",
    "fsIfsrrXQENW9FVUeARcsJ9x",
    "G3mWzu7Xv3oKYlGeQ4sATtH_",
    "vTmsn2x5zw-pLPRw6x08b4Sf",
  ]) {
    assert.ok(INVITE_TOKEN_PATTERN.test(sample), sample);
  }
});

test("relation messages name the owner and read as a friendly no-op", () => {
  assert.match(inviteRelationMessage("self", "Amy Ace"), /your own invite link/i);
  assert.match(inviteRelationMessage("connected", "Amy Ace"), /already connected with Amy Ace/);
  assert.match(inviteRelationMessage("request-sent", "Amy Ace"), /pending/i);
  assert.match(
    inviteRelationMessage("request-received", "Amy Ace"),
    /Amy Ace already sent you/,
  );
});
