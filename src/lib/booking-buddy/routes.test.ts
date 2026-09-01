import assert from "node:assert/strict";
import test from "node:test";

import {
  connectLinkPath,
  proposeGameHref,
  requiresSession,
  safeRedirectTarget,
  sectionForPath,
  siblingsForPath,
} from "./routes.ts";

test("proposeGameHref: a date and start hour become a prefilled deep link to the form", () => {
  assert.equal(
    proposeGameHref({ date: "2026-08-20", startTime: "18:00" }),
    "/booking-buddy/slots?date=2026-08-20&start=18%3A00#post-a-game",
  );
});

test("proposeGameHref: an end hour rides along to seed the Duration", () => {
  assert.equal(
    proposeGameHref({ date: "2026-08-20", startTime: "18:00", endTime: "20:00" }),
    "/booking-buddy/slots?date=2026-08-20&start=18%3A00&end=20%3A00#post-a-game",
  );
});

test("proposeGameHref: an end hour with no start is dropped — nothing to measure a duration from", () => {
  assert.equal(
    proposeGameHref({ date: "2026-08-20", startTime: null, endTime: "20:00" }),
    "/booking-buddy/slots?date=2026-08-20#post-a-game",
  );
});

test("proposeGameHref: a null or missing start hour leaves the form's own default", () => {
  assert.equal(
    proposeGameHref({ date: "2026-08-20", startTime: null }),
    "/booking-buddy/slots?date=2026-08-20#post-a-game",
  );
  assert.equal(
    proposeGameHref({ date: "2026-08-20" }),
    "/booking-buddy/slots?date=2026-08-20#post-a-game",
  );
});

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

test("the friend-request Accept/Decline route is reachable without a session", () => {
  // The recipient acts on it straight from the email (issue #228).
  assert.equal(requiresSession("/connect/abc123token"), false);
  assert.equal(requiresSession(connectLinkPath("abc123token")), false);
});

test("connectLinkPath adds the action only when given one", () => {
  assert.equal(connectLinkPath("tok"), "/connect/tok");
  assert.equal(connectLinkPath("tok", "accept"), "/connect/tok?a=accept");
  assert.equal(connectLinkPath("tok", "decline"), "/connect/tok?a=decline");
});

test("a personal invite link is reachable without a session", () => {
  // The friend it's shared with isn't on Booking Buddy yet (issue #175).
  assert.equal(requiresSession("/booking-buddy/join/On50PU-xRzWq5iKjnpJRXjil"), false);
  assert.equal(requiresSession("/booking-buddy/join"), false);
});

test("the join route is never a post-sign-in redirect target", () => {
  // It's public, so `safeRedirectTarget` drops it — a freshly-signed-in User
  // is carried on by the invite cookie, not by bouncing back through /join.
  assert.equal(
    safeRedirectTarget("/booking-buddy/join/On50PU-xRzWq5iKjnpJRXjil"),
    "/booking-buddy",
  );
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

// Two-tier navigation (ADR 0016): the layout nav and the sibling pill row both
// key off `sectionForPath`, so it has to agree with the route table exactly.

test("the dashboard is its own section, only at the exact root", () => {
  assert.equal(sectionForPath("/booking-buddy"), "dashboard");
});

test("Games (still /slots), a single game, Availability, and Find a time all live under Plan", () => {
  assert.equal(sectionForPath("/booking-buddy/slots"), "plan");
  assert.equal(sectionForPath("/booking-buddy/slots/abc-123"), "plan");
  assert.equal(sectionForPath("/booking-buddy/availability"), "plan");
  assert.equal(sectionForPath("/booking-buddy/overlap"), "plan");
});

test("the Find a time route requires a session", () => {
  assert.equal(requiresSession("/booking-buddy/overlap"), true);
});

test("Bookings stands alone as its own section", () => {
  assert.equal(sectionForPath("/booking-buddy/bookings"), "bookings");
});

test("Friends and Groups are siblings under the Friends section", () => {
  assert.equal(sectionForPath("/booking-buddy/friends"), "friends");
  assert.equal(sectionForPath("/booking-buddy/groups"), "friends");
});

test("Settings and Facilities are siblings under the Settings section", () => {
  assert.equal(sectionForPath("/booking-buddy/settings"), "settings");
  assert.equal(sectionForPath("/booking-buddy/orgs"), "settings");
});

test("pre-auth and off-app paths belong to no section", () => {
  assert.equal(sectionForPath("/booking-buddy/sign-in"), null);
  assert.equal(sectionForPath("/booking-buddy/privacy"), null);
  assert.equal(sectionForPath("/booking-buddy/join/token123"), null);
  assert.equal(sectionForPath("/s/token123"), null);
  assert.equal(sectionForPath("/podcast"), null);
});

test("the pill row shows siblings only where there's a choice", () => {
  // Plan (Games + Availability + Find a time), Settings + Facilities, Friends +
  // Groups: two or more real peers → shown.
  assert.deepEqual(
    siblingsForPath("/booking-buddy/slots").map((c) => c.label),
    ["Games", "Availability", "Find a time"],
  );
  assert.deepEqual(
    siblingsForPath("/booking-buddy/availability").map((c) => c.label),
    ["Games", "Availability", "Find a time"],
  );
  assert.deepEqual(
    siblingsForPath("/booking-buddy/overlap").map((c) => c.label),
    ["Games", "Availability", "Find a time"],
  );
  assert.deepEqual(
    siblingsForPath("/booking-buddy/settings").map((c) => c.label),
    ["Settings", "Facilities"],
  );
  assert.deepEqual(
    siblingsForPath("/booking-buddy/orgs").map((c) => c.label),
    ["Settings", "Facilities"],
  );
  assert.deepEqual(
    siblingsForPath("/booking-buddy/groups").map((c) => c.label),
    ["Friends", "Groups"],
  );
  // Dashboard, Bookings, pre-auth: nothing to choose between.
  assert.deepEqual(siblingsForPath("/booking-buddy"), []);
  assert.deepEqual(siblingsForPath("/booking-buddy/bookings"), []);
  assert.deepEqual(siblingsForPath("/booking-buddy/sign-in"), []);
});
