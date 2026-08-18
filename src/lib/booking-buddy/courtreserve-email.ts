/**
 * Parses CourtReserve's own confirmation/cancellation notification emails
 * (issue #63, first slice of #59's email-sync feature — see ADR-0009 and
 * CONTEXT.md's Import Candidate entry) and builds the Gmail search query
 * that finds them.
 *
 * CourtReserve's template is a fixed, known shape (single-provider parsing
 * only, per ADR-0009) — so this is plain pattern-matching over the raw HTML,
 * not a general HTML parser. Free of Next.js/Supabase imports and of any
 * Gmail API dependency, so it's unit tested directly against fixture HTML
 * rather than a live inbox.
 *
 * Rebuilt against two real captured emails (a confirmation and a
 * cancellation) after the first version — written against a best-guess
 * reconstruction with no real sample available — turned out to assume the
 * wrong template shape entirely: CourtReserve's real body has no labelled
 * `<td>` rows at all. Each field group is an `<h4>` heading ("Details",
 * "Player(s)", "Court(s)", or "Cancellation Details" for a cancellation)
 * immediately followed by an `<h5>` value; the confirmation's "Details"
 * value is format/date/time `<br>`-joined in one block, and the
 * cancellation's "Cancellation Details" value prepends the player's own
 * name to that same three-line block instead of carrying a separate
 * Player(s)/Court(s) section at all. The facility name isn't a labelled
 * field either — it's read off the template's own logo `<img alt>`. See
 * `courtreserve-email.test.ts`'s real-fixture tests for the exact captured
 * shape (facility/player names replaced with placeholders before commit,
 * since this repo is public).
 */

import { isBookingFormat, type BookingFormat } from "./capacity.ts";
import { DEFAULT_BOOKING_FORMAT } from "./bookings.ts";

export type CourtReserveConfirmation = {
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string | null;
  /** Null when the facility doesn't label its courts — mirrors NewBooking's own courtLabel. */
  courtLabel: string | null;
  format: BookingFormat;
  /** Raw names as the email lists them — matching against Connections is a later ticket's job. */
  playerNames: string[];
};

export type CourtReserveCancellation = {
  facilityName: string;
  date: string;
  startTime: string;
  courtLabel: string | null;
};

export type CourtReserveEmailParseResult =
  | { kind: "confirmation"; confirmation: CourtReserveConfirmation }
  | { kind: "cancellation"; cancellation: CourtReserveCancellation }
  /** A real CourtReserve email (waitlist/membership/etc.) that isn't a booking — expected, not an error. */
  | { kind: "not_a_booking" }
  /** Looked like a confirmation/cancellation by its subject, but the body didn't parse — a real failure. */
  | { kind: "unparseable" };

/**
 * `<br>` is a real-world line separator (e.g. a Players list rendered as
 * "Amy Ace<br>Ben Backhand" rather than comma-joined) — turned into a
 * literal separator before the rest of the markup is discarded, or two
 * names would silently concatenate into one.
 */
function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]*>/g, "");
}

// Named entities beyond the XML-ish basics: a rich-text-authored template
// reaches for a typographic apostrophe/dash, and a real facility name is
// realistically Latin-accented ("Café", "Piscine Léger") often enough that
// this is worth covering directly rather than leaving every such name to
// fail its exact-match Org lookup silently. Named entities are genuinely
// case-sensitive in HTML (`&Eacute;` is "É", `&eacute;` is "é") — both
// cases are listed rather than folding one onto the other.
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  reg: "®",
  copy: "©",
  trade: "™",
  eacute: "é",
  Eacute: "É",
  egrave: "è",
  Egrave: "È",
  ecirc: "ê",
  Ecirc: "Ê",
  euml: "ë",
  Euml: "Ë",
  aacute: "á",
  Aacute: "Á",
  agrave: "à",
  Agrave: "À",
  acirc: "â",
  Acirc: "Â",
  auml: "ä",
  Auml: "Ä",
  aring: "å",
  Aring: "Å",
  iacute: "í",
  Iacute: "Í",
  igrave: "ì",
  Igrave: "Ì",
  icirc: "î",
  Icirc: "Î",
  iuml: "ï",
  Iuml: "Ï",
  oacute: "ó",
  Oacute: "Ó",
  ograve: "ò",
  Ograve: "Ò",
  ocirc: "ô",
  Ocirc: "Ô",
  ouml: "ö",
  Ouml: "Ö",
  uacute: "ú",
  Uacute: "Ú",
  ugrave: "ù",
  Ugrave: "Ù",
  ucirc: "û",
  Ucirc: "Û",
  uuml: "ü",
  Uuml: "Ü",
  ntilde: "ñ",
  Ntilde: "Ñ",
  ccedil: "ç",
  Ccedil: "Ç",
};

