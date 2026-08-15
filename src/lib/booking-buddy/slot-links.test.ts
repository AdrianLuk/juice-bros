import assert from "node:assert/strict";
import test from "node:test";

import {
  GUEST_NAME_MAX_LENGTH,
  generateSlotLinkToken,
  guestRsvpMessage,
  parseGuestRsvp,
  slotLinkWriteMessage,
} from "./slot-links.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("generateSlotLinkToken produces a URL-safe, unguessable token", () => {
  const token = generateSlotLinkToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length >= 24, "token should carry real entropy");

  // Two calls never collide in practice — proves it isn't a constant.
  assert.notEqual(token, generateSlotLinkToken());
});

test("a token, name and valid answer are accepted", () => {
  assert.deepEqual(
    parseGuestRsvp(form({ token: "tok123", guest_name: "June", answer: "yes" })),
    { token: "tok123", guestName: "June", answer: "yes" },
  );
});

test("guest name is trimmed", () => {
  const parsed = parseGuestRsvp(
    form({ token: "tok123", guest_name: "  June  ", answer: "yes" }),
  );
  assert.deepEqual(parsed, { token: "tok123", guestName: "June", answer: "yes" });
});

test("a missing token is refused", () => {
  assert.ok("error" in parseGuestRsvp(form({ guest_name: "June", answer: "yes" })));
});

test("a missing name is refused", () => {
  assert.ok("error" in parseGuestRsvp(form({ token: "tok123", answer: "yes" })));
});

test("a name over the length limit is refused", () => {
  const tooLong = "a".repeat(GUEST_NAME_MAX_LENGTH + 1);
  assert.ok(
    "error" in parseGuestRsvp(form({ token: "tok123", guest_name: tooLong, answer: "yes" })),
  );
});

test("a missing or unknown answer is refused rather than defaulted", () => {
  assert.ok("error" in parseGuestRsvp(form({ token: "tok123", guest_name: "June" })));
  assert.ok(
    "error" in
      parseGuestRsvp(form({ token: "tok123", guest_name: "June", answer: "maybe not" })),
  );
});

test("slotLinkWriteMessage reads an RLS filter as an ownership failure", () => {
  assert.match(slotLinkWriteMessage({ code: "42501" }), /own slot/i);
});

test("slotLinkWriteMessage reads any other error as a generic write failure", () => {
  assert.match(slotLinkWriteMessage({ code: "08006" }), /try again/i);
});

test("guestRsvpMessage reads an invalid token as needing a new link", () => {
  assert.match(guestRsvpMessage("invalid_token"), /new one/i);
});

test("guestRsvpMessage reads a write failure as a generic retry", () => {
  assert.match(guestRsvpMessage("write_failed"), /try again/i);
});
