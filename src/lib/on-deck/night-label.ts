/**
 * Naming a past night (issue #469).
 *
 * A Club carries no time zone — the schema has never needed one, because
 * every other surface in On Deck is read *during* the Session it describes,
 * where "tonight" needs no date. A Summary is the first thing read the
 * morning after, so it is the first thing that has to name a day.
 *
 * Two consequences, both deliberate:
 *
 * The label is formatted in UTC, because that is the only zone the server can
 * know. That is wrong by a day for a Session that ran late enough to cross
 * midnight UTC — after about 20:00 in Toronto. It is the *start* that gets
 * named for exactly this reason: a social starting at 13:00 or 19:00 local is
 * still the same UTC day, while the close of a 21:00 finish is not. The real
 * fix is a `time_zone` on the Club, the way Booking Buddy models one per Org;
 * that is a migration, and this ticket is a reader.
 *
 * And no client-side reformatting. Naming the day in the *viewer's* zone
 * would be right for whoever is looking, and would mean a page that renders
 * one date on the server and another after hydration.
 */

const FORMAT = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * "Saturday, September 5" for a night's start. Returns an empty string for an
 * unparseable timestamp rather than "Invalid Date", so a bad row shows a name
 * that is merely missing instead of one that looks like a crash.
 */
export function nightLabel(isoTimestamp: string): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return "";
  return FORMAT.format(at);
}

const WITH_YEAR = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** The same, carrying the year — for a single night's own page. */
export function nightLabelWithYear(isoTimestamp: string): string {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return "";
  return WITH_YEAR.format(at);
}
