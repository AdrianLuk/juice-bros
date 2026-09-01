import assert from "node:assert/strict";
import test from "node:test";

import { bookingBuddyNavDirection } from "./nav-order.ts";

const ROOT = "/booking-buddy";

test("a fresh load (no previous path) is lateral — there is no page leaving", () => {
  assert.equal(bookingBuddyNavDirection(null, `${ROOT}/slots`), "lateral");
  assert.equal(bookingBuddyNavDirection(undefined, ROOT), "lateral");
});

test("navigating to the same path is lateral", () => {
  assert.equal(bookingBuddyNavDirection(`${ROOT}/friends`, `${ROOT}/friends`), "lateral");
});

test("a list opening its own detail is forward; the detail closing back is back", () => {
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/slots`, `${ROOT}/slots/abc123`),
    "forward",
  );
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/slots/abc123`, `${ROOT}/slots`),
    "back",
  );
});

test("the dashboard is home base — into the app is forward, back to it is back", () => {
  assert.equal(bookingBuddyNavDirection(ROOT, `${ROOT}/bookings`), "forward");
  assert.equal(bookingBuddyNavDirection(`${ROOT}/settings`, ROOT), "back");
});

test("moving between sections follows the nav's own order", () => {
  // Plan (2nd) → Friends (4th)
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/slots`, `${ROOT}/friends`),
    "forward",
  );
  // Friends (4th) → Bookings (3rd)
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/friends`, `${ROOT}/bookings`),
    "back",
  );
});

test("moving between siblings in one section follows the sibling order", () => {
  // Games → Availability → Find a time
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/slots`, `${ROOT}/availability`),
    "forward",
  );
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/overlap`, `${ROOT}/availability`),
    "back",
  );
});

test("a detail route ranks with its list, not the section root", () => {
  // A single game sits at /slots/<id>; it should rank with Games (2nd primary),
  // so moving on to Bookings still reads as forward.
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/slots/abc123`, `${ROOT}/bookings`),
    "forward",
  );
});

test("Facilities sits at the tail of the order, under Settings", () => {
  // Moved out of the Bookings section (ADR 0016): it's now Settings' second
  // child, the last primary destination in the app's reading order.
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/settings`, `${ROOT}/orgs`),
    "forward",
  );
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/orgs`, `${ROOT}/bookings`),
    "back",
  );
});

test("a pre-auth page (off the nav order) resolves to lateral", () => {
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/sign-in`, `${ROOT}/privacy`),
    "lateral",
  );
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/join/tok`, `${ROOT}/slots`),
    "lateral",
  );
});
