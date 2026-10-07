/**
 * Dates for e2e fixtures, always counted from today. A spec never writes a
 * calendar date by hand: a "future" date typed in as a literal turns into a
 * past one the day the calendar passes it, and every spec that leaned on it
 * fails at once (calendar-feed and sync-bookings did, on 2026-10-02).
 * `scripts/check-e2e-dates.mts` fails `npm test` and CI on any such literal.
 *
 * Everything is on Toronto's clock, the zone a hand-named facility and the
 * CourtReserve fixtures use. The label helpers write a date the way the app
 * does on each surface, so an assertion can name the date it expects.
 */

const ZONE = "America/Toronto";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Read once per worker, so a run that crosses midnight can't hand one test two
 * different "same day" dates (the date it posts and the label it looks for).
 */
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date());

/** `"YYYY-MM-DD"`, `days` after today on Toronto's clock (negative for the past). */
export function torontoDate(days: number): string {
  return shiftDate(TODAY, days);
}

/** A `"YYYY-MM-DD"` date moved by whole calendar days. */
export function shiftDate(date: string, days: number): string {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * The UTC instant for a Toronto wall-clock time, `"2027-03-15T22:00:00Z"` for
 * 6pm that day. Daylight saving is accounted for, so "6pm" stays 6pm in
 * whichever half of the year the date falls.
 */
export function torontoInstant(date: string, time: string): string {
  const wall = Date.parse(`${date}T${time}:00Z`);
  let instant = wall;
  // Twice: the offset read at the first guess can be the other side of a change.
  for (let i = 0; i < 2; i++) {
    instant = wall - torontoOffsetMs(instant);
  }
  return new Date(instant).toISOString().replace(".000Z", "Z");
}

function torontoOffsetMs(at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallAsUtc - at;
}

function parts(date: string) {
  const at = new Date(`${date}T00:00:00Z`);
  return {
    weekday: WEEKDAYS[at.getUTCDay()],
    month: MONTHS[at.getUTCMonth()],
    monthNumber: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
    year: at.getUTCFullYear(),
  };
}

/** `"Monday"` */
export function weekdayName(date: string): string {
  return parts(date).weekday;
}

/** `"Mon Mar 15, 2027"`: a sync review card (`formatCandidateDate`). */
export function candidateLabel(date: string): string {
  const { weekday, month, day, year } = parts(date);
  return `${weekday.slice(0, 3)} ${month.slice(0, 3)} ${String(day).padStart(2, "0")}, ${year}`;
}

/** `"Mar 3, 2031"`: the distinctive part of a game's or Booking's "when" row. */
export function dayLabel(date: string): string {
  const { month, day, year } = parts(date);
  return `${month.slice(0, 3)} ${day}, ${year}`;
}

/** `"Mar 17"` */
export function monthDayLabel(date: string): string {
  const { month, day } = parts(date);
  return `${month.slice(0, 3)} ${day}`;
}

/** `"March 17, 2027"` */
export function longDateLabel(date: string): string {
  const { month, day, year } = parts(date);
  return `${month} ${day}, ${year}`;
}

/** `"3-15-2027"`: how a CourtReserve email body writes a date. */
export function courtReserveDate(date: string): string {
  const { monthNumber, day, year } = parts(date);
  return `${monthNumber}-${day}-${year}`;
}
