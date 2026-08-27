/**
 * The composed "raw CourtReserve emails → Import Candidate review lists"
 * algorithm (issue #180) — everything `syncFromEmail` (`actions/email-sync.ts`)
 * does between fetching the messages and returning them, minus the I/O.
 *
 * `email-sync-matching.ts` and `courtreserve-email.ts` hold the leaf
 * primitives (parse one email, match one facility name, net one identity
 * chain, …), each unit tested in isolation. This module is the one place they
 * are wired together: parse → drop the unparseable → net the batch
 * (`reconcileCourtReserveEvents`) → shape each survivor into the exact
 * `ImportCandidate` / `CancellationCandidate` / `UpdateCandidate` the review
 * screen renders → sort. That wiring — filter ordering, which match drives the
 * time zone, the past-date and duplicate drops, the court-label overflow
 * split — is where the feature's bugs have lived (#88, #91, #96, #100, #166),
 * and until this module existed it could only run against a live Gmail inbox
 * and a real database.
 *
 * Free of Next.js and Supabase imports on purpose, same discipline as its two
 * siblings: `syncFromEmail` resolves the real rows (the caller's Orgs,
 * Bookings, Connections) and the raw message bodies, hands them in as plain
 * data, and does nothing with the result but wrap it in a status envelope.
 * The `processed_gmail_messages` "already seen" filter stays in the action —
 * it is a database fact that decides which messages to fetch at all, with no
 * bearing on how a fetched one is parsed or matched.
 */

import {
  parseCourtReserveEmail,
  type CourtReserveConfirmation,
} from "./courtreserve-email.ts";
import { splitOverlongCourtLabel, stripCourtLabelPrefix } from "./bookings.ts";
import type { BookingFormat } from "./capacity.ts";
import {
  isDuplicateBooking,
  isPastConfirmation,
  matchCancellationToBooking,
  matchOrgByName,
  matchPlayerNamesToConnections,
  matchUpdateToBooking,
  reconcileCourtReserveEvents,
  type BookingIdentity,
  type ConnectionCandidate,
  type OrgCandidate,
  type PlayerMatch,
  type ReconciliationEvent,
} from "./email-sync-matching.ts";

/**
 * One parsed CourtReserve confirmation, matched against the caller's own
 * Orgs and Connections but not yet applied — CONTEXT.md's Import Candidate
 * (issue #64), assembled by `reviewCourtReserveEmails`.
 * `endTime`/`format`/`date`/`startTime`/`courtLabel` are shown read-only on
 * the review screen; `matchedOrgId` is the only field the User still has to
 * pick when it's `null`.
 */
export type ImportCandidate = {
  gmailMessageId: string;
  facilityName: string;
  /** Set only when the facility name matched an existing Org (`matchOrgByName`). */
  matchedOrgId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  /** Already stripped of its leading "Court" word — see `stripCourtLabelPrefix`. Null when the raw text ran over the court-label length limit; the full text lands in `notes` instead (see `splitOverlongCourtLabel`). */
  courtLabel: string | null;
  /** Set only when the email's own Court(s) text was too long for `courtLabel` — carries that full text through instead of silently dropping it. */
  notes: string | null;
  format: BookingFormat;
  /** The parsed email's own Details-section name (issue #95) — read-only on the review card, same as Format/date/time/court. */
  name: string;
  /** Reference-only, per CONTEXT.md's Import Candidate entry — nothing is created or invited from a match. */
  matchedPlayers: PlayerMatch[];
};

/**
 * One parsed CourtReserve cancellation, matched against the caller's own
 * Bookings (issue #65). `matched: false` is CONTEXT.md's Import Candidate
 * entry's own framing of a cancellation with no Booking on file — surfaced as
 * a distinct notice rather than silently dropped, since it's a signal the
 * User's records may be out of sync.
 */
