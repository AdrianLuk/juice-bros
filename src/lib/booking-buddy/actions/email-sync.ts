"use server";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SETTINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { getOwnProfile } from "./profile.ts";
import { isEmailSyncAllowed } from "../email-sync-allowlist.ts";
import { readEmailSyncAllowlist, requireMailboxLinkEncryptionKey } from "../env.ts";
import {
  buildGoogleAuthorizeUrl,
  fetchGmailMessage,
  refreshAccessToken,
  searchGmailMessages,
} from "../gmail-client.ts";
import { GMAIL_OAUTH_STATE_COOKIE } from "../gmail-oauth.ts";
import { absoluteAppUrl } from "../request-origin.ts";
import { decryptRefreshToken } from "../token-encryption.ts";
import {
  buildCourtReserveSearchQuery,
  parseCourtReserveEmail,
  type CourtReserveConfirmation,
} from "../courtreserve-email.ts";
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
} from "../email-sync-matching.ts";
import { parseNewBooking, stripCourtLabelPrefix } from "../bookings.ts";
import { todayInZone, clockInZone } from "../datetime.ts";
import { isBookingFormat, type BookingFormat } from "../capacity.ts";
import {
  deleteOwnedBooking,
  getBookingsPageData,
  insertValidatedBooking,
  updateOwnedBookingFormatAndCourt,
} from "./bookings.ts";
import { listConnections } from "./connections.ts";

export type { ActionResult } from "./result.ts";

export type MailboxLink = {
  googleAccountEmail: string;
  status: "active" | "expired";
  connectedAt: string;
} | null;

function gmailCallbackUrl(): Promise<string> {
  return absoluteAppUrl("/booking-buddy/settings/gmail-callback");
}

/**
 * Whether the signed-in User is allowed to see/use email sync at all
 * (ADR-0009's addendum) — the optimistic half. `connectGmail` below re-checks
 * this authoritatively.
 *
 * Fetches the profile itself rather than taking a `username` param: the one
 * caller that already has a profile in hand (the Settings page) calls
 * `isEmailSyncAllowed` directly instead of going through here, so this stays
 * the "I don't already have one" convenience path, not a second query on
 * top of one a caller already ran.
 */
export async function isEmailSyncAllowedForCaller(): Promise<boolean> {
  const profile = await getOwnProfile();
  return isEmailSyncAllowed(profile.username, readEmailSyncAllowlist());
}

/** The signed-in User's own Mailbox Link, or `null` if Gmail isn't connected. */
export async function getMailboxLink(): Promise<MailboxLink> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mailbox_links")
    .select("google_account_email, status, connected_at")
    .eq("owner_id", session.userId)
    .maybeSingle();

  if (error) {
    readFailed("your Gmail connection", error);
  }

  if (!data) {
    return null;
  }

  return {
    googleAccountEmail: data.google_account_email,
    status: data.status,
    connectedAt: data.connected_at,
  };
}

/**
 * Starts the Google OAuth redirect. Rejects a non-allowlisted User even if
 * they reach this directly — the Settings page not rendering the button is
 * the optimistic half, this is the authoritative one (ADR-0009's addendum,
 * same shape `verifySession` already established).
 */
