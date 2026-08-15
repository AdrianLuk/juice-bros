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
