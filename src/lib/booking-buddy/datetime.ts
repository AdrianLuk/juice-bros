/**
 * Date/hour-time parsing and formatting shared by anything that asks a
 * User to pick a calendar date and a court-style time — currently Bookings
 * and Slots. Split out of `bookings.ts` when Slots needed the same rules
 * (issue #8), rather than a second copy of the regexes drifting from it.
 *
 * Free of Next.js and Supabase imports on purpose, same as its callers.
 */

import { isKnownTimeZone } from "./timezone.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// On-the-hour boundaries only. Courts are booked in hour-long chunks, not
// whatever a free-typed or click-dragged time picker happens to land on — a
// "6:23 PM" reservation isn't a real one anyone could have made.
const TIME_PATTERN = /^([01]\d|2[0-3]):00$/;

/** A calendar date, not merely four digits and two hyphens. */
export function isRealDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  // Round-tripping is what catches 2026-13-01 and 2026-02-30, which the
  // pattern alone is happy with.
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

export function isHourTime(time: string): boolean {
  return TIME_PATTERN.test(time);
}

/**
 * `date` shifted by `deltaDays` calendar days — UTC-based like `isRealDate`'s
 * own round-trip check, since this is calendar-day arithmetic on a date-only
 * string, not an instant.
 */
function shiftCalendarDate(date: string, deltaDays: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return parsed.toISOString().slice(0, 10);
}

/** Turns an inclusive "last day" a User picked into the exclusive end an `availability_windows` row actually stores. */
export function nextCalendarDate(date: string): string {
  return shiftCalendarDate(date, 1);
}

/** The inverse of `nextCalendarDate` — turns a stored exclusive end back into the inclusive last day to display. */
export function previousCalendarDate(date: string): string {
  return shiftCalendarDate(date, -1);
}

/** "Today" as a `YYYY-MM-DD` string in `zone`, at instant `now` — `en-CA` happens to format that way natively. */
export function todayInZone(zone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
}

/**
 * The zone-local time of day for `at`, as a zero-padded 24-hour `"HH:MM"` —
 * `todayInZone`'s time-of-day counterpart, used to tell an all-day
 * Availability Window (zone-local midnight to zone-local midnight) apart from
 * a timed one when rendering it back. `hourCycle: "h23"` is load-bearing:
 * without it, some engines render midnight as `"24:00"` rather than `"00:00"`.
 */
export function clockInZone(zone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
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
 * Every on-the-hour slot in a day, `"00:00"` through `"23:00"` — what a start
 * or end picker offers. A `<select>` rather than `<input type="time">` so a
 * User physically cannot choose anything off the hour grid; the pattern
 * above is the server-side backstop for a request built by hand.
 */
export const HOUR_TIMES: readonly string[] = Array.from(
  { length: 24 },
  (_, index) => `${String(index).padStart(2, "0")}:00`,
);

/**
 * `startTime` shifted forward by a whole number of hours — what a duration
 * picker (1/2/3 hours, or a custom count) turns into an End time without
 * making the User pick one off the grid themselves. `null` when `hours` isn't
 * a positive whole number or the result would run past `"23:00"`: a Booking
 * can't cross midnight (see `parseNewBooking`), so there's no valid End to show.
 */
export function addHoursToTime(
  startTime: string,
  hours: number,
): string | null {
  if (!isHourTime(startTime) || !Number.isInteger(hours) || hours <= 0) {
    return null;
  }

  const startHour = Number(startTime.slice(0, 2));
  const endHour = startHour + hours;
  return endHour <= 23 ? `${String(endHour).padStart(2, "0")}:00` : null;
}

/** `"18:30"` → `"6:30 PM"`, for the option labels — the value posted is still 24-hour. */
export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours < 12 ? "AM" : "PM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * An instant, read in the browser's own local clock — what the dashboard
 * calendar's grid (issue #23) positions events by, and the one shared clock
 * label every calendar block/popover on both the owner's and a friend's
 * calendar (issue #61) reads from, rather than each caller re-deriving its
 * own `Intl.DateTimeFormat`/`getHours()` pair.
 */
export function formatTimeLabelFromMs(ms: number): string {
  const date = new Date(ms);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return formatTimeLabel(time);
}

/**
 * A soft "when" cue for an upcoming instant, relative to `now`, read in the
 * viewer's own local clock: "Today", "Tonight" (a same-day start at or after
 * 5pm), "Tomorrow", or `null` for anything further out or already past. Not a
 * precise countdown — wherever this badge sits, the exact date and time are
 * already shown next to it. Shared by the dashboard's "Coming up" sidebar
 * and the Bookings page's "Booked" list.
 */
export function imminenceLabel(now: Date, startsAt: string): string | null {
  const start = new Date(startsAt);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offsetDays = Math.round(
    (startOfDay(start).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (offsetDays === 0) {
    return start.getHours() >= 17 ? "Tonight" : "Today";
  }
  if (offsetDays === 1) {
    return "Tomorrow";
  }
  return null;
}

/**
 * The date and time-range parts of an instant range, written as the zone it
 * was created in, split apart rather than joined — what the calendar
 * popover's own two-line "When" needs, and what `formatInstantRange` below
 * joins back into one line for a plain list row. `startsAt`/`endsAt` are
 * instants, so rendering them needs to be told which clock to use, or the
 * server's own zone (UTC in production) reads back a different hour than
 * whoever created the row meant.
 *
 * A zone Postgres doesn't know shouldn't reach here — the trigger on both
 * `bookings` and `slots` refuses it at write time — but falling back to UTC
 * and saying so (on the date, since that's the part a misread zone could
 * actually put on the wrong day) beats throwing and taking down the whole
 * list to punish one row.
 */
export function formatInstantDateAndTime({
  startsAt,
  endsAt,
  timeZone,
}: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
}): { date: string; time: string } {
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

  return {
    date: usable ? day.format(start) : `${day.format(start)} (UTC)`,
    time: `${clock.format(start)} – ${clock.format(end)}`,
  };
}

/** `formatInstantDateAndTime`'s date and time joined onto one line — what a plain list row (`formatBookingWhen`, `formatSlotWhen`) wants instead of the popover's own two. */
export function formatInstantRange(args: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
}): string {
  const { date, time } = formatInstantDateAndTime(args);
  return `${date} · ${time}`;
}
