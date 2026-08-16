import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REMINDER_OFFSET_MINUTES,
  MIN_REMINDER_OFFSET_MINUTES,
  formatReminderEmail,
  formatReminderPush,
  getReminderRecipients,
  isReminderDue,
  parseReminderOffsetMinutes,
  reminderOffsetLabel,
  shouldSendReminder,
} from "./reminders.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("getReminderRecipients returns only signed-in yes responders on a confirmed slot", () => {
  const recipients = getReminderRecipients(
    [
      { userId: "amy", answer: "yes" },
      { userId: "ben", answer: "no" },
      { userId: "cal", answer: "maybe" },
      { userId: null, answer: "yes" }, // a Guest
    ],
    true,
  );

  assert.deepEqual(recipients, ["amy"]);
});

test("getReminderRecipients returns nothing for a bare proposal, even with yes responses", () => {
  const recipients = getReminderRecipients([{ userId: "amy", answer: "yes" }], false);
  assert.deepEqual(recipients, []);
});

test("parseReminderOffsetMinutes accepts a whole number of minutes", () => {
  assert.deepEqual(
    parseReminderOffsetMinutes(form({ slot_id: "slot-1", reminder_offset_minutes: "90" })),
    { slotId: "slot-1", reminderOffsetMinutes: 90 },
  );
});

test("parseReminderOffsetMinutes requires a slot id", () => {
  assert.ok(
    "error" in parseReminderOffsetMinutes(form({ reminder_offset_minutes: "90" })),
  );
});

test("parseReminderOffsetMinutes refuses a non-integer", () => {
  assert.ok(
    "error" in
      parseReminderOffsetMinutes(form({ slot_id: "slot-1", reminder_offset_minutes: "1.5" })),
  );
  assert.ok(
    "error" in
      parseReminderOffsetMinutes(form({ slot_id: "slot-1", reminder_offset_minutes: "soon" })),
  );
});

test("parseReminderOffsetMinutes enforces its bounds", () => {
  assert.ok(
    "error" in
      parseReminderOffsetMinutes(
        form({ slot_id: "slot-1", reminder_offset_minutes: String(MIN_REMINDER_OFFSET_MINUTES - 1) }),
      ),
  );
  assert.ok(
    "error" in
      parseReminderOffsetMinutes(
        form({ slot_id: "slot-1", reminder_offset_minutes: String(MAX_REMINDER_OFFSET_MINUTES + 1) }),
      ),
  );
  assert.deepEqual(
    parseReminderOffsetMinutes(
      form({ slot_id: "slot-1", reminder_offset_minutes: String(MIN_REMINDER_OFFSET_MINUTES) }),
    ),
    { slotId: "slot-1", reminderOffsetMinutes: MIN_REMINDER_OFFSET_MINUTES },
  );
});

test("isReminderDue is false before the offset window opens", () => {
  assert.equal(
    isReminderDue({
      proposedStart: new Date("2031-01-01T12:00:00Z"),
      reminderOffsetMinutes: 60,
      now: new Date("2031-01-01T10:00:00Z"),
    }),
    false,
  );
});

test("isReminderDue is true once the offset window opens, and stays true up to the start", () => {
  const proposedStart = new Date("2031-01-01T12:00:00Z");
  assert.equal(
    isReminderDue({ proposedStart, reminderOffsetMinutes: 60, now: new Date("2031-01-01T11:00:00Z") }),
    true,
  );
  // Still due well inside the window — a send job that runs infrequently
  // must not miss this just because the exact due minute already passed.
  assert.equal(
    isReminderDue({ proposedStart, reminderOffsetMinutes: 60, now: new Date("2031-01-01T11:59:00Z") }),
    true,
  );
});

test("isReminderDue is false once the slot has started", () => {
  const proposedStart = new Date("2031-01-01T12:00:00Z");
  assert.equal(
    isReminderDue({ proposedStart, reminderOffsetMinutes: 60, now: proposedStart }),
    false,
  );
});

test("shouldSendReminder skips a channel already sent, regardless of preference", () => {
  assert.equal(
    shouldSendReminder({ channel: "email", emailEnabled: true, pushEnabled: true, alreadySent: true }),
    false,
  );
});

test("shouldSendReminder skips the push channel for a User with push disabled", () => {
  assert.equal(
    shouldSendReminder({ channel: "push", emailEnabled: true, pushEnabled: false, alreadySent: false }),
    false,
  );
});

test("shouldSendReminder skips the email channel for a User with email disabled", () => {
  assert.equal(
    shouldSendReminder({ channel: "email", emailEnabled: false, pushEnabled: true, alreadySent: false }),
    false,
  );
});

test("shouldSendReminder sends when the channel is enabled and nothing was sent yet", () => {
  assert.equal(
    shouldSendReminder({ channel: "email", emailEnabled: true, pushEnabled: false, alreadySent: false }),
    true,
  );
  assert.equal(
    shouldSendReminder({ channel: "push", emailEnabled: false, pushEnabled: true, alreadySent: false }),
    true,
  );
});

test("reminderOffsetLabel reads minutes, hours, and days in the units people think in", () => {
  assert.equal(reminderOffsetLabel(0), "Right at the start time");
  assert.equal(reminderOffsetLabel(1), "1 minute before");
  assert.equal(reminderOffsetLabel(15), "15 minutes before");
  assert.equal(reminderOffsetLabel(60), "1 hour before");
  assert.equal(reminderOffsetLabel(120), "2 hours before");
  assert.equal(reminderOffsetLabel(1440), "1 day before");
  assert.equal(reminderOffsetLabel(2880), "2 days before");
});

test("reminderOffsetLabel falls back to minutes for a value with no clean unit", () => {
  // Not a preset (a custom or legacy value) — still has to say something sane.
  assert.equal(reminderOffsetLabel(90), "90 minutes before");
});

test("formatReminderEmail carries the slot's own time and a link, HTML-escaped", () => {
  const { subject, html } = formatReminderEmail({
    slotWhen: "Sat, Jan 1 at 9:00 AM <script>",
    slotUrl: "https://example.com/booking-buddy/slots/abc",
  });

  assert.match(subject, /Sat, Jan 1 at 9:00 AM <script>/);
  assert.ok(!html.includes("<script>"), "the slot's own text must not inject markup");
  assert.match(html, /https:\/\/example\.com\/booking-buddy\/slots\/abc/);
});

test("formatReminderPush carries the slot's own time and a target url", () => {
  const { title, body, url } = formatReminderPush({
    slotWhen: "Sat, Jan 1 at 9:00 AM",
    slotUrl: "https://example.com/booking-buddy/slots/abc",
  });

  assert.equal(title, "Booking Buddy");
  assert.match(body, /Sat, Jan 1 at 9:00 AM/);
  assert.equal(url, "https://example.com/booking-buddy/slots/abc");
});
