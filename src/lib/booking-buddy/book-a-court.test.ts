import assert from "node:assert/strict";
import test from "node:test";

import {
  bookACourtHeading,
  bookingsOpenedLabel,
  slotsNeedingACourt,
  withoutCourtMatches,
  type CourtlessSlot,
} from "./book-a-court.ts";

const TORONTO = "America/Toronto";

/** An unbooked Toronto game at a Toronto facility that opens bookings 3 days ahead at 7am. */
function slot(overrides: Partial<CourtlessSlot> = {}): CourtlessSlot {
  return {
    id: "slot-1",
    // Tue Oct 20 2026, 8pm Toronto (EDT, UTC-4).
    proposedStart: "2026-10-21T00:00:00Z",
    timeZone: TORONTO,
    hasBooking: false,
    intendedOrg: {
      name: "Pickle Palace",
      timeZone: TORONTO,
      bookingWindow: { daysBefore: 3, time: "07:00" },
    },
    ...overrides,
  };
}

const ids = (slots: readonly CourtlessSlot[], now: Date) =>
  slotsNeedingACourt(slots, now).map((notice) => notice.slot.id);

test("no notice before the window opens", () => {
  // Sat Oct 17, 6:59am Toronto: one minute early.
  assert.deepEqual(ids([slot()], new Date("2026-10-17T10:59:00Z")), []);
});

test("a notice once the window has opened", () => {
  // Sun Oct 18, noon Toronto.
  assert.deepEqual(ids([slot()], new Date("2026-10-18T16:00:00Z")), ["slot-1"]);
});

test("the notice appears at exactly the minute the window opens", () => {
  // Sat Oct 17, 7:00am Toronto.
  assert.deepEqual(ids([slot()], new Date("2026-10-17T11:00:00Z")), ["slot-1"]);
});

test("a game with a Booking attached needs no court", () => {
  assert.deepEqual(ids([slot({ hasBooking: true })], new Date("2026-10-18T16:00:00Z")), []);
});

test("a game with no Intended Org gets no notice", () => {
  assert.deepEqual(ids([slot({ intendedOrg: null })], new Date("2026-10-18T16:00:00Z")), []);
});

test("a facility with no Booking Window set gets no notice", () => {
  const noWindow = slot({
    intendedOrg: { name: "Pickle Palace", timeZone: TORONTO, bookingWindow: null },
  });
  assert.deepEqual(ids([noWindow], new Date("2026-10-18T16:00:00Z")), []);
});

test("a game that has started gets no notice", () => {
  // 8:00pm Toronto on game day: the game has just begun.
  assert.deepEqual(ids([slot()], new Date("2026-10-21T00:00:00Z")), []);
  // 7:59pm: still a notice.
  assert.deepEqual(ids([slot()], new Date("2026-10-20T23:59:00Z")), ["slot-1"]);
});

test("several games come back soonest game first", () => {
  const later = slot({ id: "later", proposedStart: "2026-10-23T00:00:00Z" });
  const sooner = slot({ id: "sooner", proposedStart: "2026-10-21T00:00:00Z" });
  const notYet = slot({ id: "not-yet", proposedStart: "2026-10-30T00:00:00Z" });
  // Tue Oct 20, 9am Toronto: Thursday's window opened Monday, tonight's on Saturday.
  assert.deepEqual(ids([later, notYet, sooner], new Date("2026-10-20T13:00:00Z")), [
    "sooner",
    "later",
  ]);
});

test("a same-day window opens on game day at the window's time", () => {
  const sameDay = slot({
    intendedOrg: {
      name: "Pickle Palace",
      timeZone: TORONTO,
      bookingWindow: { daysBefore: 0, time: "09:00" },
    },
  });
  // Tue Oct 20, 8:59am and 9:00am Toronto.
  assert.deepEqual(ids([sameDay], new Date("2026-10-20T12:59:00Z")), []);
  assert.deepEqual(ids([sameDay], new Date("2026-10-20T13:00:00Z")), ["slot-1"]);
});

test("the game's date comes from its own zone, the opening time from the facility's", () => {
  // Tue Oct 20, 10pm in Vancouver, which is already Wednesday in Toronto.
  // The window still counts back from Tuesday: Sat Oct 17, 7am Toronto.
  const vancouverGame = slot({
    proposedStart: "2026-10-21T05:00:00Z",
    timeZone: "America/Vancouver",
  });
  assert.deepEqual(ids([vancouverGame], new Date("2026-10-17T10:59:00Z")), []);
  assert.deepEqual(ids([vancouverGame], new Date("2026-10-17T11:00:00Z")), ["slot-1"]);
});

test("across a daylight-saving change the window opens at the facility's stated local time", () => {
  // Tue Nov 3, 7am Toronto (EST, after Sunday's change). Three days before is
  // Sat Oct 31, 7am Toronto, still EDT: 11:00Z, not 72 hours before the game.
  const afterTheChange = slot({ proposedStart: "2026-11-03T12:00:00Z" });
  assert.deepEqual(ids([afterTheChange], new Date("2026-10-31T10:59:00Z")), []);
  assert.deepEqual(ids([afterTheChange], new Date("2026-10-31T11:00:00Z")), ["slot-1"]);
});

const openedLabel = (now: Date) => bookingsOpenedLabel(slotsNeedingACourt([slot()], now)[0]);

test("the notice says how long bookings have been open", () => {
  // Sat Oct 17, 7am Toronto onwards.
  assert.equal(
    openedLabel(new Date("2026-10-17T15:00:00Z")),
    "Pickle Palace opened bookings today at 7:00 AM.",
  );
  assert.equal(
    openedLabel(new Date("2026-10-18T03:59:00Z")),
    "Pickle Palace opened bookings today at 7:00 AM.",
  );
  assert.equal(
    openedLabel(new Date("2026-10-18T04:00:00Z")),
    "Pickle Palace opened bookings yesterday.",
  );
  assert.equal(
    openedLabel(new Date("2026-10-20T16:00:00Z")),
    "Pickle Palace opened bookings 3 days ago.",
  );
});

test("the notice names the game's day and start time in the game's own zone", () => {
  const notice = slotsNeedingACourt([slot()], new Date("2026-10-18T16:00:00Z"))[0];
  assert.equal(bookACourtHeading(notice), "Book a court for Tue, Oct 20 at 8:00 PM");
});

test("a game with a court to attach drops its Book a court notice; the others keep theirs", () => {
  const notes = [{ slotId: "tue" }, { slotId: "thu" }];
  assert.deepEqual(withoutCourtMatches(notes, [{ slotId: "tue" }, { slotId: "elsewhere" }]), [
    { slotId: "thu" },
  ]);
  assert.deepEqual(withoutCourtMatches(notes, []), notes);
});
