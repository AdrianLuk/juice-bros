/**
 * Parses CourtReserve's own confirmation/cancellation notification emails
 * (issue #63, first slice of #59's email-sync feature — see ADR-0009 and
 * CONTEXT.md's Import Candidate entry) and builds the Gmail search query
 * that finds them.
 *
 * CourtReserve's template is a fixed, known shape (single-provider parsing
 * only, per ADR-0009) — a labelled table of fields — so this is plain
 * pattern-matching over the raw HTML, not a general HTML parser. Free of
 * Next.js/Supabase imports and of any Gmail API dependency, so it's unit
 * tested directly against fixture HTML rather than a live inbox.
 *
 * The fixture HTML/subject shapes this module is built and tested against
 * are this session's own best guess at CourtReserve's real template, not a
 * real sample — nobody working this ticket had access to an actual
 * CourtReserve confirmation/cancellation email. `classifyBySubject`'s
 * confirmation/cancellation heuristics in particular are worth re-verifying
 * against a real inbox once one is available (e.g. early in #64, which is
 * the first ticket to actually run this against live mail); until then,
 * treat the subject-classification boundary as reasonable-effort, not proven.
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

function normalizeLabel(cellHtml: string): string {
  return decodeHtmlEntities(stripTags(cellHtml))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*:\s*$/, "")
    .toLowerCase();
}

const ROW_PATTERN = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
// Excludes `<td`/`</td>` themselves from the cell body (a negative lookahead
// per character, not `[\s\S]*?`) so a row can never accidentally swallow a
// neighbouring cell's boundary into its own capture.
const CELL_PATTERN = /<td[^>]*>((?:(?!<\/?td\b)[\s\S])*)<\/td>/gi;

/**
 * Every field row in the email, keyed by its label's normalised text — one
 * pass over the HTML rather than a separate scan per field a caller happens
 * to ask for. Scoped per `<tr>` rather than pairing any two adjacent `<td>`s
 * globally: a row with more than two cells (an icon/spacer column before the
 * label, common in real HTML email templates) still resolves correctly,
 * since the label/value pair is always a row's *last* two cells — and a row
 * with only one cell (a banner, a colspan notice) is skipped outright rather
 * than bleeding into whatever `<tr>` follows it. A real template wrapping
 * its label in `<strong>`/a `<span>` (ordinary styling, not malformed markup)
 * still matches: only the label's *text* has to equal the field name, not
 * its exact tag-for-tag markup.
 */
function extractFields(html: string): Map<string, string> {
  const fields = new Map<string, string>();
  ROW_PATTERN.lastIndex = 0;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = ROW_PATTERN.exec(html)) !== null) {
    const cells: string[] = [];
    CELL_PATTERN.lastIndex = 0;

    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = CELL_PATTERN.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1]);
    }

    if (cells.length < 2) {
      continue;
    }

    const label = normalizeLabel(cells[cells.length - 2]);
    const value = decodeHtmlEntities(stripTags(cells[cells.length - 1]))
      .replace(/\s+/g, " ")
      .trim();

    // First match wins, matching how a caller reading top-to-bottom would.
    if (value && !fields.has(label)) {
      fields.set(label, value);
    }
  }

  return fields;
}

/** `"2026-09-15"` (`sep = "-"`) or `"2026/09/15"` (`sep = "/"`) from a `Date`'s own local year/month/day. */
function formatLocalDate(date: Date, sep: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${sep}${month}${sep}${day}`;
}

/**
 * "September 15, 2026" → "2026-09-15". Relies on `Date`'s own parsing of a
 * bare "Month DD, YYYY" string rather than a hand-rolled month-name table —
 * both the parse and the read-back below happen in the same (arbitrary)
 * local zone, so which zone that is never affects the calendar date read out.
 */
function parseHumanDate(text: string): string | null {
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : formatLocalDate(parsed, "-");
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

const CONFIRMATION_SUBJECT_PATTERN = /reservation.*confirm|confirm.*reservation/i;
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

    const fields = extractFields(email.html);
    const facilityName = fields.get("facility") ?? null;
    const dateText = fields.get("date") ?? null;
    const timeText = fields.get("time") ?? null;
    const courtLabel = fields.get("court") ?? null;

    const date = dateText ? parseHumanDate(dateText) : null;
    const timeRange = timeText ? parseTimeRange(timeText) : null;

    if (!facilityName || !date || !timeRange) {
      return { kind: "unparseable" };
    }

    if (kind === "cancellation") {
      return {
        kind: "cancellation",
        cancellation: { facilityName, date, startTime: timeRange.start, courtLabel },
      };
    }

    const format = parseFormat(fields.get("type") ?? null);
    const playerNames = parsePlayerNames(fields.get("players") ?? null);

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
