/**
 * Parses CourtReserve's own confirmation/cancellation notification emails
 * (issue #63, first slice of #59's email-sync feature — see ADR-0009 and
 * CONTEXT.md's Import Candidate entry) and builds the provider-neutral
 * mailbox-search criteria that find them.
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
 *
 * A second real template — "Registration Confirmation", sent for
 * program/tournament sign-ups rather than a plain court reservation (issue
 * #96) — uses the same `<h4>`/`<h5>` field-group shape but its own heading
 * names: "Event" in place of "Details" (its own first line becomes both
 * `name` and, via the same fallback-to-doubles `parseFormat`, `format`) and
 * "Registered Team(s)" in place of "Player(s)". Both templates still
 * collapse into the exact same `CourtReserveConfirmation` result shape.
 */

import { isBookingFormat, type BookingFormat } from "./capacity.ts";
import { DEFAULT_BOOKING_FORMAT, splitPlayerNames } from "./bookings.ts";

export type CourtReserveConfirmation = {
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string | null;
  /** Null when the facility doesn't label its courts — mirrors NewBooking's own courtLabel. */
  courtLabel: string | null;
  format: BookingFormat;
  /** The Details section's own first line, raw — the same line `format` is derived from (issue #95). */
  name: string;
  /** Raw names as the email lists them — matching against Connections is a later ticket's job. */
  playerNames: string[];
};

export type CourtReserveCancellation = {
  facilityName: string;
  date: string;
  startTime: string;
  courtLabel: string | null;
};

/**
 * A "Reservation Update Notice" — CourtReserve's own resend of a reservation
 * whose details changed (a player added, the format switched, a different
 * court assigned). Same fields as a fresh confirmation, since a real captured
 * one (`courtreserve-email.test.ts`'s own fixture) carries the complete
 * current state, not a diff — the caller decides what to do with that
 * (net it against an in-batch confirmation, or match it to an already-logged
 * Booking) rather than this parser guessing.
 */
export type CourtReserveUpdate = CourtReserveConfirmation;

export type CourtReserveEmailParseResult =
  | { kind: "confirmation"; confirmation: CourtReserveConfirmation }
  | { kind: "cancellation"; cancellation: CourtReserveCancellation }
  | { kind: "update"; update: CourtReserveUpdate }
  /** A real CourtReserve email (waitlist/membership/etc.) that isn't a booking — expected, not an error. */
  | { kind: "not_a_booking" }
  /** Looked like a confirmation/cancellation/update by its subject, but the body didn't parse — a real failure. */
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

