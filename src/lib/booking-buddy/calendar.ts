/**
 * Pure date/grid math for the dashboard calendar (issue #23) — Week/Month
 * range bounds, the Month view's 6-week cell grid, and the overlap layout
 * that decides how many columns wide a day's Week-view blocks are.
 *
 * Deliberately hand-rolled rather than a calendar library (the ticket's own
 * call — the actual need doesn't justify the dependency), and free of
 * Next.js/DOM imports so it can be unit tested directly, matching
 * availability.ts and visibility.ts.
 *
 * Every function that needs "today" takes it as a `now: Date` parameter
 * rather than reading `new Date()` itself, the same discipline
 * `isPastDate`/`todayInZone` already use — determinism over convenience.
 *
 * All date math here is calendar-day arithmetic in whatever local time zone
 * the `Date` objects themselves carry — i.e. the browser's, since this module
 * only ever runs client-side. That's the point: the ticket asks the grid to
 * position Bookings in the viewer's browser-local time, not any facility's.
 */

export type CalendarView = "month" | "week" | "agenda";

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Adds calendar months, clamping the day-of-month to the target month's last
 * day instead of letting `Date.prototype.setMonth` roll it into the month
 * after (issue #67) — e.g. Oct 31 + 1 month lands on Nov 30, not Dec 1.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));
  return result;
}

/**
 * Whether `day` falls on a calendar day strictly before `now`'s — compared in
 * whatever local zone the `Date`s carry (the browser's, like the rest of this
 * module). Drives the calendar quick-create `+` suppression (issue #303): a
 * past day gets no affordance at all, independent of the friend calendar's
 * `restrictToFuture`, which stays off for the owner.
 */
export function isPastDay(day: Date, now: Date): boolean {
  return startOfDay(day).getTime() < startOfDay(now).getTime();
}

/** Sunday through Saturday — the week the given date falls in. */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

export function startOfMonth(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

/**
 * The 42 cells (6 weeks × 7 days) a Month view renders, including the
 * trailing days of the previous/next month that fill out the first and last
 * weeks — a User's Bookings never land only on days that belong to the
 * "current" month by the calendar's own arithmetic.
 */
export function monthGridDays(date: Date): Date[] {
  const firstOfMonth = startOfMonth(date);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

/**
 * The hour band a Week-column click at `offsetPx` down from the day's 00:00
 * lands in — `Math.floor(offsetPx / hourHeight)`, the hour the pointer is
 * *within*, not the nearest boundary (issue #303). Clamped to `0..23` so a
 * click in the grid's bottom padding, or above hour 0, still resolves to a
 * real hour. Bookings are on-the-hour only, so the caller turns this into an
 * `HH:00` prefill.
 */
export function hourFromOffset(offsetPx: number, hourHeight: number): number {
  return Math.max(0, Math.min(23, Math.floor(offsetPx / hourHeight)));
}

/**
 * Which of a day's 24 hour bands already hold a Booking, in browser-local
 * time — the Week view's quick-create `+` is suppressed on these (issue
 * #303), leaving it only on the genuinely empty rows. Any overlap claims a
 * band: a 6:30–7:30 Booking occupies both hour 6 and hour 7, and a Booking
 * ending exactly on the hour (7:00) does not reach into hour 7. Events are
 * clamped to the day first, so a session that ran past midnight marks hour
 * 23 on its start day and the early hours on the next.
 */
export function bookedDayHours<T extends TimeSpan>(
  events: T[],
  day: Date,
): Set<number> {
  const dayStartMs = startOfDay(day).getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const hours = new Set<number>();

  for (const event of events) {
    const startMs = new Date(event.startsAt).getTime();
    const endMs = new Date(event.endsAt).getTime();
    if (startMs >= dayEndMs || endMs <= dayStartMs) {
      continue;
    }

    const fromHour = Math.floor(
      (Math.max(startMs, dayStartMs) - dayStartMs) / 3_600_000,
    );
    // `ceil - 1`: an end landing exactly on an hour boundary occupies the
    // band below it, not the one it touches.
    const toHour = Math.ceil(
      (Math.min(endMs, dayEndMs) - dayStartMs) / 3_600_000,
    ) - 1;

    for (let hour = Math.max(0, fromHour); hour <= Math.min(23, toHour); hour++) {
      hours.add(hour);
    }
  }

  return hours;
}

/** Every half-hour-aligned hour boundary a Week view's timeline draws rows for. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export type TimeSpan = {
  startsAt: string;
  endsAt: string;
};

/**
 * What every calendar shell component (`DashboardCalendar` and its
 * Week/Month/Agenda views, issue #23/#61) needs from an "event," regardless
 * of whether it's a full owner Booking or a friend's stripped busy time — a
 * single alias so the constraint lives in one place instead of being
 * hand-repeated as `TimeSpan & { id: string }` in every generic signature.
 */
export type CalendarEvent = TimeSpan & { id: string };

export type LaidOutEvent<T extends TimeSpan> = {
  event: T;
  /** 0-indexed column this event occupies among its overlap group. */
  column: number;
  /** How many columns wide the overlap group it belongs to is. */
  columns: number;
};

/**
 * Assigns each event in a single day a column and a column count, so
 * time-overlapping events render side by side instead of on top of each
 * other. A User's own Bookings rarely overlap, but nothing stops two
 * being logged for the same window at different facilities.
 *
 * Greedy interval-graph coloring: process events by start time, give each the
 * lowest-numbered column not already occupied by a still-open event, and once
 * every event in a mutually-overlapping run has been placed, stamp all of
 * them with that run's column count. Deterministic given a stable input
 * order — ties at the same start time keep the order they arrived in.
 */
export function layoutDayEvents<T extends TimeSpan>(
  events: T[],
): LaidOutEvent<T>[] {
  const sorted = [...events]
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const byStart =
        new Date(a.event.startsAt).getTime() -
        new Date(b.event.startsAt).getTime();
      return byStart !== 0 ? byStart : a.index - b.index;
    });

  const results: LaidOutEvent<T>[] = [];
  // Events in the overlap run currently open, each holding the column it was
  // assigned — cleared out (and its max column count stamped onto every
  // member) whenever a new event starts after all of them have ended.
  let openGroup: { result: LaidOutEvent<T>; endsAtMs: number }[] = [];

  const closeGroup = () => {
    const columns =
      Math.max(0, ...openGroup.map((entry) => entry.result.column)) + 1;
    for (const entry of openGroup) {
      entry.result.columns = columns;
    }
    openGroup = [];
  };

  for (const { event } of sorted) {
    const startMs = new Date(event.startsAt).getTime();
    const endMs = new Date(event.endsAt).getTime();

    const stillOpen = openGroup.filter((entry) => entry.endsAtMs > startMs);
    if (stillOpen.length === 0 && openGroup.length > 0) {
      closeGroup();
    } else {
      openGroup = stillOpen;
    }

    const occupied = new Set(openGroup.map((entry) => entry.result.column));
    let column = 0;
    while (occupied.has(column)) {
      column++;
    }

    const result: LaidOutEvent<T> = { event, column, columns: 1 };
    results.push(result);
    openGroup.push({ result, endsAtMs: endMs });
  }

  closeGroup();

  return results;
}