/** Named, decimal (`&#39;`) and hex (`&#x27;`) entities — not just the handful this parser's own fixtures happen to use. */
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const codePoint = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    // Case-sensitive lookup on purpose — see the table's own comment.
    return NAMED_HTML_ENTITIES[code] ?? entity;
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A field group's raw value HTML: the `<h5>` immediately following the
 * `<h4>` heading named `heading` (e.g. "Details", "Player(s)", "Court(s)")
 * — non-greedy across whatever divider markup CourtReserve puts between
 * them, so it stops at that section's own `<h5>` rather than a later one.
 * `null` when the heading itself isn't present (e.g. "Court(s)" on a
 * cancellation, which never has that section at all).
 */
function extractSection(html: string, heading: string): string | null {
  const pattern = new RegExp(
    `<h4[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h4>[\\s\\S]*?<h5[^>]*>([\\s\\S]*?)<\\/h5>`,
    "i",
  );
  return pattern.exec(html)?.[1] ?? null;
}

/**
 * CourtReserve's own logo `<img alt="...">` near the top of the email is
 * the facility name — there's no labelled "Facility:" field anywhere in the
 * body. The tracking-pixel `<img>` in the footer has an empty `alt`, so the
 * first *non-empty* one wins rather than the first `<img>` outright.
 */
function extractFacilityName(html: string): string | null {
  const pattern = /<img[^>]*\balt="([^"]*)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const alt = decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
    if (alt) {
      return alt;
    }
  }
  return null;
}

/**
 * A field group's value split into its `<br>`-separated lines (e.g.
 * "Singles<br>Friday, 8-21-2026<br>2:00 PM - 4:00 PM" → three lines),
 * each cleaned of tags/entities independently — unlike `stripTags`, `<br>`
 * here is a real line boundary between distinct fields, not a
 * comma-joinable list within one field.
 */
