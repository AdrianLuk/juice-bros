/**
 * A hand-rolled iCalendar (RFC 5545) reader for the CourtReserve member
 * calendar feed — the second, independent Booking-import source added
 * alongside email sync (spec #288, and the ADR it adds). `parseIcsFeed`
 * turns a raw `.ics` body into structured events; a later ticket does the
 * HTTPS fetch with SSRF hardening and hands the text in.
 *
 * No new dependency and no Next.js / Supabase imports on purpose — same
 * pure-module discipline as `courtreserve-email.ts` and `email-sync-review.ts`,
 * so every folding / datetime / robustness decision is unit tested against
 * fixture `.ics` strings with `node --test` rather than a live feed.
 *
 * Deliberately partial. This covers the RFC 5545 basics a real feed needs —
 * line unfolding, `VEVENT` extraction, property/parameter/value split, text
 * unescaping, and the datetime value forms — and nothing else:
 *
 *   - `VTIMEZONE` blocks are not parsed; an IANA `TZID` plus `Intl` is the
 *     whole time-zone story (bare-offset and `VTIMEZONE`-defined zones fall
 *     back to the caller's zone).
 *   - `RRULE` / `RDATE` / `RECURRENCE-ID` events are not expanded and never
 *     produce an event — but their UID still comes out in `unreadableUids`
 *     (see below).
 *   - `VALUE=DATE` all-day events likewise produce no event, UID passed
 *     through the same way.
 *   - `VALARM` / `VFREEBUSY` / `VTODO` / `VJOURNAL`, and `ATTENDEE` /
 *     `ORGANIZER`, are ignored.
 *
 * Never throws. Any `VEVENT` that carries a UID but does not yield a usable
 * event — a malformed datetime, a start or end off the hour grid, a missing
 * required property, an all-day span, a recurrence rule — is reported in
 * `unreadableUids` so the caller keeps it in its seen-set. A transient parse
 * gap, or a feed that corrupts a real timed reservation into one of these
 * shapes, must never read as a cancellation of the Booking it was imported
 * as. A `VEVENT` with no readable UID is dropped silently.
 *
 * The `SUMMARY` / `LOCATION` / `DESCRIPTION` -> court label / format /
 * session name / players mapping lives in `courtreserve-feed.ts`, decided
 * against a real captured feed — ADR-0009 records the email parser being
 * built against a wrong guess, and the same risk applies here.
 */

import { clockInZone } from "./datetime.ts";
import { isKnownTimeZone } from "./timezone.ts";

export type IcsEventStatus = "confirmed" | "tentative" | "cancelled";

export type IcsFeedEvent = {
  /** The `VEVENT` UID, verbatim (trimmed) — the caller's stable identity for the reservation across syncs. */
  uid: string;
  /** `SEQUENCE`, or `0` when absent/unreadable. A later edit to the same reservation bumps this. */
  sequence: number;
  /** Raw `SUMMARY`, unescaped; `""` when the property is absent. Mapping to Booking fields is `courtreserve-feed.ts`'s job. */
  summary: string;
  /** Raw `LOCATION`, unescaped; `""` when absent. */
  location: string;
  /** Raw `DESCRIPTION`, unescaped; `""` when absent. */
  description: string;
  /** Absolute start instant, ISO 8601 with a `Z` suffix. */
  start: string;
  /** Absolute end instant, ISO 8601 with a `Z` suffix — always strictly after `start`. */
  end: string;
  /** `STATUS`, lower-cased and narrowed; anything other than `CANCELLED` / `TENTATIVE` (and an absent property) reads as `confirmed`. */
  status: IcsEventStatus;
};

export type IcsFeedParseResult = {
  /** Fully parsed, on-the-hour, timed events, in feed order. */
  events: IcsFeedEvent[];
  /**
   * UIDs of `VEVENT`s that carried a UID but did not become an event —
   * malformed datetime, a non-hour start/end, a missing required property,
   * an all-day span, or a recurrence rule. The caller keeps these "seen" so
   * a parse gap is never diffed as a cancellation. De-duplicated, and never
   * overlapping `events`.
   */
  unreadableUids: string[];
};

