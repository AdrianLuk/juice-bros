import assert from "node:assert/strict";
import test from "node:test";

import { requiresSession, safeRedirectTarget } from "./routes.ts";

test("the Booking Buddy section root is public (marketing page / dashboard branch)", () => {
  assert.equal(requiresSession("/booking-buddy"), false);
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

test("the privacy policy is reachable without a session", () => {
  // Linked from the sign-in page itself, before there's a session to check.
  assert.equal(requiresSession("/booking-buddy/privacy"), false);
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

// `?next=` comes off the URL, so it is attacker-controllable: a crafted value
// must never bounce a freshly-signed-in User off to another origin.

test("a normal internal path is preserved", () => {
  assert.equal(safeRedirectTarget("/booking-buddy/friends"), "/booking-buddy/friends");
});

test("a missing target falls back to the dashboard", () => {
  assert.equal(safeRedirectTarget(null), "/booking-buddy");
  assert.equal(safeRedirectTarget(""), "/booking-buddy");
});

test("an absolute URL to another origin is rejected", () => {
  assert.equal(safeRedirectTarget("https://evil.example.com/pwn"), "/booking-buddy");
});

test("a protocol-relative URL is rejected", () => {
  // `//evil.com` is a different origin, despite looking like a path.
  assert.equal(safeRedirectTarget("//evil.example.com"), "/booking-buddy");
});

test("a backslash-prefixed target is rejected", () => {
  // Some browsers normalise `/\` to `//`, making this protocol-relative.
  assert.equal(safeRedirectTarget("/\\evil.example.com"), "/booking-buddy");
  assert.equal(safeRedirectTarget("\\\\evil.example.com"), "/booking-buddy");
});

test("a non-slash-prefixed target is rejected", () => {
  assert.equal(safeRedirectTarget("evil.example.com"), "/booking-buddy");
});

test("a javascript: target is rejected", () => {
  assert.equal(safeRedirectTarget("javascript:alert(1)"), "/booking-buddy");
});

test("targets outside Booking Buddy are rejected", () => {
  // Sign-in only ever guards this section; anywhere else is not a legitimate
  // post-sign-in destination.
  assert.equal(safeRedirectTarget("/podcast"), "/booking-buddy");
});

test("the sign-in page itself is never a redirect target", () => {
  // Otherwise a signed-in User bounces back to sign-in forever.
  assert.equal(safeRedirectTarget("/booking-buddy/sign-in"), "/booking-buddy");
});
