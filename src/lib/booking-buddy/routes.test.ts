import assert from "node:assert/strict";
import test from "node:test";

import { requiresSession } from "./routes.ts";

test("the Booking Buddy dashboard requires a session", () => {
  assert.equal(requiresSession("/booking-buddy"), true);
});

test("nested Booking Buddy routes require a session", () => {
  assert.equal(requiresSession("/booking-buddy/friends"), true);
  assert.equal(requiresSession("/booking-buddy/slots/abc-123"), true);
});

test("the sign-in page is reachable without a session", () => {
  assert.equal(requiresSession("/booking-buddy/sign-in"), false);
});

test("auth callback routes are reachable without a session", () => {
  // The magic-link/OAuth handshake lands here before a session cookie exists.
  assert.equal(requiresSession("/booking-buddy/auth/callback"), false);
});

test("a trailing slash does not bypass the gate", () => {
  assert.equal(requiresSession("/booking-buddy/"), true);
});

test("routes merely prefixed with the same string are not Booking Buddy routes", () => {
  // Guards against a naive startsWith check gating unrelated marketing pages.
  assert.equal(requiresSession("/booking-buddy-press-kit"), false);
});

test("marketing routes never require a session", () => {
  assert.equal(requiresSession("/"), false);
  assert.equal(requiresSession("/podcast"), false);
  assert.equal(requiresSession("/tools/pickle-point-pal"), false);
});

test("the public Slot Link route is reachable without a session", () => {
  // Guests respond via Slot Link without an account (see CONTEXT.md).
  assert.equal(requiresSession("/s/abc123token"), false);
});