export type DaySpan<T extends TimeSpan> = {
  event: T;
  /** This grid day is the actual first day `event` covers — gets the rounded left cap and the visible label. */
  isStart: boolean;
  /** This grid day is the actual last day `event` covers — gets the rounded right cap. */
  isEnd: boolean;
};

/**
 * Every grid day an event's span touches, keyed by `localDayKey` — unlike
 * `groupByLocalDay`, which only ever buckets an item under its own start day.
 * What the Month view's multi-day Availability bars need: a bar spanning
 * several cells has to render (and visually connect) in each one, not just
 * appear once on the day it started.
 *
 * `isStart`/`isEnd` are what let the Month view tell a day the bar merely
 * passes through apart from the day it actually begins or ends on — the
 * former gets full-bleed edges that touch the next cell's bar with no gap
 * (reading as one continuous strip), the latter gets a rounded cap and, for
 * `isStart`, the visible label.
 */
export function layoutMultiDaySpans<T extends TimeSpan>(
  days: Date[],
  events: T[],
): Map<string, DaySpan<T>[]> {
  const result = new Map<string, DaySpan<T>[]>();

  for (const day of days) {
    const dayStartMs = startOfDay(day).getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

    const touching: DaySpan<T>[] = [];
    for (const event of events) {
      const startMs = new Date(event.startsAt).getTime();
      const endMs = new Date(event.endsAt).getTime();
      if (startMs < dayEndMs && endMs > dayStartMs) {
        touching.push({
          event,
          isStart: startMs >= dayStartMs,
          isEnd: endMs <= dayEndMs,
        });
      }
    }

    if (touching.length > 0) {
      result.set(localDayKey(day), touching);
    }
  }

  return result;
}

/** `"2026-08-16"`-style key for the browser-local calendar day a `Date` falls on — grouping key, not a display string. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Buckets items by the browser-local calendar day `getDate` reports for
 * them — shared by the Month grid (which entries does this cell list) and
 * the Agenda view (which day-group does this row fall under), so the two
 * views agree on what "the same day" means without each re-deriving it.
 */
export function groupByLocalDay<T>(
  items: T[],
  getDate: (item: T) => Date,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = localDayKey(getDate(item));
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

/** Future Bookings only, soonest-first, capped — the upcoming-bookings sidebar. */
export function upcomingBookings<T extends { startsAt: string }>(
  bookings: T[],
  now: Date,
  limit: number,
): T[] {
  const nowMs = now.getTime();
  return bookings
    .filter((booking) => new Date(booking.startsAt).getTime() >= nowMs)
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * Items that haven't fully ended before `floor` — what `DashboardCalendar`'s
 * `restrictToFuture` (issue #61) filters both events and Availability
 * Windows through, so a friend's calendar never renders busy/looking-to-play time from
 * before today, even within the currently-displayed week or month, which
 * always renders as a full grid (past days included) regardless of how far
 * back navigation itself is allowed to go.
 *
 * `endsAt`, not `startsAt`: an item straddling `floor` (started yesterday
 * evening, still running this morning) is still relevant today and should
 * stay — the same "any overlap counts" reasoning the Week view's own day-
 * boundary filter already uses.
 */
export function notEndedBefore<T extends { endsAt: string }>(
  items: T[],
  floor: Date,
): T[] {
  const floorMs = floor.getTime();
  return items.filter((item) => new Date(item.endsAt).getTime() > floorMs);
}

const WEEKDAY_MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** e.g. "Aug 16 – 22, 2026", or "Dec 28, 2026 – Jan 3, 2027" across a year boundary. */
export function weekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);

  if (weekStart.getFullYear() !== weekEnd.getFullYear()) {
    return `${MONTH_DAY_YEAR.format(weekStart)} – ${MONTH_DAY_YEAR.format(weekEnd)}`;
  }

  if (weekStart.getMonth() !== weekEnd.getMonth()) {
    return `${MONTH_DAY.format(weekStart)} – ${MONTH_DAY_YEAR.format(weekEnd)}`;
  }

  return `${MONTH_DAY.format(weekStart)} – ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
}

export function monthLabel(date: Date): string {
  return MONTH_YEAR.format(date);
}

export function dayLabel(date: Date): string {
  return WEEKDAY_MONTH_DAY.format(date);
}
