/**
 * Date and runtime formatting for the home page's episode metadata.
 *
 * Import-free on purpose so `node --test` can load it directly: this project's
 * test runner has no path-alias resolution, so pure logic that wants covering
 * has to live in a module that imports nothing aliased.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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