function splitSectionLines(html: string): string[] {
  return html
    .split(/<br\s*\/?>/gi)
    .map((line) => decodeHtmlEntities(line.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim());
}

/** `"2026-09-15"` (`sep = "-"`) or `"2026/09/15"` (`sep = "/"`) from a `Date`'s own local year/month/day. */
function formatLocalDate(date: Date, sep: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${sep}${month}${sep}${day}`;
}

/**
 * "Friday, 8-21-2026" → "2026-08-21" — CourtReserve's own Details-block date
 * format, confirmed against a real captured email: a leading weekday name
 * (for a human reader only, not part of the actual date) followed by
 * `M-D-YYYY`. Parsed explicitly with a regex rather than handed to `Date`,
 * since ECMA-262 only guarantees consistent cross-engine parsing for ISO
 * 8601 strings — a "Weekday, M-D-YYYY" string is implementation-defined and
 * not safe to rely on `new Date()` for.
 */
function parseHumanDate(text: string): string | null {
  const match = /(\d{1,2})-(\d{1,2})-(\d{4})\s*$/.exec(text);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "6:00 PM" → "18:00". */
function parseClockTime(text: string): string | null {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minuteText = match[2];
  const meridiem = match[3].toUpperCase();

  if (hour < 1 || hour > 12 || Number(minuteText) > 59) {
    return null;
  }

  if (meridiem === "AM") {
    hour = hour === 12 ? 0 : hour;
  } else {
    hour = hour === 12 ? 12 : hour + 12;
  }

  return `${String(hour).padStart(2, "0")}:${minuteText}`;
}

/**
 * "6:00 PM - 7:00 PM" (or "... to ...") → `{ start: "18:00", end: "19:00" }`;
 * "6:00 PM" alone (no separator at all) → `{ start: "18:00", end: null }`. A
 * separator *with* an end side that fails to parse ("6:00 PM - TBD") is
 * treated as the whole field being malformed (`null`) rather than silently
 * downgraded to "no end time" — the email did specify one, it just didn't parse.
 */
function parseTimeRange(text: string): { start: string; end: string | null } | null {
  const parts = text.split(/[-–—]|\s+to\s+/i);
  const start = parts[0] ? parseClockTime(parts[0]) : null;
  if (!start) {
    return null;
  }

  if (parts.length === 1) {
    return { start, end: null };
  }

  const end = parts[1] ? parseClockTime(parts[1]) : null;
  return end ? { start, end } : null;
}

function parseFormat(text: string | null): BookingFormat {
  const normalized = text?.trim().toLowerCase();
  // Never refused for an odd/missing value — same "default rather than
  // error" bookings.ts's own parseNewBooking already applies to a stray
  // format value a User submitted. Delegates to isBookingFormat (capacity.ts)
  // rather than hand-checking "singles", so a third format value would only
  // ever need to be taught to that one guard.
  return isBookingFormat(normalized) ? normalized : DEFAULT_BOOKING_FORMAT;
}

function parsePlayerNames(text: string | null): string[] {
  if (!text) {
    return [];
  }
  return text
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

// CourtReserve's real subject is "Booking Confirmation for ..." — "booking",
// not "reservation" — so both nouns are accepted, still paired with
// "confirm" rather than matching on either word alone (e.g. a lone
// "Confirm your account" subject from some other CourtReserve email
// shouldn't be read as a booking confirmation).
const CONFIRMATION_SUBJECT_PATTERN = /(reservation|booking).*confirm|confirm.*(reservation|booking)/i;
// Matches "cancelled"/"canceled"/"cancellation" — the verb (past tense, a
// completed action) or the noun, either of which a real acknowledgement
// subject might use — but deliberately *not* a bare "cancel" on its own,
// which shows up in ordinary confirmation-subject hedge text ("...you may
// cancel free of charge until 24 hours before") without the email being a
// cancellation at all. "Cancellation" the noun still needs its own
// exclusion, since "...Please Review Our Cancellation Policy" is the same
// kind of confirmation-subject hedge text using the noun form instead.
const CANCELLATION_WORD_PATTERN = /\bcancell?(?:ed|ation)\b/i;
const CANCELLATION_POLICY_PATTERN = /cancellation\s+polic/i;

/**
 * The subject line is CourtReserve's own signal for which template an email
 * uses — cheaper and more reliable than inferring from body content, and it's
 * what lets a waitlist/membership email (this function's `null` result) be
 * recognized and skipped before ever trying to parse its body as one.
 */
function classifyBySubject(subject: string): "confirmation" | "cancellation" | null {
  const looksLikeCancellation =
    CANCELLATION_WORD_PATTERN.test(subject) && !CANCELLATION_POLICY_PATTERN.test(subject);

  if (looksLikeCancellation) {
    return "cancellation";
  }
  if (CONFIRMATION_SUBJECT_PATTERN.test(subject)) {
    return "confirmation";
  }
  return null;
}

/**
 * Never throws: a malformed/unexpected body for an email whose subject did
 * claim to be a confirmation/cancellation comes back as `"unparseable"`
 * rather than an exception, so one bad email can't take down a whole sync.
 */
export function parseCourtReserveEmail(email: {
  subject: string;
  html: string;
}): CourtReserveEmailParseResult {
  try {
    const kind = classifyBySubject(email.subject);
    if (!kind) {
      return { kind: "not_a_booking" };
    }

    const facilityName = extractFacilityName(email.html);

    const detailsHtml = extractSection(email.html, kind === "cancellation" ? "Cancellation Details" : "Details");
    // The confirmation's Details block is exactly [format, date, time]; a
    // cancellation's Cancellation Details block prepends the player's own
    // name, making it [name, format, date, time] — the last three lines are
    // the same shape either way, so the (optional) leading name is simply
    // ignored rather than needing a separate cancellation-only field.
    const detailsLines = detailsHtml ? splitSectionLines(detailsHtml) : [];
    const [formatText, dateText, timeText] = detailsLines.slice(-3);

    const date = dateText ? parseHumanDate(dateText) : null;
    const timeRange = timeText ? parseTimeRange(timeText) : null;

    if (!facilityName || !date || !timeRange) {
      return { kind: "unparseable" };
    }

    const courtSectionHtml = extractSection(email.html, "Court(s)");
    const courtLabel = courtSectionHtml
      ? decodeHtmlEntities(courtSectionHtml.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim() || null
      : null;

    if (kind === "cancellation") {
      return {
        kind: "cancellation",
        cancellation: { facilityName, date, startTime: timeRange.start, courtLabel },
      };
    }

    const format = parseFormat(formatText ?? null);
    const playersSectionHtml = extractSection(email.html, "Player(s)");
    const playerNames = parsePlayerNames(
      playersSectionHtml ? decodeHtmlEntities(stripTags(playersSectionHtml)).replace(/\s+/g, " ").trim() : null,
    );

    return {
      kind: "confirmation",
      confirmation: {
        facilityName,
        date,
        startTime: timeRange.start,
        endTime: timeRange.end,
        courtLabel,
        format,
        playerNames,
      },
    };
  } catch {
    return { kind: "unparseable" };
  }
}

export const COURTRESERVE_SENDER = "notifications@courtreserve.com";

/** How far back "Sync from Email" looks, every call — no stored cursor/watermark (#59's design decision). */
export const COURTRESERVE_SEARCH_WINDOW_DAYS = 90;

/**
 * A Gmail search query (`users.messages.list`'s own `q` syntax) scoped to
 * CourtReserve's notification address and the last `COURTRESERVE_SEARCH_WINDOW_DAYS`
 * days — never a whole-inbox search (issue #62's Settings copy already
 * promises this to the User).
 */
export function buildCourtReserveSearchQuery(now: Date): string {
  const after = new Date(now);
  after.setDate(after.getDate() - COURTRESERVE_SEARCH_WINDOW_DAYS);

  return `from:${COURTRESERVE_SENDER} after:${formatLocalDate(after, "/")}`;
}