export type CancellationCandidate = {
  gmailMessageId: string;
  facilityName: string;
  date: string;
  startTime: string;
  /** Always null in practice — a real cancellation email carries no Court(s) section (see courtreserve-email.ts). Kept for display parity with a confirmation candidate. */
  courtLabel: string | null;
} & ({ matched: true; bookingId: string } | { matched: false });

/**
 * One parsed Reservation Update Notice, matched against the caller's own
 * Bookings the same way a cancellation is (issue #91) — reached only when
 * `reconcileCourtReserveEvents` had nothing in this batch to net it against;
 * an update that *did* net against an in-batch confirmation never becomes one
 * of these at all, it's folded into that confirmation's own `ImportCandidate`.
 * `matched: false` mirrors `CancellationCandidate`'s own framing of "nothing
 * on file this could refer to" as a distinct notice rather than a silent drop.
 */
export type UpdateCandidate = {
  gmailMessageId: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Already stripped of its leading "Court" word — see `stripCourtLabelPrefix`. Null when the raw text ran over the court-label length limit; the full text lands in `notes` instead (see `splitOverlongCourtLabel`). */
  courtLabel: string | null;
  /** Set only when the email's own Court(s) text was too long for `courtLabel` — carries that full text through instead of silently dropping it. */
  notes: string | null;
  format: BookingFormat;
  /** Reference-only — unlike `ImportCandidate.matchedPlayers` (wired through by issue #100), applying an update deliberately edits format/court only and never touches Players, since a Reservation Update Notice isn't a new Booking. */
  matchedPlayers: PlayerMatch[];
} & ({ matched: true; bookingId: string } | { matched: false });

export type ReviewedCourtReserveEmails = {
  candidates: ImportCandidate[];
  cancellations: CancellationCandidate[];
  updates: UpdateCandidate[];
};

/** One raw Gmail message body, exactly what `fetchGmailMessage` returns plus its own id — the only thing the action has to fetch before this module can run. */
export type RawCourtReserveEmail = {
  gmailMessageId: string;
  subject: string;
  html: string;
  receivedAt: number;
};

/** An Org narrowed to what matching and time-zone resolution need — the action maps its own `Org[]` down to this. */
export type OrgForReview = OrgCandidate & { timeZone: string };

export type ReviewCourtReserveEmailsInput = {
  /** Unseen messages only — the caller has already filtered out anything in `processed_gmail_messages`. */
  emails: readonly RawCourtReserveEmail[];
  orgs: readonly OrgForReview[];
  /** The caller's existing Bookings, each with the id `confirmCancellationCandidate`/`confirmUpdateCandidate` will act on. */
  existingBookings: readonly (BookingIdentity & { id: string })[];
  connectionCandidates: readonly ConnectionCandidate[];
  /** Passed in, never read from the clock here — determinism, same as the rest of this app. */
  now: Date;
};

/** Earliest slot first for display — `date` (`YYYY-MM-DD`) and `startTime` (`HH:MM`, 24-hour) both sort correctly as plain strings. */
function byDateAndStartTime(
  a: { date: string; startTime: string },
  b: { date: string; startTime: string },
): number {
  return a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date);
}

/** A confirmation whose parsed time range survived the "no end time" drop — `endTime` reads as the non-null string it now always is downstream. */
type ConfirmedEmail = CourtReserveConfirmation & { endTime: string };

type ReviewContext = {
  orgCandidates: OrgCandidate[];
  orgTimeZoneById: Map<string, string>;
  existingBookings: readonly (BookingIdentity & { id: string })[];
  connectionCandidates: readonly ConnectionCandidate[];
  now: Date;
};

/**
 * Parses every raw message into a plain reconciliation event, carrying its
 * own `receivedAt` — the raw material `reconcileCourtReserveEvents` needs to
 * net a confirm/cancel/confirm/... chain for the same slot (issue #88) before
 * any Org-matching / duplicate / past-date logic runs on it.
 *
 * A `not_a_booking`/`unparseable` parse is simply skipped, so is a
 * confirmation or update with a malformed time range ("no end time" — see
 * courtreserve-email.ts): the review screen has no field for fixing one, so
 * it's dropped here rather than surfaced. Neither is recorded in
 * `processed_gmail_messages` by the caller — there's nothing actionable to
 * remember either way, and a later sync still sees it fresh.
 */
