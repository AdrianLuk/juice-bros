import assert from "node:assert/strict";
import test from "node:test";

import {
  MAILBOX_PROVIDERS,
  MAILBOX_PROVIDER_IDENTITY_LABEL,
  MAILBOX_PROVIDER_LABEL,
  isMailboxProvider,
} from "./mailbox-provider.ts";

test("isMailboxProvider accepts the known providers and nothing else", () => {
  assert.equal(isMailboxProvider("google"), true);
  assert.equal(isMailboxProvider("microsoft"), true);
  assert.equal(isMailboxProvider("Google"), false);
  assert.equal(isMailboxProvider("yahoo"), false);
  assert.equal(isMailboxProvider(""), false);
});

test("every provider has an inbox label and an identity label", () => {
  for (const provider of MAILBOX_PROVIDERS) {
    assert.equal(typeof MAILBOX_PROVIDER_LABEL[provider], "string");
    assert.ok(MAILBOX_PROVIDER_LABEL[provider].length > 0);
    assert.equal(typeof MAILBOX_PROVIDER_IDENTITY_LABEL[provider], "string");
    assert.ok(MAILBOX_PROVIDER_IDENTITY_LABEL[provider].length > 0);
  }
});

test("the labels name the inbox brand and the identity platform distinctly", () => {
  assert.equal(MAILBOX_PROVIDER_LABEL.microsoft, "Outlook");
  assert.equal(MAILBOX_PROVIDER_IDENTITY_LABEL.microsoft, "Microsoft");
  assert.equal(MAILBOX_PROVIDER_LABEL.google, "Gmail");
  assert.equal(MAILBOX_PROVIDER_IDENTITY_LABEL.google, "Google");
});
