import assert from "node:assert/strict";
import test from "node:test";

import {
  dueReminderSlots,
  planAttendeeReminderRun,
  planBookingWindowReminderRun,
  type CandidateSlot,
  type DueBookingWindow,
  type PlanAttendeeReminderRunInput,
  type PlanBookingWindowReminderRunInput,
} from "./reminder-run.ts";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const ORIGIN = "https://juice.example";

function slot(overrides: Partial<CandidateSlot> = {}): CandidateSlot {
  return {
    id: "slot-1",
    // 30 min out, 60 min offset → due window is open, start not yet reached.
    proposedStart: "2026-06-15T12:30:00.000Z",
    proposedEnd: "2026-06-15T14:00:00.000Z",
    timeZone: "America/Toronto",
    reminderOffsetMinutes: 60,
    ...overrides,
  };
}

// --- dueReminderSlots -----------------------------------------------------

test("dueReminderSlots keeps a slot whose offset window is open and start is still ahead", () => {
  assert.deepEqual(dueReminderSlots([slot()], NOW).map((s) => s.id), ["slot-1"]);
});

test("dueReminderSlots drops a slot whose start has already passed", () => {
  const started = slot({ id: "past", proposedStart: "2026-06-15T11:50:00.000Z" });
  assert.deepEqual(dueReminderSlots([started], NOW), []);
});

test("dueReminderSlots drops a slot further out than its own offset", () => {
  const farOff = slot({ id: "far", proposedStart: "2026-06-25T12:30:00.000Z" });
  assert.deepEqual(dueReminderSlots([farOff], NOW), []);
});

// --- planAttendeeReminderRun --------------------------------------------

function attendeeInput(
  overrides: Partial<PlanAttendeeReminderRunInput> = {},
): PlanAttendeeReminderRunInput {
  return {
    dueSlots: [slot()],
    confirmedSlotIds: new Set(["slot-1"]),
    responsesBySlot: new Map([["slot-1", [{ userId: "u-amy", answer: "yes" }]]]),
    emailEnabledByUser: new Map(),
    pushEnabledByUser: new Map(),
    alreadySent: new Set(),
    subscriptionsByUser: new Map(),
    pushConfigured: false,
    origin: ORIGIN,
    ...overrides,
  };
}

test("a confirmed due slot with a yes responder yields one email send, defaulting email on", () => {
  const { sends, checked } = planAttendeeReminderRun(attendeeInput());
  assert.equal(checked, 1);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].channel, "email");
  assert.equal(sends[0].slotId, "slot-1");
  assert.equal(sends[0].userId, "u-amy");
  assert.match(sends[0].channel === "email" ? sends[0].subject : "", /^Reminder:/);
});

test("a bare-proposal slot (no Booking attached) yields no sends, but still counts as checked", () => {
  const { sends, checked } = planAttendeeReminderRun(
    attendeeInput({ confirmedSlotIds: new Set() }),
  );
  assert.deepEqual(sends, []);
  assert.equal(checked, 1);
});

test("checked reflects the number of due slots regardless of how many produce sends", () => {
  const { checked } = planAttendeeReminderRun(
    attendeeInput({
      dueSlots: [slot({ id: "a" }), slot({ id: "b" }), slot({ id: "c" })],
      confirmedSlotIds: new Set(["a"]),
      responsesBySlot: new Map([["a", [{ userId: "u", answer: "yes" }]]]),
    }),
  );
  assert.equal(checked, 3);
});

test("a user with email disabled gets no email send", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({ emailEnabledByUser: new Map([["u-amy", false]]) }),
  );
  assert.deepEqual(sends, []);
});

test("maybe/no responders and guests (null userId) are not recipients", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      responsesBySlot: new Map([
        [
          "slot-1",
          [
            { userId: "u-maybe", answer: "maybe" },
            { userId: "u-no", answer: "no" },
            { userId: null, answer: "yes" },
          ],
        ],
      ]),
    }),
  );
  assert.deepEqual(sends, []);
});

test("the push channel is skipped entirely when the deploy has no VAPID keys", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      pushConfigured: false,
      pushEnabledByUser: new Map([["u-amy", true]]),
      subscriptionsByUser: new Map([
        ["u-amy", [{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" }]],
      ]),
    }),
  );
  assert.deepEqual(sends.map((s) => s.channel), ["email"]);
});

test("a push-enabled recipient with a subscription on file gets a push send carrying its devices and payload", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      pushConfigured: true,
      pushEnabledByUser: new Map([["u-amy", true]]),
      subscriptionsByUser: new Map([
        [
          "u-amy",
          [
            { id: "sub-1", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" },
            { id: "sub-2", endpoint: "https://push.example/2", p256dh: "k2", auth: "a2" },
          ],
        ],
      ]),
    }),
  );

  assert.deepEqual(sends.map((s) => s.channel), ["email", "push"]);
  const push = sends.find((s) => s.channel === "push");
  assert.ok(push && push.channel === "push");
  assert.deepEqual(push.subscriptions.map((sub) => sub.id), ["sub-1", "sub-2"]);
  assert.ok(push.payload.title && push.payload.url.startsWith(ORIGIN));
});

