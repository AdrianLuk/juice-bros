/**
 * Date/half-hour-time parsing and formatting shared by anything that asks a
 * User to pick a calendar date and a court-style time — currently Bookings
 * and Slots. Split out of `bookings.ts` when Slots needed the same rules
 * (issue #8), rather than a second copy of the regexes drifting from it.
 *
 * Free of Next.js and Supabase imports on purpose, same as its callers.
 */

import { isKnownTimeZone } from "./timezone.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Half-hour boundaries only. Courts are booked in half-hour chunks, not
// whatever a free-typed or click-dragged time picker happens to land on — a
// "6:23 PM" reservation isn't a real one anyone could have made.
const TIME_PATTERN = /^([01]\d|2[0-3]):(00|30)$/;

/** A calendar date, not merely four digits and two hyphens. */
export function isRealDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  // Round-tripping is what catches 2026-13-01 and 2026-02-30, which the
  // pattern alone is happy with.
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
  );
}

export function isHalfHourTime(time: string): boolean {
  return TIME_PATTERN.test(time);
}

/** "Today" as a `YYYY-MM-DD` string in `zone`, at instant `now` — `en-CA` happens to format that way natively. */
export function todayInZone(zone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
}

/**
 * A coarse, calendar-day-only "is this obviously already gone" check for a
 * `YYYY-MM-DD` date a User picked — not exact instant precision, which is
 * the database trigger's job (`slots_not_in_the_past`/`bookings_not_in_the_past`).
 * This only ever rejects a date that is a full day or more in the past, so it
 * can never falsely reject a date that is genuinely still today or later —
 * same-day-but-already-passed-hour is a real case this doesn't catch, and
 * isn't meant to: it exists to save the round trip for the obvious mistake,
 * not to duplicate the trigger's exactness.
 */
export function isPastDate(date: string, zone: string, now: Date): boolean {
  return date < todayInZone(zone, now);
}

/**
 * Every half-hour slot in a day, `"00:00"` through `"23:30"` — what a start
 * or end picker offers. A `<select>` rather than `<input type="time">` so a
 * User physically cannot choose anything off the half-hour grid; the pattern
 * above is the server-side backstop for a request built by hand.
 */
export const HALF_HOUR_TIMES: readonly string[] = Array.from(
  { length: 48 },
  (_, index) =>
    `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`,
);

/** `"18:30"` → `"6:30 PM"`, for the option labels — the value posted is still 24-hour. */
export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours < 12 ? "AM" : "PM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * When an instant range falls, written as the zone it was created in —
 * shared by `formatBookingWhen` and `formatSlotWhen`. `startsAt`/`endsAt` are
 * instants, so rendering them needs to be told which clock to use, or the
 * server's own zone (UTC in production) reads back a different hour than
 * whoever created the row meant.
 *
 * A zone Postgres doesn't know shouldn't reach here — the trigger on both
 * `bookings` and `slots` refuses it at write time — but falling back to UTC
 * and saying so beats throwing and taking down the whole list to punish one
 * row.
 */
export function formatInstantRange({
  startsAt,
  endsAt,
  timeZone,
}: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
}): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const usable = isKnownTimeZone(timeZone);
  const zone = usable ? timeZone : "UTC";

  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: zone,
  });

  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  });

  const when = `${day.format(start)} · ${clock.format(start)} – ${clock.format(end)}`;

  return usable ? when : `${when} (UTC)`;
}