export type ParseIcsFeedOptions = {
  /**
   * The zone to assume for a floating datetime (no `Z`, no `TZID`) and for a
   * `TZID` naming a zone `isKnownTimeZone` does not recognise — in practice
   * the owning Org's own zone, which Postgres has already validated. An
   * unusable value here falls back to UTC rather than throwing.
   */
  fallbackTimeZone: string;
};

// --- RFC 5545 line handling -------------------------------------------------

/**
 * Content lines, unfolded. RFC 5545 delimits lines with CRLF and folds a long
 * one by inserting CRLF + a single space or tab; real-world feeds also use a
 * bare LF (and, rarely, a bare CR). A whitespace-led line is a continuation of
 * the previous one, with that one lead character removed. Blank lines are
 * tolerated by skipping them.
 */
function unfoldLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else if (line !== "") {
      out.push(line);
    }
  }
  return out;
}

/**
 * The content lines of each top-level `VEVENT`, with any nested component
 * (`VALARM`) skipped — so no alarm property leaks into the event. The
 * `VCALENDAR` wrapper and sibling components (`VTIMEZONE`, `VFREEBUSY`, …)
 * are simply never collected.
 */
function extractVeventBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  let nestedDepth = 0;

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (current === null) {
      if (upper === "BEGIN:VEVENT") {
        current = [];
        nestedDepth = 0;
      }
      continue;
    }

    if (nestedDepth === 0 && upper === "END:VEVENT") {
      blocks.push(current);
      current = null;
      continue;
    }
    if (upper.startsWith("BEGIN:")) {
      nestedDepth += 1;
      continue;
    }
    if (upper.startsWith("END:")) {
      nestedDepth = Math.max(0, nestedDepth - 1);
      continue;
    }

    if (nestedDepth === 0) {
      current.push(line);
    }
  }

  return blocks;
}

type IcsProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

/** Split `input` on every `sep` that is not inside a double-quoted run. */
function splitUnquoted(input: string, sep: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let inQuote = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === sep && !inQuote) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}

/**
 * One content line -> `{ name, params, value }`. The name and parameters sit
 * before the first colon that is not inside a quoted parameter value; each
 * parameter is `KEY=VALUE`, its value optionally double-quoted. Returns `null`
 * for a line with no colon at all.
 */
function parsePropertyLine(line: string): IcsProperty | null {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon === -1) {
    return null;
  }

  const segments = splitUnquoted(line.slice(0, colon), ";");
  const name = (segments[0] ?? "").toUpperCase();
  if (!name) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = segment.slice(0, eq).toUpperCase();
    let paramValue = segment.slice(eq + 1);
    if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
      paramValue = paramValue.slice(1, -1);
    }
    params[key] = paramValue;
  }

  return { name, params, value: line.slice(colon + 1) };
}

/** First occurrence of each property name, so a repeated property can't shadow the first. */
function indexProperties(block: string[]): Map<string, IcsProperty> {
  const props = new Map<string, IcsProperty>();
  for (const line of block) {
    const prop = parsePropertyLine(line);
    if (prop && !props.has(prop.name)) {
      props.set(prop.name, prop);
    }
  }
  return props;
}

/** RFC 5545 TEXT unescaping: `\n`/`\N` -> newline, `\,` `\;` `\\` -> the bare character. Left to right, so `\\n` stays a literal `\n`. */
function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, char: string) =>
    char === "n" || char === "N" ? "\n" : char,
  );
}

// --- Datetime resolution --------------------------------------------------

const DATE_ONLY = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;

/** The zone's offset from UTC, in ms, at instant `at` — positive east of UTC. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)) {
    parts[part.type] = part.value;
  }

  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallAsUtc - at.getTime();
}

/**
 * A wall-clock reading in `timeZone` -> the absolute instant. Guess the offset
 * by pretending the wall clock is UTC, then correct once — enough to land on
 * the right side of a DST transition for any real reservation time.
 */
function wallClockToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = zoneOffsetMs(timeZone, new Date(guess));
  let instant = guess - firstOffset;
  const secondOffset = zoneOffsetMs(timeZone, new Date(instant));
  if (secondOffset !== firstOffset) {
    instant = guess - secondOffset;
  }
  return new Date(instant);
}

type ResolvedInstant = {
  instant: Date;
  /** The zone the on-the-hour check runs in — the reservation's own local clock. */
  hourCheckZone: string;
};

type DatetimeOutcome =
  | { kind: "instant"; resolved: ResolvedInstant }
  | { kind: "all-day" }
  | { kind: "malformed" };

/**
 * A calendar date/time that actually exists — the range check the `DATE_TIME`
 * regex can't do, plus a UTC round-trip so `Date.UTC` can't silently roll
 * `20260230` (Feb 30) forward into a real instant on the wrong day. Mirrors
 * `datetime.ts`'s `isRealDate`, extended to the time-of-day fields.
 */
function isRealCalendarDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function resolveDatetime(prop: IcsProperty, fallbackTimeZone: string): DatetimeOutcome {
  const raw = prop.value.trim();

  if (prop.params.VALUE?.toUpperCase() === "DATE" || DATE_ONLY.test(raw)) {
    return { kind: "all-day" };
  }

  const match = DATE_TIME.exec(raw);
  if (!match) {
    return { kind: "malformed" };
  }

  const [, y, mo, d, h, mi, s, zulu] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  if (!isRealCalendarDateTime(year, month, day, hour, minute, second)) {
    return { kind: "malformed" };
  }

  if (zulu) {
    const instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return { kind: "instant", resolved: { instant, hourCheckZone: fallbackTimeZone } };
  }

  const tzid = prop.params.TZID;
  const zone = tzid && isKnownTimeZone(tzid) ? tzid : fallbackTimeZone;
  const instant = wallClockToInstant(year, month, day, hour, minute, second, zone);
  return { kind: "instant", resolved: { instant, hourCheckZone: zone } };
}

/**
 * Whether `at`, read in `timeZone`, lands on the hour. Minute precision — the
 * Booking model's grid is hourly, and a feed's seconds field is always `00`.
 * `clockInZone` carries the load-bearing `hourCycle: "h23"` so midnight reads
 * `"00:00"`, not `"24:00"`.
 */
function isOnTheHour(at: Date, timeZone: string): boolean {
  return clockInZone(timeZone, at).endsWith(":00");
}

const ISO_DURATION =
  /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** RFC 5545 `DURATION` -> milliseconds. `null` for a value that doesn't parse or is zero-length. */