function toReconciliationEvents(
  emails: readonly RawCourtReserveEmail[],
): ReconciliationEvent<ConfirmedEmail>[] {
  const events: ReconciliationEvent<ConfirmedEmail>[] = [];

  for (const email of emails) {
    const parsed = parseCourtReserveEmail({ subject: email.subject, html: email.html });

    if (parsed.kind === "cancellation") {
      const { cancellation } = parsed;
      events.push({
        kind: "cancellation",
        gmailMessageId: email.gmailMessageId,
        receivedAt: email.receivedAt,
        facilityName: cancellation.facilityName,
        date: cancellation.date,
        startTime: cancellation.startTime,
        courtLabel: stripCourtLabelPrefix(cancellation.courtLabel),
      });
      continue;
    }

    if (parsed.kind === "update") {
      const { update } = parsed;
      if (!update.endTime) {
        continue;
      }
      events.push({
        kind: "update",
        gmailMessageId: email.gmailMessageId,
        receivedAt: email.receivedAt,
        facilityName: update.facilityName,
        date: update.date,
        startTime: update.startTime,
        update: { ...update, endTime: update.endTime },
      });
      continue;
    }

    if (parsed.kind !== "confirmation") {
      continue;
    }

    const { confirmation } = parsed;
    if (!confirmation.endTime) {
      continue;
    }

    events.push({
      kind: "confirmation",
      gmailMessageId: email.gmailMessageId,
      receivedAt: email.receivedAt,
      facilityName: confirmation.facilityName,
      date: confirmation.date,
      startTime: confirmation.startTime,
      confirmation: { ...confirmation, endTime: confirmation.endTime },
    });
  }

  return events;
}

/** No matched Org means no known zone yet — the User hasn't added this facility. UTC is a coarse stand-in for the calendar-day-only past check, not a claim about the real zone. */
function zoneFor(matchedOrgId: string | null, ctx: ReviewContext): string {
  return matchedOrgId ? (ctx.orgTimeZoneById.get(matchedOrgId) ?? "UTC") : "UTC";
}

/**
 * A reconciled confirmation → an `ImportCandidate`, or `null` when it
 * shouldn't reach the review queue at all: a date/time already passed, or a
 * duplicate of a Booking already on file (same Org, court, date/time — the
 * fields a real second reservation would also share).
 */
function shapeImportCandidate(
  event: Extract<ReconciliationEvent<ConfirmedEmail>, { kind: "confirmation" }>,
  ctx: ReviewContext,
): ImportCandidate | null {
  const { confirmation } = event;

  const matchedOrgId = matchOrgByName(confirmation.facilityName, ctx.orgCandidates);

  if (isPastConfirmation(confirmation, zoneFor(matchedOrgId, ctx), ctx.now)) {
    return null;
  }

  const { courtLabel, notes } = splitOverlongCourtLabel(stripCourtLabelPrefix(confirmation.courtLabel));

  if (
    matchedOrgId &&
    isDuplicateBooking(
      { orgId: matchedOrgId, courtLabel, date: confirmation.date, startTime: confirmation.startTime },
      ctx.existingBookings,
    )
  ) {
    return null;
  }

  return {
    gmailMessageId: event.gmailMessageId,
    facilityName: confirmation.facilityName,
    matchedOrgId,
    date: confirmation.date,
    startTime: confirmation.startTime,
    endTime: confirmation.endTime,
    courtLabel,
    notes,
    format: confirmation.format,
    name: confirmation.name,
    matchedPlayers: matchPlayerNamesToConnections(confirmation.playerNames, ctx.connectionCandidates),
  };
}

