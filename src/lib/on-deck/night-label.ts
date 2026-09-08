/**
 * Naming a past night (issue #469).
 *
 * A `timestamptz` is an instant, and an instant has no date until you say
 * whose clock. On Deck never had to answer that before: every surface up to
 * now is read *during* the Session it describes, where "tonight" needs no
 * date and a wait is a duration. A Summary is read the morning after.
 *
 * So the Club carries a zone (see the `20260908120000` migration) and a
 * Session snapshots it at creation, the way it already snapshots venue and
 * court count. This formats against that snapshot rather than against the
 * server's clock, which is UTC in production — and TO Pickleball Club plays
 * 18:00 to 20:00, which in Toronto ends at 00:00 UTC in summer and starts at
 * 23:00 in winter. Formatting in UTC would not mislabel an edge case there;
 * it would mislabel the normal case.
 *
 * A zone that is missing or unrenderable falls back to UTC rather than
 * throwing. A Summary with a date that is off by a day is a bad page; a
 * Summary that will not render is a worse one, and the numbers below the
 * heading are the reason anyone opened it.
 */

function formatter(timeZone: string, withYear: boolean): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
    ...(withYear ? { year: "numeric" as const } : {}),
  };

  try {
    return new Intl.DateTimeFormat("en-CA", options);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
  }
}

/**
 * "Saturday, September 5" for a night's start, on the Club's own clock.
 * Returns an empty string for an unparseable timestamp rather than "Invalid
 * Date", so a bad row shows a name that is merely missing instead of one that
 * looks like a crash.
 */
export function nightLabel(isoTimestamp: string, timeZone: string): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return "";
  return formatter(timeZone, false).format(at);
}

/** The same, carrying the year — for a single night's own page. */
export function nightLabelWithYear(
  isoTimestamp: string,
  timeZone: string,
): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return "";
  return formatter(timeZone, true).format(at);
}
