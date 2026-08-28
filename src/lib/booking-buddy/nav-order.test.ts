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
  // Games → Open time → Find a time
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
  // Facilities detail-ish depth shouldn't flip the Bookings→Facilities order.
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/bookings`, `${ROOT}/orgs`),
    "forward",
  );
  assert.equal(
    bookingBuddyNavDirection(`${ROOT}/slots/abc123`, `${ROOT}/bookings`),
    "forward",
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
