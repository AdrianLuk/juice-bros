import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeMailboxOAuthState,
  parseMailboxOAuthState,
} from "./mailbox-oauth.ts";

test("encode then parse round-trips the provider and nonce", () => {
  const encoded = encodeMailboxOAuthState("microsoft", "abc123");
  assert.equal(encoded, "microsoft:abc123");
  assert.deepEqual(parseMailboxOAuthState(encoded), {
    provider: "microsoft",
    nonce: "abc123",
  });
});

test("parse keeps a nonce that itself contains a colon", () => {
  assert.deepEqual(parseMailboxOAuthState("google:aa:bb"), {
    provider: "google",
    nonce: "aa:bb",
  });
});

test("parse rejects a bare pre-#280 nonce with no provider prefix", () => {
  assert.equal(parseMailboxOAuthState("deadbeefdeadbeef"), null);
});

test("parse rejects an unknown provider", () => {
  assert.equal(parseMailboxOAuthState("yahoo:abc123"), null);
});

test("parse rejects a provider with an empty nonce", () => {
  assert.equal(parseMailboxOAuthState("google:"), null);
});

test("parse rejects undefined", () => {
  assert.equal(parseMailboxOAuthState(undefined), null);
});