/** A reconciled cancellation → a `CancellationCandidate`, matched to a Booking on file or surfaced as the "no match found" notice. */
function shapeCancellationCandidate(
  event: Extract<ReconciliationEvent<ConfirmedEmail>, { kind: "cancellation" }>,
  ctx: ReviewContext,
): CancellationCandidate {
  const matchedOrgId = matchOrgByName(event.facilityName, ctx.orgCandidates);

  // No matched Org means there's nothing on file it could refer to either —
  // same reasoning `matchCancellationToBooking` itself can't apply without one.
  const bookingId = matchedOrgId
    ? matchCancellationToBooking(
        { orgId: matchedOrgId, date: event.date, startTime: event.startTime },
        ctx.existingBookings,
      )
    : null;

  const base = {
    gmailMessageId: event.gmailMessageId,
    facilityName: event.facilityName,
    date: event.date,
    startTime: event.startTime,
    courtLabel: event.courtLabel,
  };

  return bookingId ? { ...base, matched: true, bookingId } : { ...base, matched: false };
}

/**
 * A reconciled update → an `UpdateCandidate`, or `null` when its slot has
 * already passed (same reasoning as a confirmation's own past-date filter — a
 * Reservation Update for a slot that's already happened isn't worth review).
 */
function shapeUpdateCandidate(
  event: Extract<ReconciliationEvent<ConfirmedEmail>, { kind: "update" }>,
  ctx: ReviewContext,
): UpdateCandidate | null {
  const { update } = event;

  const matchedOrgId = matchOrgByName(update.facilityName, ctx.orgCandidates);

  if (isPastConfirmation(update, zoneFor(matchedOrgId, ctx), ctx.now)) {
    return null;
  }

  const bookingId = matchedOrgId
    ? matchUpdateToBooking(
        { orgId: matchedOrgId, date: update.date, startTime: update.startTime },
        ctx.existingBookings,
      )
    : null;

  const { courtLabel, notes } = splitOverlongCourtLabel(stripCourtLabelPrefix(update.courtLabel));

  const base = {
    gmailMessageId: event.gmailMessageId,
    facilityName: update.facilityName,
    date: update.date,
    startTime: update.startTime,
    endTime: update.endTime,
    courtLabel,
    notes,
    format: update.format,
    matchedPlayers: matchPlayerNamesToConnections(update.playerNames, ctx.connectionCandidates),
  };

  return bookingId ? { ...base, matched: true, bookingId } : { ...base, matched: false };
}

/**
 * Turn a batch of raw CourtReserve message bodies into the three lists the
 * "Sync from Email" review screen renders (issues #64/#65/#91).
 *
 * Pure: every decision is made from the message HTML and the plain data the
 * caller hands in. `syncFromEmail` does the Gmail search/fetch and the
 * Supabase reads, calls this once, and wraps the result in its status
 * envelope.
 */
export function reviewCourtReserveEmails({
  emails,
  orgs,
  existingBookings,
  connectionCandidates,
  now,
}: ReviewCourtReserveEmailsInput): ReviewedCourtReserveEmails {
  const ctx: ReviewContext = {
    orgCandidates: orgs.map((org) => ({ orgId: org.orgId, displayName: org.displayName })),
    orgTimeZoneById: new Map(orgs.map((org) => [org.orgId, org.timeZone])),
    existingBookings,
    connectionCandidates,
    now,
  };

  const reconciled = reconcileCourtReserveEvents(toReconciliationEvents(emails));

  const candidates = reconciled.confirmations
    .map((event) => shapeImportCandidate(event, ctx))
    .filter((candidate): candidate is ImportCandidate => candidate !== null)
    .sort(byDateAndStartTime);

  const cancellations = reconciled.cancellations
    .map((event) => shapeCancellationCandidate(event, ctx))
    .sort(byDateAndStartTime);

  const updates = reconciled.updates
    .map((event) => shapeUpdateCandidate(event, ctx))
    .filter((candidate): candidate is UpdateCandidate => candidate !== null)
    .sort(byDateAndStartTime);

  return { candidates, cancellations, updates };
}