function parseIcsDuration(value: string): number | null {
  const match = ISO_DURATION.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, sign, w, d, h, mi, s] = match;
  const weeks = Number(w ?? 0);
  const days = Number(d ?? 0);
  const hours = Number(h ?? 0);
  const minutes = Number(mi ?? 0);
  const seconds = Number(s ?? 0);
  const ms = ((((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  if (ms === 0) {
    return null;
  }
  return sign === "-" ? -ms : ms;
}

// --- VEVENT -> event ----------------------------------------------------

type VeventOutcome =
  | { kind: "event"; event: IcsFeedEvent }
  /** Has a UID but no usable event — the caller keeps it "seen". */
  | { kind: "unreadable"; uid: string }
  /** No readable UID at all — nothing the caller could track. */
  | { kind: "drop" };

function toStatus(raw: string | undefined): IcsEventStatus {
  switch (raw?.trim().toUpperCase()) {
    case "CANCELLED":
      return "cancelled";
    case "TENTATIVE":
      return "tentative";
    default:
      return "confirmed";
  }
}

function toSequence(raw: string | undefined): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseVevent(block: string[], fallbackTimeZone: string): VeventOutcome {
  const props = indexProperties(block);
  const uid = props.get("UID")?.value.trim() || null;

  if (!uid) {
    return { kind: "drop" };
  }

  // Recurrence and all-day events never produce an `IcsFeedEvent` — no
  // recurrence expansion, and an all-day span isn't an on-the-hour Booking.
  // Every one still carries a UID out as `unreadable`: it can't be imported,
  // so it never adds a seen-set row, but if the same UID was a clean timed
  // event on a previous sync (a feed that corrupts a real reservation into
  // one of these) the caller must keep it seen or the diff reads it as a
  // cancellation.
  if (props.has("RRULE") || props.has("RDATE") || props.has("RECURRENCE-ID")) {
    return { kind: "unreadable", uid };
  }

  const dtStart = props.get("DTSTART");
  if (!dtStart) {
    return { kind: "unreadable", uid };
  }

  const start = resolveDatetime(dtStart, fallbackTimeZone);
  if (start.kind === "all-day" || start.kind === "malformed") {
    return { kind: "unreadable", uid };
  }

  const end = resolveEnd(props, start.resolved, fallbackTimeZone);
  if (!end) {
    return { kind: "unreadable", uid };
  }

  if (end.instant.getTime() <= start.resolved.instant.getTime()) {
    return { kind: "unreadable", uid };
  }
  if (
    !isOnTheHour(start.resolved.instant, start.resolved.hourCheckZone) ||
    !isOnTheHour(end.instant, end.hourCheckZone)
  ) {
    return { kind: "unreadable", uid };
  }

  return {
    kind: "event",
    event: {
      uid,
      sequence: toSequence(props.get("SEQUENCE")?.value),
      summary: unescapeText(props.get("SUMMARY")?.value ?? ""),
      location: unescapeText(props.get("LOCATION")?.value ?? ""),
      description: unescapeText(props.get("DESCRIPTION")?.value ?? ""),
      start: start.resolved.instant.toISOString(),
      end: end.instant.toISOString(),
      status: toStatus(props.get("STATUS")?.value),
    },
  };
}

/** `DTEND` if present, else `DTSTART` + `DURATION`. `null` when neither yields a usable timed instant. */
function resolveEnd(
  props: Map<string, IcsProperty>,
  start: ResolvedInstant,
  fallbackTimeZone: string,
): ResolvedInstant | null {
  const dtEnd = props.get("DTEND");
  if (dtEnd) {
    const resolved = resolveDatetime(dtEnd, fallbackTimeZone);
    return resolved.kind === "instant" ? resolved.resolved : null;
  }

  const duration = props.get("DURATION");
  if (duration) {
    const ms = parseIcsDuration(duration.value);
    if (ms === null || ms < 0) {
      return null;
    }
    return {
      instant: new Date(start.instant.getTime() + ms),
      hourCheckZone: start.hourCheckZone,
    };
  }

  return null;
}

/**
 * Turn a raw CourtReserve `.ics` body into structured events. Pure and
 * total: every decision comes from `text` and `options`, and a parse failure
 * on one event never throws or stops the rest.
 */
export function parseIcsFeed(
  text: string,
  options: ParseIcsFeedOptions,
): IcsFeedParseResult {
  const fallbackTimeZone = isKnownTimeZone(options.fallbackTimeZone)
    ? options.fallbackTimeZone
    : "UTC";

  const events: IcsFeedEvent[] = [];
  const unreadable = new Set<string>();

  let blocks: string[][];
  try {
    blocks = extractVeventBlocks(unfoldLines(text));
  } catch {
    return { events, unreadableUids: [] };
  }

  for (const block of blocks) {
    let outcome: VeventOutcome;
    try {
      outcome = parseVevent(block, fallbackTimeZone);
    } catch {
      const uid = indexProperties(block).get("UID")?.value.trim();
      outcome = uid ? { kind: "unreadable", uid } : { kind: "drop" };
    }

    if (outcome.kind === "event") {
      events.push(outcome.event);
    } else if (outcome.kind === "unreadable") {
      unreadable.add(outcome.uid);
    }
  }

  const parsedUids = new Set(events.map((event) => event.uid));
  return {
    events,
    unreadableUids: [...unreadable].filter((uid) => !parsedUids.has(uid)),
  };
}