export async function connectGmail(): Promise<void> {
  await verifySession();

  const allowed = await isEmailSyncAllowedForCaller();
  if (!allowed) {
    redirect(`${SETTINGS_PATH}?error=email_sync_not_allowed`);
  }

  const state = randomBytes(16).toString("hex");

  // Built before setting the cookie: if the OAuth client isn't configured
  // (a plausible partial-deploy state — see PROGRESS.md's own note that
  // these vars aren't set on Vercel yet), this throws, and the redirect
  // below should report a normal "couldn't connect" rather than a raw 500.
  let authorizeUrl: string;
  try {
    authorizeUrl = buildGoogleAuthorizeUrl(await gmailCallbackUrl(), state);
  } catch (error) {
    console.error("booking-buddy: Gmail OAuth client isn't configured", error);
    redirect(`${SETTINGS_PATH}?error=gmail_connect_failed`);
  }

  (await cookies()).set(GMAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  redirect(authorizeUrl);
}

export async function disconnectGmail(): Promise<ActionResult> {
  const session = await verifySession();
  const supabase = await createClient();

  // Unlike deleteOrg's zero-row check, a missing row here isn't ambiguous:
  // the delete is already scoped to the caller's own owner_id, so "zero
  // rows" only ever means "there was nothing connected" (e.g. a stale
  // double-click), never "you tried to touch someone else's Mailbox Link" —
  // there's no id from user input this could target instead.
  const { error } = await supabase
    .from("mailbox_links")
    .delete()
    .eq("owner_id", session.userId);

  if (error) {
    return { error: "Couldn't disconnect Gmail. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

/**
 * One parsed CourtReserve confirmation, matched against the caller's own
 * Orgs and Connections but not yet applied — CONTEXT.md's Import Candidate
 * (issue #64). `endTime`/`format`/`date`/`startTime`/`courtLabel` are shown
 * read-only on the review screen; `matchedOrgId` is the only field the User
 * still has to pick when it's `null`.
 */
export type ImportCandidate = {
  gmailMessageId: string;
  facilityName: string;
  /** Set only when the facility name matched an existing Org (`matchOrgByName`). */
  matchedOrgId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  /** Already stripped of its leading "Court" word — see `stripCourtLabelPrefix`. */
  courtLabel: string | null;
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
 * `syncFromEmail`'s own reconciliation had nothing in this batch to net it
 * against (see `reconcileCourtReserveEvents`'s own header comment); an update
 * that *did* net against an in-batch confirmation never becomes one of these
 * at all, it's folded into that confirmation's own `ImportCandidate`.
 * `matched: false` mirrors `CancellationCandidate`'s own framing of "nothing
 * on file this could refer to" as a distinct notice rather than a silent drop.
 */
export type UpdateCandidate = {
  gmailMessageId: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Already stripped of its leading "Court" word — see `stripCourtLabelPrefix`. */
  courtLabel: string | null;
  format: BookingFormat;
  /** Reference-only, same posture as `ImportCandidate.matchedPlayers` — a Booking doesn't store players at all. */
  matchedPlayers: PlayerMatch[];
} & ({ matched: true; bookingId: string } | { matched: false });

export type SyncFromEmailResult =
  | {
      status: "ok";
      candidates: ImportCandidate[];
      cancellations: CancellationCandidate[];
      updates: UpdateCandidate[];
    }
  | { status: "reconnect_required" }
  | { status: "error"; message: string };

/** Earliest slot first for display — `date` (`YYYY-MM-DD`) and `startTime` (`HH:MM`, 24-hour) both sort correctly as plain strings. */
function byDateAndStartTime(a: { date: string; startTime: string }, b: { date: string; startTime: string }): number {
  return a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date);
}

/**
 * Runs a live Gmail search for CourtReserve confirmations and cancellations,
 * parses/matches whatever comes back, and returns the ones worth a User's
 * review (issues #64/#65). A plain async function rather than a
 * `useActionState`-bound one: the caller (a click-triggered `useQuery`)
 * wants a promise it can call by name, not a form to submit.
 *
 * A `not_a_booking`/`unparseable` parse is simply skipped, and neither is
 * recorded in `processed_gmail_messages`, so a later sync still sees it
 * fresh — there's nothing actionable to remember either way.
 */
export async function syncFromEmail(): Promise<SyncFromEmailResult> {
  const session = await verifySession();

  // Authoritative re-check (ADR-0009's addendum) — the Bookings page not
  // rendering this section at all for a disallowed User is the optimistic
  // half; a User removed from the allowlist after already connecting Gmail
  // must not be able to keep syncing just by having a stale page open.
  const allowed = await isEmailSyncAllowedForCaller();
  if (!allowed) {
    return { status: "error", message: "Your account isn't approved for email sync." };
  }

  const supabase = await createClient();

  const { data: link, error: linkError } = await supabase
    .from("mailbox_links")
    .select("encrypted_refresh_token, status")
    .eq("owner_id", session.userId)
    .maybeSingle();

  if (linkError) {
    console.error("booking-buddy: reading the Mailbox Link for sync failed", linkError);
    return { status: "error", message: "Couldn't sync from email. Try again." };
  }

  if (!link || link.status === "expired") {
    return { status: "reconnect_required" };
  }

  let encryptionKey: string;
  try {
    encryptionKey = requireMailboxLinkEncryptionKey();
  } catch (error) {
    console.error("booking-buddy: Mailbox Link encryption key isn't configured", error);
    return { status: "error", message: "Couldn't sync from email. Try again." };
  }

  const decrypted = decryptRefreshToken(link.encrypted_refresh_token, encryptionKey);
  if (!decrypted.ok) {
    // A refresh token that no longer decrypts (a rotated encryption key, a
    // corrupted row) is just as unusable as an expired one — the User's own
    // fix is the same either way: reconnect.
    console.error("booking-buddy: decrypting the Mailbox Link's refresh token failed");
    return { status: "reconnect_required" };
  }

  const refreshed = await refreshAccessToken(decrypted.plainText);
  if (!refreshed.ok) {
    if (refreshed.reason === "invalid_grant") {
      await supabase.from("mailbox_links").update({ status: "expired" }).eq("owner_id", session.userId);
      revalidatePath(SETTINGS_PATH);
      return { status: "reconnect_required" };
    }
    return { status: "error", message: "Couldn't reach Gmail. Try again." };
  }

  const searchResult = await searchGmailMessages(
    refreshed.accessToken,
    buildCourtReserveSearchQuery(new Date()),
  );
  if (!searchResult.ok) {
    return { status: "error", message: "Couldn't reach Gmail. Try again." };
  }

  const { data: processedRows, error: processedError } = await supabase
    .from("processed_gmail_messages")
    .select("gmail_message_id")
    .eq("owner_id", session.userId);

  if (processedError) {
    console.error("booking-buddy: reading processed Gmail messages failed", processedError);
    return { status: "error", message: "Couldn't sync from email. Try again." };
  }

  const processedIds = new Set((processedRows ?? []).map((row) => row.gmail_message_id));
  const unseenIds = searchResult.messageIds.filter((id) => !processedIds.has(id));

  const [{ orgs, bookings }, connections] = await Promise.all([
    getBookingsPageData(),
    listConnections(),
  ]);

  const orgCandidates: OrgCandidate[] = orgs.map((org) => ({ orgId: org.id, displayName: org.displayName }));
  const orgTimeZoneById = new Map(orgs.map((org) => [org.id, org.timeZone]));

  // Each existing Booking's own wall-clock date/start time, read back in its
  // own Org's zone — the same shape `isDuplicateBooking`/`isPastConfirmation`
  // compare a candidate against. `todayInZone`/`clockInZone` work for any
  // instant, not just "now", despite the name. `id` rides along too, only
  // for `matchCancellationToBooking`'s benefit (issue #65) — it's the thing
  // `confirmCancellationCandidate` actually needs to delete.
  const existingBookings: (BookingIdentity & { id: string })[] = bookings.map((booking) => ({
    id: booking.id,
    orgId: booking.orgId,
    courtLabel: booking.courtLabel,
    date: todayInZone(booking.timeZone, new Date(booking.startsAt)),
    startTime: clockInZone(booking.timeZone, new Date(booking.startsAt)),
  }));

  const connectionCandidates: ConnectionCandidate[] = connections.friends
    .filter((friend): friend is typeof friend & { displayName: string } => friend.displayName !== null)
    .map((friend) => ({ userId: friend.userId, displayName: friend.displayName }));

  const now = new Date();

  // A malformed time range ("no end time" — see courtreserve-email.ts) isn't
  // something the review screen has a field for fixing, so it's filtered out
  // before reconciliation too — same as before, just narrowed here rather
  // than after, so `endTime` reads as the non-null string it now always is
  // downstream.
  type ConfirmedEmail = CourtReserveConfirmation & { endTime: string };

  // Phase 1: parse every unseen message into a plain event, carrying its own
  // `receivedAt` — the raw material `reconcileCourtReserveEvents` needs to
  // net a confirm/cancel/confirm/... chain for the same slot down to its
  // real end state (issue #88) before any of the existing Org-matching/
  // duplicate/past-date logic below ever runs on it.
  const events: ReconciliationEvent<ConfirmedEmail>[] = [];

  for (const messageId of unseenIds) {
    const fetched = await fetchGmailMessage(refreshed.accessToken, messageId);
    if (!fetched.ok) {
      // One unreadable message shouldn't sink the whole sync.
      console.error("booking-buddy: fetching a Gmail message failed", messageId);
      continue;
    }

    const parsed = parseCourtReserveEmail(fetched.email);

    if (parsed.kind === "cancellation") {
      const { cancellation } = parsed;
      events.push({
        kind: "cancellation",
        gmailMessageId: messageId,
        receivedAt: fetched.email.receivedAt,
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
        gmailMessageId: messageId,
        receivedAt: fetched.email.receivedAt,
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
      gmailMessageId: messageId,
      receivedAt: fetched.email.receivedAt,
      facilityName: confirmation.facilityName,
      date: confirmation.date,
      startTime: confirmation.startTime,
      confirmation: { ...confirmation, endTime: confirmation.endTime },
    });
  }

  const reconciled = reconcileCourtReserveEvents(events);

  const candidates: ImportCandidate[] = [];
  const cancellations: CancellationCandidate[] = [];
  const updates: UpdateCandidate[] = [];

  // Phase 2: the exact same per-email logic as before, just applied to the
  // reconciled survivors rather than every raw parsed email.
  for (const event of reconciled.updates) {
    const { update } = event;

    const matchedOrgId = matchOrgByName(update.facilityName, orgCandidates);
    const zone = matchedOrgId ? (orgTimeZoneById.get(matchedOrgId) ?? "UTC") : "UTC";

    // Same reasoning as a confirmation's own filter: a Reservation Update
    // for a slot that's already passed isn't worth a User's review either.
    if (isPastConfirmation(update, zone, now)) {
      continue;
    }

    // No matched Org means there's nothing on file it could refer to either
    // — same reasoning `matchCancellationToBooking` itself can't apply
    // without one.
    const bookingId = matchedOrgId
      ? matchUpdateToBooking({ orgId: matchedOrgId, date: update.date, startTime: update.startTime }, existingBookings)
      : null;

    const updateBase = {
      gmailMessageId: event.gmailMessageId,
      facilityName: update.facilityName,
      date: update.date,
      startTime: update.startTime,
      endTime: update.endTime,
      courtLabel: stripCourtLabelPrefix(update.courtLabel),
      format: update.format,
      matchedPlayers: matchPlayerNamesToConnections(update.playerNames, connectionCandidates),
    };

    updates.push(bookingId ? { ...updateBase, matched: true, bookingId } : { ...updateBase, matched: false });
  }

  for (const event of reconciled.cancellations) {
    const matchedOrgId = matchOrgByName(event.facilityName, orgCandidates);

    // No matched Org means there's nothing on file it could refer to
    // either — same reasoning `matchCancellationToBooking` itself can't
    // apply without one.
    const bookingId = matchedOrgId
      ? matchCancellationToBooking(
          { orgId: matchedOrgId, date: event.date, startTime: event.startTime },
          existingBookings,
        )
      : null;

    const cancellationBase = {
      gmailMessageId: event.gmailMessageId,
      facilityName: event.facilityName,
      date: event.date,
      startTime: event.startTime,
      courtLabel: event.courtLabel,
    };

    cancellations.push(
      bookingId
        ? { ...cancellationBase, matched: true, bookingId }
        : { ...cancellationBase, matched: false },
    );
  }

  for (const event of reconciled.confirmations) {
    const { confirmation } = event;

    const matchedOrgId = matchOrgByName(confirmation.facilityName, orgCandidates);
    // No matched Org means no known zone yet either — the User hasn't added
    // this facility, so there's nothing to ask it. UTC is a coarse stand-in
    // for this calendar-day-only check, not a claim about the real zone.
    const zone = matchedOrgId ? (orgTimeZoneById.get(matchedOrgId) ?? "UTC") : "UTC";

    if (isPastConfirmation(confirmation, zone, now)) {
      continue;
    }

    const courtLabel = stripCourtLabelPrefix(confirmation.courtLabel);

    if (
      matchedOrgId &&
      isDuplicateBooking(
        { orgId: matchedOrgId, courtLabel, date: confirmation.date, startTime: confirmation.startTime },
        existingBookings,
      )
    ) {
      continue;
    }

    candidates.push({
      gmailMessageId: event.gmailMessageId,
      facilityName: confirmation.facilityName,
      matchedOrgId,
      date: confirmation.date,
      startTime: confirmation.startTime,
      endTime: confirmation.endTime,
      courtLabel,
      format: confirmation.format,
      name: confirmation.name,
      matchedPlayers: matchPlayerNamesToConnections(confirmation.playerNames, connectionCandidates),
    });
  }

  candidates.sort(byDateAndStartTime);
  cancellations.sort(byDateAndStartTime);
  updates.sort(byDateAndStartTime);

  return { status: "ok", candidates, cancellations, updates };
}

/**
 * Confirming an Import Candidate creates a real Booking (issue #64) — the
 * form posts the exact same field names `CreateBookingForm` does (`org_id`,
 * `name`, `format`, `date`, `start_time`, `end_time`, `court_label`), plus
 * `gmail_message_id`, so it reuses `parseNewBooking`'s validation as-is
 * rather than trusting the candidate's already-parsed fields a second time.
 */
export async function confirmImportCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const allowed = await isEmailSyncAllowedForCaller();
  if (!allowed) {
    return { error: "Your account isn't approved for email sync." };
  }

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  if (!gmailMessageId) {
    return { error: "Couldn't confirm that booking. Try again." };
  }

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const result = await insertValidatedBooking(session.userId, parsed);
  if (!result.ok) {
    return result;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("processed_gmail_messages").insert({
    owner_id: session.userId,
    gmail_message_id: gmailMessageId,
    outcome: "confirmed",
  });

  if (error) {
    // Not fatal — the Booking is real either way. Even if this record never
    // lands, a later sync's own `isDuplicateBooking` filter catches a
    // re-parse of the same email against the Booking just created.
    console.error("booking-buddy: recording a confirmed Gmail message failed", error);
  }

  return { ok: true };
}

/**
 * Confirming a matched cancellation candidate removes the Booking it refers
 * to (issue #65) — `bookingId` comes from the review screen's own hidden
 * field, which only ever holds what `syncFromEmail`'s own
 * `matchCancellationToBooking` resolved server-side, not anything the User
 * (or a tampered request) picks.
 */
export async function confirmCancellationCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const allowed = await isEmailSyncAllowedForCaller();
  if (!allowed) {
    return { error: "Your account isn't approved for email sync." };
  }

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  if (!gmailMessageId || !bookingId) {
    return { error: "Couldn't remove that booking. Try again." };
  }

  // The candidate's own `bookingId` was resolved against this same caller's
  // Bookings a moment ago, so `deleteOwnedBooking`'s own empty-result error
  // here only realistically means a race (deleted from another tab since).
  const deleteResult = await deleteOwnedBooking(bookingId);
  if (!deleteResult.ok) {
    return deleteResult;
  }

  const supabase = await createClient();
  const { error: recordError } = await supabase.from("processed_gmail_messages").insert({
    owner_id: session.userId,
    gmail_message_id: gmailMessageId,
    outcome: "cancelled",
  });

  if (recordError) {
    // Not fatal — the Booking is already gone either way. Even if this
    // record never lands, the cancellation email simply won't have a
    // matching Booking to resolve to on a later sync, and would instead
    // surface as the "no match found" notice.
    console.error("booking-buddy: recording a cancelled Gmail message failed", recordError);
  }

  return { ok: true };
}

/**
 * Applying a matched update candidate edits the Booking it refers to in
 * place (issue #91) — `booking_id`, `format`, and `court_label` all come
 * from the review screen's own hidden fields, which only ever hold what
 * `syncFromEmail`'s own `matchUpdateToBooking` resolved server-side, not
 * anything the User (or a tampered request) picks. `format`/`court_label`
 * still travel as plain form fields rather than being re-derived from
 * `bookingId` here, same reasoning `confirmCancellationCandidate` doesn't
 * re-parse `formData` through `parseNewBooking` either — the review screen
 * already showed the User exactly what they're about to apply.
 */
export async function confirmUpdateCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const allowed = await isEmailSyncAllowedForCaller();
  if (!allowed) {
    return { error: "Your account isn't approved for email sync." };
  }

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const format = String(formData.get("format") ?? "");
  const courtLabelRaw = String(formData.get("court_label") ?? "");
  if (!gmailMessageId || !bookingId || !isBookingFormat(format)) {
    return { error: "Couldn't update that booking. Try again." };
  }

  const updateResult = await updateOwnedBookingFormatAndCourt(bookingId, {
    format,
    courtLabel: courtLabelRaw || null,
  });
  if (!updateResult.ok) {
    return updateResult;
  }

  const supabase = await createClient();
  const { error: recordError } = await supabase.from("processed_gmail_messages").insert({
    owner_id: session.userId,
    gmail_message_id: gmailMessageId,
    outcome: "updated",
  });

  if (recordError) {
    // Not fatal — the Booking is already updated either way. Even if this
    // record never lands, a later sync's own reconciliation/matching just
    // re-derives the same end state from the raw emails again.
    console.error("booking-buddy: recording an updated Gmail message failed", recordError);
  }

  return { ok: true };
}

/**
 * Dismissing an Import Candidate never touches a Booking (CONTEXT.md's
 * Import Candidate entry) — it only records that this Gmail message is
 * settled, so a later sync's own `processed_gmail_messages` filter skips it.
 * Shape-generic (just a `gmail_message_id`), so it's reused as-is for a
 * cancellation candidate — matched or the "no match found" notice (issue
 * #65) — rather than needing its own near-identical action.
 */
export async function dismissImportCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const allowed = await isEmailSyncAllowedForCaller();
  if (!allowed) {
    return { error: "Your account isn't approved for email sync." };
  }

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  if (!gmailMessageId) {
    return { error: "Couldn't dismiss that. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("processed_gmail_messages").insert({
    owner_id: session.userId,
    gmail_message_id: gmailMessageId,
    outcome: "dismissed",
  });

  // A unique-violation here means this exact message was already recorded
  // (a double-submit, or confirmed/dismissed from another tab) — the
  // caller's own goal, "never show me this again," is already true either
  // way, so this isn't a failure worth reporting.
  if (error && (error as { code?: string }).code !== "23505") {
    return { error: "Couldn't dismiss that. Try again." };
  }

  return { ok: true };
}
