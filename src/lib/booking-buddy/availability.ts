/**
 * Pure logic for resolving a User's Availability at a moment (see
 * CONTEXT.md, ADR 0006), plus input handling for declaring one.
 *
 * Per ADR 0006 the layered read lives here, in application code, over
 * pre-fetched rows — `availability_windows` carries no overlap constraint, so
 * there is no single-row lookup to fall back on. Kept free of Next.js and
 * Supabase imports so it can be unit tested directly, matching visibility.ts.
 */

import {
  clockInZone,
  formatTimeLabel,
  isHalfHourTime,
  isRealDate,
  previousCalendarDate,
  todayInZone,
} from "./datetime.ts";

export type AvailabilityType = "open" | "busy";
export type ResolvedAvailability = AvailabilityType | "unspecified";

const AVAILABILITY_TYPES: readonly AvailabilityType[] = ["open", "busy"];

/** Defaults a form that omits/mangles the field to `busy` — declaring time off is the common case this form exists for. */
const DEFAULT_AVAILABILITY_TYPE: AvailabilityType = "busy";

export function isAvailabilityType(value: unknown): value is AvailabilityType {
  return AVAILABILITY_TYPES.includes(value as AvailabilityType);
}

/** A Booking or a confirmed Slot (one with a Booking attached) — either always wins as busy. */
export type BusyInterval = {
  startsAt: string;
  endsAt: string;
};

export type AvailabilityWindow = {
  type: AvailabilityType;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

function covers(startsAt: string, endsAt: string, atMs: number): boolean {
  return new Date(startsAt).getTime() <= atMs && atMs < new Date(endsAt).getTime();
}

/**
 * What a User's calendar reads at `at`, in order: a Booking or confirmed Slot
 * covering it always wins as busy, regardless of any Availability Window over
 * the same span; otherwise the most recently *created* Availability Window
 * covering it wins; otherwise the moment is unspecified.
 *
 * `busyIntervals` and `windows` are expected pre-fetched and pre-scoped to one
 * owner — this function only does the temporal layering, not the database
 * read or the owner filter.
 */
export function resolveAvailability({
  at,
  busyIntervals,
  windows,
}: {
  at: Date;
  busyIntervals: BusyInterval[];
  windows: AvailabilityWindow[];
}): ResolvedAvailability {
  const atMs = at.getTime();

  const isBusy = busyIntervals.some((interval) =>
    covers(interval.startsAt, interval.endsAt, atMs),
  );
  if (isBusy) {
    return "busy";
  }

  const covering = windows.filter((window) =>
    covers(window.startsAt, window.endsAt, atMs),
  );
  if (covering.length === 0) {
    return "unspecified";
  }

  const winner = covering.reduce((mostRecent, window) =>
    new Date(window.createdAt).getTime() > new Date(mostRecent.createdAt).getTime()
      ? window
      : mostRecent,
  );
  return winner.type;
}

export type AvailabilitySegment = {
  type: AvailabilityType;
  startsAt: string;
  endsAt: string;
};

function clamp(ms: number, min: number, max: number): number {
  return Math.min(Math.max(ms, min), max);
}

/**
 * The same resolution `resolveAvailability` does at a single moment, spread
 * across a visible calendar range as a list of open/busy segments — what the
 * dashboard calendar (issue #23) actually draws.
 *
 * A busy-covered span is never returned as a segment at all, even though
 * `resolveAvailability` would report it "busy": the calendar already draws a
 * Booking block for that exact span, and this is what keeps the grid from
 * drawing a second, redundant Availability block underneath it (ADR 0006 —
 * "never both"). `unspecified` stretches are omitted for the same reason
 * `resolveAvailability` reports them at all — there's nothing to draw.
 *
 * Implemented as a plain sweep over every interval's own start/end (clamped
 * into range) rather than a fixed sampling grid, so a change that lands
 * between two half-hour marks is never missed and no interval is ever split
 * more finely than its own boundaries require.
 */
export function resolveAvailabilitySegments({
  rangeStart,
  rangeEnd,
  busyIntervals,
  windows,
}: {
  rangeStart: Date;
  rangeEnd: Date;
  busyIntervals: BusyInterval[];
  windows: AvailabilityWindow[];
}): AvailabilitySegment[] {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  if (rangeEndMs <= rangeStartMs) {
    return [];
  }

  const boundaries = new Set<number>([rangeStartMs, rangeEndMs]);
  for (const interval of [...busyIntervals, ...windows]) {
    boundaries.add(clamp(new Date(interval.startsAt).getTime(), rangeStartMs, rangeEndMs));
    boundaries.add(clamp(new Date(interval.endsAt).getTime(), rangeStartMs, rangeEndMs));
  }

  const sorted = [...boundaries].sort((a, b) => a - b);

  const segments: AvailabilitySegment[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) {
      continue;
    }

    const mid = start + (end - start) / 2;
    const coveredByBusy = busyIntervals.some((interval) =>
      covers(interval.startsAt, interval.endsAt, mid),
    );
    if (coveredByBusy) {
      continue;
    }

    const state = resolveAvailability({ at: new Date(mid), busyIntervals: [], windows });
    if (state === "unspecified") {
      continue;
    }

    const last = segments.at(-1);
    if (last && last.type === state && new Date(last.endsAt).getTime() === start) {
      last.endsAt = new Date(end).toISOString();
    } else {
      segments.push({ type: state, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() });
    }
  }

  return segments;
}

