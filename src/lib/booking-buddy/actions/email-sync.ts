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
import { buildCourtReserveSearchQuery } from "../courtreserve-email.ts";
import { connectionCandidatesFromFriends } from "../email-sync-matching.ts";
import {
  reviewCourtReserveEmails,
  type RawCourtReserveEmail,
  type ReviewItem,
} from "../email-sync-review.ts";
import { parseNewBooking } from "../bookings.ts";
import { todayInZone, clockInZone } from "../datetime.ts";
import { isBookingFormat } from "../capacity.ts";
import {
  deleteOwnedBooking,
  getBookingsPageData,
  insertValidatedBooking,
  updateOwnedBookingFormatAndCourt,
} from "./bookings.ts";
import { listConnections } from "./connections.ts";

export type { ActionResult } from "./result.ts";
export type { ReviewItem };

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
  const [profile, session] = await Promise.all([getOwnProfile(), verifySession()]);
  return isEmailSyncAllowed(profile.username, session.email, readEmailSyncAllowlist());
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

export type SyncFromEmailResult =
  | { status: "ok"; items: ReviewItem[] }
  | { status: "reconnect_required" }
  | { status: "error"; message: string };

/**
 * Runs a live Gmail search for CourtReserve confirmations and cancellations
 * and returns the ones worth a User's review (issues #64/#65). A plain async
 * function rather than a `useActionState`-bound one: the caller (a
 * click-triggered `useQuery`) wants a promise it can call by name, not a form
 * to submit.
 *
 * Everything decidable from the message bodies down — parse, batch netting,
 * facility/Booking/player matching, the past-date and duplicate drops, the
 * court-label overflow split, ordering — is `reviewCourtReserveEmails`
 * (`email-sync-review.ts`), unit tested against fixture HTML. This function is
 * only the I/O around it: token refresh, the Gmail search + fetch, the
 * Supabase reads that resolve the caller's own Orgs/Bookings/Connections, and
 * the `processed_gmail_messages` "already seen" filter that keeps a fetch from
 * happening for a message a past sync already settled.
 *
 * A `not_a_booking`/`unparseable`/malformed-time parse is dropped by the
 * review module and, since it produces no candidate, is never recorded in
 * `processed_gmail_messages` here — so a later sync still sees it fresh, which
 * is fine: there's nothing actionable to remember either way.
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

  // Captured once, ahead of the per-message fetch, so every past-date check
  // in this sync shares one "now" regardless of how long the fetch loop runs.
  const now = new Date();

  // The Gmail fetch is the only per-message I/O left here — one unreadable
  // message shouldn't sink the whole sync. Everything decidable from the
  // bodies down is `reviewCourtReserveEmails`.
  const rawEmails: RawCourtReserveEmail[] = [];
  for (const messageId of unseenIds) {
    const fetched = await fetchGmailMessage(refreshed.accessToken, messageId);
    if (!fetched.ok) {
      console.error("booking-buddy: fetching a Gmail message failed", messageId);
      continue;
    }
    rawEmails.push({ gmailMessageId: messageId, ...fetched.email });
  }

  const { items } = reviewCourtReserveEmails({
    emails: rawEmails,
    orgs: orgs.map((org) => ({
      orgId: org.id,
      displayName: org.displayName,
      timeZone: org.timeZone,
    })),
    // Each existing Booking's own wall-clock date/start time, read back in its
    // own Org's zone — the shape the review module's own duplicate/past-date
    // checks compare a candidate against. `todayInZone`/`clockInZone` work for
    // any instant, not just "now", despite the name. `id` rides along for
    // `matchCancellationToBooking`/`matchUpdateToBooking` — it's what
    // `confirmCancellationCandidate`/`confirmUpdateCandidate` actually act on.
    existingBookings: bookings.map((booking) => ({
      id: booking.id,
      orgId: booking.orgId,
      courtLabel: booking.courtLabel,
      date: todayInZone(booking.timeZone, new Date(booking.startsAt)),
      startTime: clockInZone(booking.timeZone, new Date(booking.startsAt)),
    })),
    connectionCandidates: connectionCandidatesFromFriends(connections.friends),
    now,
  });

  return { status: "ok", items };
}

/**
 * Confirming an Import Candidate creates a real Booking (issue #64) — the
 * form posts the exact same field names `CreateBookingForm` does (`org_id`,
 * `name`, `format`, `date`, `start_time`, `end_time`, `court_label`,
 * `players`), plus `gmail_message_id`, so it reuses `parseNewBooking`'s
 * validation as-is rather than trusting the candidate's already-parsed
 * fields a second time. `players` rides through as the same raw,
 * comma-joined names `matchedPlayers` was built from — `insertValidatedBooking`
 * re-runs the match against the caller's *current* Connections at this,
 * the actual add-time (ADR 0011), rather than trusting the stale match
 * computed back when the review screen was rendered (issue #100).
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
  const notesRaw = String(formData.get("notes") ?? "");
  if (!gmailMessageId || !bookingId || !isBookingFormat(format)) {
    return { error: "Couldn't update that booking. Try again." };
  }

  const updateResult = await updateOwnedBookingFormatAndCourt(bookingId, {
    format,
    courtLabel: courtLabelRaw || null,
    // Only carried through when the review screen actually had a court
    // label overflow to report (see `splitOverlongCourtLabel`) — omitted
    // otherwise, so an ordinary update can't clobber notes the User already
    // wrote on this Booking for something unrelated.
    notes: notesRaw || undefined,
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
 * Dismissing a review item never touches a Booking (CONTEXT.md's Import
 * Candidate entry) — it only records that this Gmail message is settled, so a
 * later sync's own `processed_gmail_messages` filter skips it. Already
 * kind-generic (it reads only `gmail_message_id`), so one action covers an
 * import, a cancellation, and an update alike — matched or the "no match
 * found" notice.
 */
export async function dismissReviewItem(
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
