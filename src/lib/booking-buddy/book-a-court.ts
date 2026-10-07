/**
 * Which of the organizer's own games still need a court booked now that
 * their facility's Booking Window is open (issue #573). The in-app partner of
 * the Booking Reminder email: the email lands on time once, this catches the
 * organizer whenever they next open the app.
 *
 * Pure, relative imports only, so it runs under `node --test`.
 *
 * "Open" is the `slot_booking_windows` view's rule done as a wall-clock
 * comparison in the facility's own zone: the game's local start date, minus
 * the window's days before, at the window's time of day. Comparing wall
 * clocks rather than instants is what keeps the window at the facility's
 * stated local time across a daylight-saving change.
 */

import type { BookingWindow } from "./booking-window.ts";
import {
  clockInZone,
  formatShortDateLabel,
  formatTimeLabel,
  shiftCalendarDate,
  todayInZone,
} from "./datetime.ts";

export type CourtlessSlot = {
  id: string;
  proposedStart: string;
  /** The game's own zone, which decides its local start date. */
  timeZone: string;
  /** Whether any Booking is attached to the game already. */
  hasBooking: boolean;
  /** The facility the organizer plans to book, if they've said. */
  intendedOrg: {
    name: string;
    timeZone: string;
    bookingWindow: BookingWindow | null;
  } | null;
};

export type BookACourtNotice<S extends CourtlessSlot = CourtlessSlot> = {
  slot: S;
  orgName: string;
  /** The window's opening time of day, facility-local: `"07:00"`. */
  openedAt: string;
  /** Whole facility-local calendar days since the window opened; 0 is today. */
  openedDaysAgo: number;
};

/**
 * Every game that needs "Book a court" at `now`, soonest game first: window
 * open, no Booking attached, not started yet, an Intended Org with a Booking
 * Window. Nothing else counts (not Responses, not Capacity).
 */
export function slotsNeedingACourt<S extends CourtlessSlot>(
  slots: readonly S[],
  now: Date,
): BookACourtNotice<S>[] {
  const soonestFirst = [...slots].sort(
    (a, b) => new Date(a.proposedStart).getTime() - new Date(b.proposedStart).getTime(),
  );
  return soonestFirst.flatMap((slot) => {
    const org = slot.intendedOrg;
    const window = org?.bookingWindow;
    const started = new Date(slot.proposedStart).getTime() <= now.getTime();
    if (!org || !window || slot.hasBooking || started) {
      return [];
    }
    const gameDate = todayInZone(slot.timeZone, new Date(slot.proposedStart));
    const opensOn = shiftCalendarDate(gameDate, -window.daysBefore);
    const facilityToday = todayInZone(org.timeZone, now);
    if (`${facilityToday} ${clockInZone(org.timeZone, now)}` < `${opensOn} ${window.time}`) {
      return [];
    }
    return [
      {
        slot,
        orgName: org.name,
        openedAt: window.time,
        openedDaysAgo: calendarDaysBetween(opensOn, facilityToday),
      },
    ];
  });
}

/** "Book a court for Tue, Oct 20 at 8:00 PM": which game, in its own zone. */
export function bookACourtHeading(notice: BookACourtNotice): string {
  const start = new Date(notice.slot.proposedStart);
  const day = formatShortDateLabel(todayInZone(notice.slot.timeZone, start));
  const time = formatTimeLabel(clockInZone(notice.slot.timeZone, start));
  return `Book a court for ${day} at ${time}`;
}

/** Where, and how long ago, so "just opened" reads differently from "the courts are probably gone". */
export function bookingsOpenedLabel(notice: BookACourtNotice): string {
  const when =
    notice.openedDaysAgo === 0
      ? `today at ${formatTimeLabel(notice.openedAt)}`
      : notice.openedDaysAgo === 1
        ? "yesterday"
        : `${notice.openedDaysAgo} days ago`;
  return `${notice.orgName} opened bookings ${when}.`;
}

function calendarDaysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}
