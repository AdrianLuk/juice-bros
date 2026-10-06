import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_BOOKING_WINDOW_DAYS_BEFORE,
  MIN_BOOKING_WINDOW_DAYS_BEFORE,
  bookingWindowLabel,
  formatBookingReminderEmail,
  parseBookingWindow,
} from "./booking-window.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("both fields blank parses as clearing the booking window", () => {
  assert.deepEqual(
    parseBookingWindow(form({ org_id: "org-1" })),
    { orgId: "org-1", window: null },
  );
});

test("both fields set parses to a window", () => {
  assert.deepEqual(
    parseBookingWindow(
      form({ org_id: "org-1", booking_window_days_before: "3", booking_window_time: "06:00" }),
    ),
    { orgId: "org-1", window: { daysBefore: 3, time: "06:00" } },
  );
});

test("an org id is required", () => {
  assert.ok(
    "error" in parseBookingWindow(form({ booking_window_days_before: "3", booking_window_time: "06:00" })),
  );
});

test("exactly one field set is refused, not silently ignored", () => {
  assert.ok(
    "error" in parseBookingWindow(form({ org_id: "org-1", booking_window_days_before: "3" })),
  );
  assert.ok(
    "error" in parseBookingWindow(form({ org_id: "org-1", booking_window_time: "06:00" })),
  );
});

test("days before must be a whole number in bounds", () => {
  assert.ok(
    "error" in
      parseBookingWindow(
        form({ org_id: "org-1", booking_window_days_before: "1.5", booking_window_time: "06:00" }),
      ),
  );
  assert.ok(
    "error" in
      parseBookingWindow(
        form({
          org_id: "org-1",
          booking_window_days_before: String(MIN_BOOKING_WINDOW_DAYS_BEFORE - 1),
          booking_window_time: "06:00",
        }),
      ),
  );
  assert.ok(
    "error" in
      parseBookingWindow(
        form({
          org_id: "org-1",
          booking_window_days_before: String(MAX_BOOKING_WINDOW_DAYS_BEFORE + 1),
          booking_window_time: "06:00",
        }),
      ),
  );
});

test("the time must be on the hour grid", () => {
  assert.ok(
    "error" in
      parseBookingWindow(
        form({ org_id: "org-1", booking_window_days_before: "3", booking_window_time: "06:15" }),
      ),
  );
});

test("bookingWindowLabel describes an unset window", () => {
  assert.match(bookingWindowLabel(null), /no booking window/i);
});

test("bookingWindowLabel describes a set window, in the units people think in", () => {
  assert.equal(bookingWindowLabel({ daysBefore: 0, time: "06:00" }), "Opens the same day, at 6:00 AM.");
  assert.equal(bookingWindowLabel({ daysBefore: 1, time: "18:00" }), "Opens 1 day before, at 6:00 PM.");
  assert.equal(bookingWindowLabel({ daysBefore: 3, time: "06:00" }), "Opens 3 days before, at 6:00 AM.");
});

test("formatBookingReminderEmail carries the org, the slot's own time, and a link, HTML-escaped", () => {
  const { subject, html } = formatBookingReminderEmail({
    orgName: "PicklePlex <script>",
    slotWhen: "Sat, Jan 1 at 9:00 AM",
    slotUrl: "https://example.com/booking-buddy/slots/abc",
  });

  assert.match(subject, /PicklePlex <script>/);
  assert.ok(!html.includes("<script>"), "the org's own name must not inject markup");
  assert.match(html, /Sat, Jan 1 at 9:00 AM/);
  assert.match(html, /https:\/\/example\.com\/booking-buddy\/slots\/abc/);
});

/** What a recipient reads: the HTML with every tag (and its attributes) removed. */
function visibleText(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

test("formatBookingReminderEmail leads with bookings opening, then names the game's time", () => {
  const { html } = formatBookingReminderEmail({
    orgName: "Pickleplex Mississauga",
    slotWhen: "Sat, Jan 1 at 9:00 AM",
    slotUrl: "https://example.com/booking-buddy/slots/abc",
  });
  const text = visibleText(html);

  const opened = text.indexOf("Bookings just opened at Pickleplex Mississauga");
  assert.ok(opened >= 0, "the first line says bookings just opened at the facility");
  assert.ok(text.indexOf("Sat, Jan 1 at 9:00 AM") > opened, "the game's time follows it");
});

test("formatBookingReminderEmail has one button, View the game, and never says slot", () => {
  const { html } = formatBookingReminderEmail({
    orgName: "Pickleplex Mississauga",
    slotWhen: "Sat, Jan 1 at 9:00 AM",
    slotUrl: "https://example.com/booking-buddy/slots/abc",
  });

  assert.equal(html.match(/<a /g)?.length, 1);
  assert.match(html, /href="https:\/\/example\.com\/booking-buddy\/slots\/abc"[^>]*>View the game</);
  assert.doesNotMatch(visibleText(html), /slot/i);
});

test("formatBookingReminderEmail shows a facility name with & escaped, not broken", () => {
  const { subject, html } = formatBookingReminderEmail({
    orgName: "Ace & Dink Club",
    slotWhen: "Sat, Jan 1 at 9:00 AM",
    slotUrl: "https://example.com/booking-buddy/slots/abc",
  });

  assert.equal(subject, "Time to book: Ace & Dink Club");
  assert.match(html, /Ace &amp; Dink Club/);
});
