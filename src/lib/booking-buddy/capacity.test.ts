import assert from "node:assert/strict";
import test from "node:test";

import {
  COURT_CAPACITY,
  MAX_ROTATION_BUFFER,
  bookingOverlapsSlot,
  computeCapacity,
  isBookingFormat,
  isOverCapacity,
  parseRotationBuffer,
  slotBookingWriteMessage,
} from "./capacity.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("base capacity sums each attached booking's own court capacity", () => {
  assert.equal(
    computeCapacity({ formats: ["doubles", "doubles"], rotationBuffer: 0 }),
    2 * COURT_CAPACITY.doubles,
  );
});

test("a singles court counts for two, not four", () => {
  assert.equal(
    computeCapacity({ formats: ["singles"], rotationBuffer: 0 }),
    COURT_CAPACITY.singles,
  );
});

test("singles and doubles courts on the same slot sum their own capacities", () => {
  assert.equal(
    computeCapacity({ formats: ["singles", "doubles"], rotationBuffer: 0 }),
    COURT_CAPACITY.singles + COURT_CAPACITY.doubles,
  );
});

test("the rotation buffer is added on top of the courts", () => {
  assert.equal(
    computeCapacity({ formats: ["doubles"], rotationBuffer: 2 }),
    COURT_CAPACITY.doubles + 2,
  );
});

test("a slot with no bookings has no enforceable capacity", () => {
  // Not zero — zero would read as "nobody can come", when the truth is that
  // a bare proposal has nothing to enforce yet (ADR 0001).
  assert.equal(computeCapacity({ formats: [], rotationBuffer: 4 }), null);
});

test("isBookingFormat rejects anything outside singles/doubles", () => {
  assert.equal(isBookingFormat("singles"), true);
  assert.equal(isBookingFormat("doubles"), true);
  assert.equal(isBookingFormat("mixed"), false);
  assert.equal(isBookingFormat(null), false);
});

test("nothing is over capacity while there is no capacity to exceed", () => {
  assert.equal(isOverCapacity({ capacity: null, yesCount: 12 }), false);
});

test("over capacity starts one yes past the ceiling, not at it", () => {
  assert.equal(isOverCapacity({ capacity: 4, yesCount: 4 }), false);
  assert.equal(isOverCapacity({ capacity: 4, yesCount: 5 }), true);
});

test("a rotation buffer is parsed off the form", () => {
  assert.deepEqual(parseRotationBuffer(form({ slot_id: "slot-1", rotation_buffer: "2" })), {
    slotId: "slot-1",
    rotationBuffer: 2,
  });
});

test("a blank rotation buffer means no buffer", () => {
  assert.deepEqual(parseRotationBuffer(form({ slot_id: "slot-1", rotation_buffer: "" })), {
    slotId: "slot-1",
    rotationBuffer: 0,
  });
});

test("a negative, fractional or over-long buffer is refused", () => {
  assert.ok("error" in parseRotationBuffer(form({ slot_id: "s", rotation_buffer: "-1" })));
  assert.ok("error" in parseRotationBuffer(form({ slot_id: "s", rotation_buffer: "1.5" })));
  assert.ok("error" in parseRotationBuffer(form({ slot_id: "s", rotation_buffer: "lots" })));
  assert.ok(
    "error" in
      parseRotationBuffer(
        form({ slot_id: "s", rotation_buffer: String(MAX_ROTATION_BUFFER + 1) }),
      ),
  );
});

test("a missing slot id is refused", () => {
  assert.ok("error" in parseRotationBuffer(form({ rotation_buffer: "2" })));
});

test("a booking at exactly the slot's window overlaps it", () => {
  const slot = { proposedStart: "2031-07-07T13:00:00Z", proposedEnd: "2031-07-07T14:30:00Z" };
  assert.equal(
    bookingOverlapsSlot(
      { startsAt: "2031-07-07T13:00:00Z", endsAt: "2031-07-07T14:30:00Z" },
      slot,
    ),
    true,
  );
});

test("a booking that partially overlaps the slot's window still counts", () => {
  const slot = { proposedStart: "2031-07-07T13:00:00Z", proposedEnd: "2031-07-07T14:30:00Z" };
  assert.equal(
    bookingOverlapsSlot(
      { startsAt: "2031-07-07T14:00:00Z", endsAt: "2031-07-07T15:00:00Z" },
      slot,
    ),
    true,
  );
});

test("a booking on an unrelated day does not overlap", () => {
  const slot = { proposedStart: "2031-07-07T13:00:00Z", proposedEnd: "2031-07-07T14:30:00Z" };
  assert.equal(
    bookingOverlapsSlot(
      { startsAt: "2031-08-20T13:00:00Z", endsAt: "2031-08-20T14:30:00Z" },
      slot,
    ),
    false,
  );
});

test("back-to-back windows that only touch at the boundary do not overlap", () => {
  const slot = { proposedStart: "2031-07-07T13:00:00Z", proposedEnd: "2031-07-07T14:30:00Z" };
  assert.equal(
    bookingOverlapsSlot(
      { startsAt: "2031-07-07T14:30:00Z", endsAt: "2031-07-07T16:00:00Z" },
      slot,
    ),
    false,
  );
});

test("attaching the same booking twice reads as already attached", () => {
  assert.match(slotBookingWriteMessage({ code: "23505" }), /already/i);
});

test("attaching someone else's booking says so", () => {
  assert.match(
    slotBookingWriteMessage({
      code: "23514",
      message: "a booking can only be attached to your own slot",
    }),
    /your own/i,
  );
});

test("attaching a booking already on a different slot says so", () => {
  assert.match(
    slotBookingWriteMessage({
      code: "23505",
      message: 'duplicate key value violates unique constraint "slot_bookings_booking_unique"',
    }),
    /different slot/i,
  );
});

test("an RLS-filtered attach reads as not the caller's slot", () => {
  assert.match(slotBookingWriteMessage({ code: "42501" }), /your own slot/i);
});
