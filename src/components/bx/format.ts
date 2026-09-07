/**
 * Date and runtime formatting for Broadcast Dark's episode metadata.
 *
 * Import-free on purpose so `node --test` can load it directly: this project's
 * test runner has no path-alias resolution, so pure logic that wants covering
 * has to live in a module that imports nothing aliased.
 *
 * Lived at `src/app/(home)/sections/format.ts` while the home page was the only
 * route in this look; moved here when the Podcast archive, the episode page and
 * the About page's origin story all needed the same two formats. There is one
 * date vocabulary on the site, not one per route.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** "Aug 27, 2026" from an ISO timestamp; the raw string if it will not parse. */
export function formatAired(published: string): string {
  const date = new Date(published);
  if (Number.isNaN(date.getTime())) return published;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "Aug 27" - the short form the archive cards use. */
export function formatAiredShort(published: string): string {
  const date = new Date(published);
  if (Number.isNaN(date.getTime())) return published;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * "August 27, 2026" - the long form, for the episode page, where the date is
 * one of only two facts in the metadata line and has the room to be spelled.
 */
export function formatAiredLong(published: string): string {
  const date = new Date(published);
  if (Number.isNaN(date.getTime())) return published;
  return `${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * A runtime chip from a YouTube ISO 8601 duration, in the shape a video player
 * writes it: "22:14", or "1:02:30" once it passes the hour. An unparseable or
 * zero duration returns an empty string so the caller can omit the chip
 * entirely rather than print a wrong or placeholder time.
 */
export function formatRuntime(duration: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours + minutes + seconds === 0) return "";
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * "22 min" - a spoken runtime, for the places a chip would be wrong because
 * there is no thumbnail to draw it on (the episode page's metadata line).
 * Rounds up, so a 21:40 episode does not advertise itself as 21 minutes.
 */
export function formatRuntimeWords(duration: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 60 + minutes + (seconds >= 30 ? 1 : 0);
  if (total === 0) return "";
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