export type NewAvailabilityWindow = {
  type: AvailabilityType;
  /** Both inclusive, `YYYY-MM-DD` — a whole week off is one window, `fromDate` through `toDate` (CONTEXT.md). */
  fromDate: string;
  toDate: string;
  /** `null` for both means all day — `fromDate`'s zone-local midnight through the day after `toDate`'s. Otherwise `startTime` lands on `fromDate` and `endTime` on `toDate`, same shape as a Booking's own half-hour picker. */
  startTime: string | null;
  endTime: string | null;
};

/**
 * A from/to date, whole calendar days by default — matching the CONTEXT.md
 * example this form exists for ("a whole week off") — with an "all day"
 * checkbox that reveals a from/to *time* pair for a shorter, timed stretch
 * (e.g. "busy tonight 6–9pm"). The action that writes this converts an
 * all-day `toDate` to the exclusive end (`nextCalendarDate`) the row
 * actually stores; a timed one is written as-is, `fromDate`+`startTime`
 * through `toDate`+`endTime`.
 */
export function parseNewAvailabilityWindow(
  formData: FormData,
): NewAvailabilityWindow | { error: string } {
  const rawType = formData.get("type");
  const type = isAvailabilityType(rawType) ? rawType : DEFAULT_AVAILABILITY_TYPE;

  const fromDate = String(formData.get("from_date") ?? "").trim();
  if (!isRealDate(fromDate)) {
    return { error: "Pick a start date." };
  }

  const toDate = String(formData.get("to_date") ?? "").trim();
  if (!isRealDate(toDate)) {
    return { error: "Pick an end date." };
  }

  if (toDate < fromDate) {
    return { error: "The end date has to be on or after the start date." };
  }

  // A checkbox is present in FormData (with whatever value it carries) only
  // when checked — entirely absent, not `"false"`, when it isn't.
  const allDay = formData.get("all_day") !== null;
  if (allDay) {
    return { type, fromDate, toDate, startTime: null, endTime: null };
  }

  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();

  if (!isHalfHourTime(startTime) || !isHalfHourTime(endTime)) {
    return { error: "Pick a start and end time, or mark it all day." };
  }

  // Cross-day spans (Friday evening through Saturday morning) are valid even
  // when the end clock time reads earlier than the start's — the date order
  // already checked above is what actually decides that case.
  if (toDate === fromDate && endTime <= startTime) {
    return { error: "The end time has to be after the start time." };
  }

  return { type, fromDate, toDate, startTime, endTime };
}

/**
 * Turns a failed Availability Window write into something worth reading.
 *
 * `23514` is `availability_window_ends_after_start` — the one check
 * constraint on this table. `parseNewAvailabilityWindow`'s own `toDate <
 * fromDate` check should catch this first; reaching the database with it
 * anyway means the form and the schema have drifted apart.
 */
export function availabilityWriteMessage(error: { code?: string }): string {
  if (error.code !== "23514") {
    return "Couldn't save that. Try again.";
  }

  return "The end date has to be on or after the start date.";
}

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** `"2026-08-24"` → `"Aug 24"` — `timeZone: "UTC"` on a `T00:00:00Z` instant is what keeps this from re-shifting the date it's handed. */
function formatDateLabel(date: string): string {
  return DATE_LABEL_FORMATTER.format(new Date(`${date}T00:00:00Z`));
}

/**
 * `"Aug 24 – Aug 30"` for an all-day window, or `"Aug 24 · 6:00 PM – 9:00 PM"`
 * / `"Aug 22 6:00 PM – Aug 24 9:00 AM"` for a timed one.
 *
 * "All day" isn't stored as its own flag — a window reads as one when both
 * ends land on zone-local midnight, the same shape `createAvailabilityWindow`
 * writes for the all-day path. When it does, the last displayed day is
 * `previousCalendarDate` of `endsAt`'s zone-local date, not that date itself
 * — `endsAt` is the exclusive next-day-midnight boundary, so a window through
 * Sunday would otherwise read as running through Monday.
 */
export function formatAvailabilityWindowRange(
  window: { startsAt: string; endsAt: string },
  timeZone: string,
): string {
  const startInstant = new Date(window.startsAt);
  const endInstant = new Date(window.endsAt);

  const startClock = clockInZone(timeZone, startInstant);
  const endClock = clockInZone(timeZone, endInstant);
  const allDay = startClock === "00:00" && endClock === "00:00";

  const fromDate = todayInZone(timeZone, startInstant);
  const toDate = allDay
    ? previousCalendarDate(todayInZone(timeZone, endInstant))
    : todayInZone(timeZone, endInstant);

  const fromLabel = formatDateLabel(fromDate);
  const toLabel = formatDateLabel(toDate);
  const dateRange = fromDate === toDate ? fromLabel : `${fromLabel} – ${toLabel}`;

  if (allDay) {
    return dateRange;
  }

  const timeRange = `${formatTimeLabel(startClock)} – ${formatTimeLabel(endClock)}`;
  return fromDate === toDate ? `${fromLabel} · ${timeRange}` : `${fromLabel} ${formatTimeLabel(startClock)} – ${toLabel} ${formatTimeLabel(endClock)}`;
}
