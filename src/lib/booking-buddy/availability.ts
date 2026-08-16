/**
 * Pure logic for resolving a User's Availability at a moment (see
 * CONTEXT.md, ADR 0006).
 *
 * Per ADR 0006 the layered read lives here, in application code, over
 * pre-fetched rows — `availability_windows` carries no overlap constraint, so
 * there is no single-row lookup to fall back on. Kept free of Next.js and
 * Supabase imports so it can be unit tested directly, matching visibility.ts.
 */

export type AvailabilityType = "open" | "busy";
export type ResolvedAvailability = AvailabilityType | "unspecified";

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