/** The "Court(s)" section's own value, cleaned the same way every other field's raw HTML is — `null` when the section (or a usable value inside it) isn't present at all. */
function extractCourtSectionLabel(html: string): string | null {
  const courtSectionHtml = extractSection(html, "Court(s)");
  return courtSectionHtml
    ? decodeHtmlEntities(courtSectionHtml.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim() || null
    : null;
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

/**
 * "Friday, 8-21-2026" → "2026-08-21" — CourtReserve's own Details-block date
 * format, confirmed against a real captured email: a leading weekday name
 * (for a human reader only, not part of the actual date) followed by
 * `M-D-YYYY`. A Registration Confirmation's own Event block instead carries
 * a bare `YYYY-MM-DD` with no weekday prefix at all (confirmed against a
 * real captured tournament sign-up email — issue #101), so that shape is
 * checked first. Both are parsed explicitly with a regex rather than handed
 * to `Date`, since ECMA-262 only guarantees consistent cross-engine parsing
 * for ISO 8601 strings — a "Weekday, M-D-YYYY" string is
 * implementation-defined and not safe to rely on `new Date()` for, and
 * `YYYY-MM-DD` is safe but explicit parsing keeps both branches consistent.
 */
function parseHumanDate(text: string): string | null {
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

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

/**
 * A Registration Confirmation's own "Registered Team(s)" value prefixes its
 * name list with a "Team:" label (e.g. "Team: Amy Ace, Ben Backhand") —
 * applied only to that section's own text (never to "Player(s)", which has
 * no such label and could legitimately start with a name resembling one).
 */
function stripTeamLabel(text: string): string {
  return text.replace(/^\s*team\s*:\s*/i, "");
}

// CourtReserve's real subject is "Booking Confirmation for ..." — "booking",
// not "reservation" — so both nouns are accepted, still paired with
// "confirm" rather than matching on either word alone (e.g. a lone
// "Confirm your account" subject from some other CourtReserve email
// shouldn't be read as a booking confirmation).
const CONFIRMATION_SUBJECT_PATTERN = /(reservation|booking).*confirm|confirm.*(reservation|booking)/i;
// CourtReserve's second template — used for program/tournament sign-ups
// rather than a plain court reservation — has its own real subject,
// "Registration Confirmation - <event name>", which contains neither
// "reservation" nor "booking" and so wouldn't match the pattern above.
// Checked as its own subject/body shape (issue #96) rather than folded into
// CONFIRMATION_SUBJECT_PATTERN, since its body uses a different heading set
// (see `classifyBySubject`'s "registration" result and its callers below).
const REGISTRATION_CONFIRMATION_SUBJECT_PATTERN = /\bregistration\s+confirmation\b/i;
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
// CourtReserve's real subject is "Reservation Update Notice" — checked ahead
// of CONFIRMATION_SUBJECT_PATTERN since neither word appears there, so
// there's no ordering conflict, but checked after the cancellation check for
// the same defensive reason: an update subject that somehow also read as a
// cancellation should stay a cancellation, not a guess between the two.
const RESERVATION_UPDATE_SUBJECT_PATTERN = /\breservation\b.*\bupdate\b|\bupdate\b.*\breservation\b/i;

type ParsedEmailKind = "confirmation" | "cancellation" | "update" | "registration";

/**
 * Each kind's own heading names — a lookup table rather than a per-field
 * ternary chain, so a third template variant is one object literal edit
 * instead of several scattered ternary branches, and TypeScript's `Record`
 * requires every kind to have an entry (a missing one is a compile error,
 * not a silent fallback to the wrong heading).
 */
const DETAILS_HEADING_BY_KIND: Record<ParsedEmailKind, string> = {
  confirmation: "Details",
  cancellation: "Cancellation Details",
  update: "Reservation Details",
  registration: "Event",
};

/** Cancellation has no Player(s)-equivalent section at all — its own branch returns before this is ever read. */
const PLAYERS_HEADING_BY_KIND: Record<Exclude<ParsedEmailKind, "cancellation">, string> = {
  confirmation: "Player(s)",
  update: "Player(s)",
  registration: "Registered Team(s)",
};

/**
 * The subject line is CourtReserve's own signal for which template an email
 * uses — cheaper and more reliable than inferring from body content, and it's
 * what lets a waitlist/membership email (this function's `null` result) be
 * recognized and skipped before ever trying to parse its body as one.
 */
function classifyBySubject(subject: string): ParsedEmailKind | null {
  const looksLikeCancellation =
    CANCELLATION_WORD_PATTERN.test(subject) && !CANCELLATION_POLICY_PATTERN.test(subject);

  if (looksLikeCancellation) {
    return "cancellation";
  }
  if (RESERVATION_UPDATE_SUBJECT_PATTERN.test(subject)) {
    return "update";
  }
  if (REGISTRATION_CONFIRMATION_SUBJECT_PATTERN.test(subject)) {
    return "registration";
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

    const detailsHtml = extractSection(email.html, DETAILS_HEADING_BY_KIND[kind]);
    const detailsLines = detailsHtml ? splitSectionLines(detailsHtml) : [];

    // A confirmation's Details block is exactly [format, date, time] — a
    // registration's own Event block is the same three-line shape, just
    // under a different heading (its first line is the event's name rather
    // than a literal "Singles"/"Doubles", but `name`/`format` are still read
    // off it the same way below). A cancellation's Cancellation Details
    // block prepends the player's own name, making it [name, format, date,
    // time] — the last three lines are the same shape either way, so the
    // (optional) leading name is simply ignored. An update's own Reservation
    // Details block instead *appends* the court label as a trailing line
    // after time, with no separate Court(s) section at all (real captured
    // "Reservation Update Notice" email — see the real-fixture test below)
    // — so it's read from the front, not the back, and the court comes from
    // whatever's left over rather than a second `extractSection` call.
    const [formatText, dateText, timeText, ...inlineCourtLines] =
      kind === "update" ? detailsLines : [...detailsLines.slice(-3)];
    const inlineCourtText = inlineCourtLines.length > 0 ? inlineCourtLines.join(" ").trim() || null : null;

    const date = dateText ? parseHumanDate(dateText) : null;
    const timeRange = timeText ? parseTimeRange(timeText) : null;

    if (!facilityName || !date || !timeRange) {
      return { kind: "unparseable" };
    }

    if (kind === "cancellation") {
      return {
        kind: "cancellation",
        cancellation: { facilityName, date, startTime: timeRange.start, courtLabel: extractCourtSectionLabel(email.html) },
      };
    }

    const courtLabel = kind === "update" ? inlineCourtText : extractCourtSectionLabel(email.html);

    const format = parseFormat(formatText ?? null);
    // A registration's own "Registered Team(s)" section replaces "Player(s)"
    // — same raw shape (a comma-joined name list, `<br>`-split when there's
    // more than one team), read with the same extractor/parser either way,
    // aside from its own "Team:" label (stripped below).
    const playersSectionHtml = extractSection(email.html, PLAYERS_HEADING_BY_KIND[kind]);
    const rawPlayerText = playersSectionHtml
      ? decodeHtmlEntities(stripTags(playersSectionHtml)).replace(/\s+/g, " ").trim()
      : null;
    const playerNames = splitPlayerNames(
      kind === "registration" && rawPlayerText ? stripTeamLabel(rawPlayerText) : rawPlayerText,
    );

    const parsed = {
      facilityName,
      date,
      startTime: timeRange.start,
      endTime: timeRange.end,
      courtLabel,
      format,
      // Same raw line `format` was parsed from — not lowercased/normalized
      // the way `format` is, since this is a display label, not an enum.
      name: formatText ?? "",
      playerNames,
    };

    // A registration's own Event/Registered Team(s) fields collapse into the
    // exact same CourtReserveConfirmation shape a "Details"/"Player(s)"
    // confirmation already produces, so every downstream consumer (Import
    // Candidate matching, review-card display, confirm/dismiss) needs no
    // changes at all to support this second template.
    return kind === "update" ? { kind: "update", update: parsed } : { kind: "confirmation", confirmation: parsed };
  } catch {
    return { kind: "unparseable" };
  }
}

export const COURTRESERVE_SENDER = "notifications@courtreserve.com";

/** How far back "Sync from Email" looks, every call — no stored cursor/watermark (#59's design decision). */
export const COURTRESERVE_SEARCH_WINDOW_DAYS = 90;

/**
 * Provider-neutral mailbox-search criteria scoped to CourtReserve's
 * notification address and the last `COURTRESERVE_SEARCH_WINDOW_DAYS` days —
 * never a whole-inbox search (issue #62's Settings copy already promises this
 * to the User). Each `MailAdapter` formats its own query dialect from this
 * (Gmail `q` syntax, Microsoft Graph `$filter`); the caller only ever sees
 * the neutral `{ sender, after }` shape (spec #280).
 */
export function buildCourtReserveSearchCriteria(now: Date): { sender: string; after: Date } {
  const after = new Date(now);
  after.setDate(after.getDate() - COURTRESERVE_SEARCH_WINDOW_DAYS);

  return { sender: COURTRESERVE_SENDER, after };
}