test("a push-enabled recipient with no subscription on file gets no push send (quiet skip)", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      pushConfigured: true,
      pushEnabledByUser: new Map([["u-amy", true]]),
      subscriptionsByUser: new Map(),
    }),
  );
  assert.deepEqual(sends.map((s) => s.channel), ["email"]);
});

test("push defaults off — a recipient with a subscription but no preference row gets no push", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      pushConfigured: true,
      subscriptionsByUser: new Map([
        ["u-amy", [{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" }]],
      ]),
    }),
  );
  assert.deepEqual(sends.map((s) => s.channel), ["email"]);
});

test("email already sent doesn't suppress the push send — the channels are keyed independently", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      pushConfigured: true,
      pushEnabledByUser: new Map([["u-amy", true]]),
      subscriptionsByUser: new Map([
        ["u-amy", [{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" }]],
      ]),
      alreadySent: new Set(["slot-1:u-amy:email"]),
    }),
  );
  assert.deepEqual(sends.map((s) => s.channel), ["push"]);
});

test("both channels already sent yields nothing for that recipient", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      pushConfigured: true,
      pushEnabledByUser: new Map([["u-amy", true]]),
      subscriptionsByUser: new Map([
        ["u-amy", [{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" }]],
      ]),
      alreadySent: new Set(["slot-1:u-amy:email", "slot-1:u-amy:push"]),
    }),
  );
  assert.deepEqual(sends, []);
});

test("a send is produced per (due slot, recipient)", () => {
  const { sends } = planAttendeeReminderRun(
    attendeeInput({
      dueSlots: [slot({ id: "a" }), slot({ id: "b" })],
      confirmedSlotIds: new Set(["a", "b"]),
      responsesBySlot: new Map([
        ["a", [{ userId: "u1", answer: "yes" }, { userId: "u2", answer: "yes" }]],
        ["b", [{ userId: "u1", answer: "yes" }]],
      ]),
    }),
  );
  assert.deepEqual(
    sends.map((s) => `${s.slotId}:${s.userId}`).sort(),
    ["a:u1", "a:u2", "b:u1"],
  );
});

// --- planBookingWindowReminderRun --------------------------------------

function bookingWindow(overrides: Partial<DueBookingWindow> = {}): DueBookingWindow {
  return {
    slotId: "slot-1",
    ownerId: "owner-1",
    proposedStart: "2026-06-20T12:30:00.000Z",
    proposedEnd: "2026-06-20T14:00:00.000Z",
    timeZone: "America/Toronto",
    orgName: "Downsview Courts",
    orgGooglePlaceId: null,
    ...overrides,
  };
}

function bookingWindowInput(
  overrides: Partial<PlanBookingWindowReminderRunInput> = {},
): PlanBookingWindowReminderRunInput {
  return {
    dueWindows: [bookingWindow()],
    confirmedSlotIds: new Set(),
    emailEnabledByOwner: new Map(),
    alreadySent: new Set(),
    placeById: new Map(),
    origin: ORIGIN,
    ...overrides,
  };
}

test("a due, unbooked, not-yet-reminded window yields one email to the organizer", () => {
  const { sends, checked } = planBookingWindowReminderRun(bookingWindowInput());
  assert.equal(checked, 1);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].slotId, "slot-1");
  assert.equal(sends[0].userId, "owner-1");
  assert.equal(sends[0].subject, "Time to book: Downsview Courts");
});

test("a window whose slot already has a Booking is filtered out, and not counted as checked", () => {
  const { sends, checked } = planBookingWindowReminderRun(
    bookingWindowInput({ confirmedSlotIds: new Set(["slot-1"]) }),
  );
  assert.deepEqual(sends, []);
  assert.equal(checked, 0);
});

test("a window already reminded (its slot id in alreadySent) yields no send", () => {
  const { sends } = planBookingWindowReminderRun(
    bookingWindowInput({ alreadySent: new Set(["slot-1"]) }),
  );
  assert.deepEqual(sends, []);
});

test("an owner with booking-window email disabled gets no send", () => {
  const { sends } = planBookingWindowReminderRun(
    bookingWindowInput({ emailEnabledByOwner: new Map([["owner-1", false]]) }),
  );
  assert.deepEqual(sends, []);
});

test("a Place-backed org resolves its name from the place cache", () => {
  const { sends } = planBookingWindowReminderRun(
    bookingWindowInput({
      dueWindows: [bookingWindow({ orgName: null, orgGooglePlaceId: "place-xyz" })],
      placeById: new Map([
        ["place-xyz", { name: "PicklePlex Downsview", formattedAddress: "1 Main St" }],
      ]),
    }),
  );
  assert.equal(sends[0].subject, "Time to book: PicklePlex Downsview");
});

test("a missing preference row defaults the owner to enabled", () => {
  const { sends } = planBookingWindowReminderRun(
    bookingWindowInput({ emailEnabledByOwner: new Map() }),
  );
  assert.equal(sends.length, 1);
});
