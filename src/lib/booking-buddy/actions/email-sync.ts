"use server";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SETTINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  authorizeEmailSyncForCaller,
  canConnectMailboxForCaller,
  getEmailSyncEntitlementForCaller,
} from "../email-sync-entitlement-for-caller.ts";
import {
  readMicrosoftOAuthClientId,
  requireMailboxLinkEncryptionKey,
} from "../env.ts";
import { mailAdapterFor } from "../mail-adapters/index.ts";
import { resolveMailboxAccessToken } from "../mailbox-token-lifecycle.ts";
import type { MailboxProvider } from "../mailbox-provider.ts";
import { MAILBOX_OAUTH_STATE_COOKIE, encodeMailboxOAuthState } from "../mailbox-oauth.ts";
import { absoluteAppUrl } from "../request-origin.ts";
import {
  BOOKING_EMAIL_SOURCES,
  buildBookingEmailSearchCriteria,
  type BookingEmailSource,
} from "../booking-email.ts";
import { connectionCandidatesFromFriends } from "../email-sync-matching.ts";
import {
  reviewCourtReserveEmails,
  type RawCourtReserveEmail,
  type ReviewItem,
  type UpdateTargetBooking,
} from "../email-sync-review.ts";
import {
  listDismissedReservations,
  pruneExpiredDismissedReservations,
  recordDismissedSlotFromForm,
} from "../dismissed-reservations.ts";
import type { BookingIdentity } from "../import-candidate-shaping.ts";
import type { MergedImportCandidate } from "../merge-import-candidates.ts";
import { parseUpdateApplication } from "../bookings.ts";
import { todayInZone, clockInZone } from "../datetime.ts";
import {
  applyUpdateToOwnedBooking,
  deleteOwnedBooking,
  getBookingsPageData,
} from "./bookings.ts";
import { listConnections } from "./connections.ts";
import { trackEmailSyncEvent } from "../analytics.ts";

export type { ActionResult } from "./result.ts";
export type { ReviewItem };
export type { UpdateTargetBooking };
export type { MergedImportCandidate };

export type { MailboxProvider };

export type MailboxLink = {
  provider: MailboxProvider;
  accountEmail: string;
  status: "active" | "expired";
  connectedAt: string;
} | null;

function mailboxCallbackUrl(): Promise<string> {
  return absoluteAppUrl("/booking-buddy/settings/mailbox-callback");
}

/** The signed-in User's own Mailbox Link, or `null` if no mailbox is connected. */
export async function getMailboxLink(): Promise<MailboxLink> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mailbox_links")
    .select("provider, account_email, status, connected_at")
    .eq("owner_id", session.userId)
    .maybeSingle();

  if (error) {
    readFailed("your mailbox connection", error);
  }

  if (!data) {
    return null;
  }

  return {
    provider: data.provider,
    accountEmail: data.account_email,
    status: data.status,
    connectedAt: data.connected_at,
  };
}

/**
 * Starts a mailbox provider's OAuth redirect (spec #280).
 *
 * - Google: rejects a non-allowlisted User even if they reach this directly —
 *   the Settings page not rendering the button is the optimistic half, this is
 *   the authoritative one (ADR-0009's addendum). The allowlist is Gmail-only.
 * - Microsoft: no allowlist, but the "Connect Outlook" button only renders
 *   when `MICROSOFT_OAUTH_CLIENT_ID` is set, so a direct hit with it unset is
 *   a misconfiguration — reported as the ordinary connect failure rather than
 *   letting `requireMicrosoftOAuthClientId` throw an uncaught 500 further down.
 */
export async function connectMailbox(provider: MailboxProvider): Promise<void> {
  await verifySession();

  if (!(await canConnectMailboxForCaller(provider))) {
    redirect(`${SETTINGS_PATH}?error=email_sync_not_allowed`);
  }
  if (provider === "microsoft" && !readMicrosoftOAuthClientId()) {
    redirect(`${SETTINGS_PATH}?error=mailbox_connect_failed`);
  }

  const state = encodeMailboxOAuthState(provider, randomBytes(16).toString("hex"));

  // Built before setting the cookie: if the OAuth client isn't configured
  // (a plausible partial-deploy state — see PROGRESS.md's own note that
  // these vars aren't set on Vercel yet), this throws, and the redirect
  // below should report a normal "couldn't connect" rather than a raw 500.
  let authorizeUrl: string;
  try {
    authorizeUrl = mailAdapterFor(provider).buildAuthorizeUrl(await mailboxCallbackUrl(), state);
  } catch (error) {
    console.error("booking-buddy: mailbox OAuth client isn't configured", error);
    redirect(`${SETTINGS_PATH}?error=mailbox_connect_failed`);
  }

  (await cookies()).set(MAILBOX_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  redirect(authorizeUrl);
}

export async function disconnectMailbox(): Promise<ActionResult> {
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
    return { error: "Couldn't disconnect that mailbox. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

export type SyncFromEmailResult =
  | {
      status: "ok";
      items: ReviewItem[];
      /** Confirmations dropped against `dismissed_reservations` — the review screen names them and offers each back (issue #444). */
      suppressed: BookingIdentity[];
    }
  | { status: "reconnect_required" }
  | { status: "error"; message: string };

/**
 * Runs a live mailbox search for booking emails (CourtReserve's, plus
 * Backyard Club's own — one search per sender, see `booking-email.ts`) and
 * returns the ones worth a User's review (issues #64/#65). A plain async
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
 * the `processed_messages` "already seen" filter that keeps a fetch from
 * happening for a message a past sync already settled.
 *
 * A `not_a_booking`/`unparseable`/malformed-time parse is dropped by the
 * review module and, since it produces no candidate, is never recorded in
 * `processed_messages` here — so a later sync still sees it fresh, which
 * is fine: there's nothing actionable to remember either way.
 */
export async function syncFromEmail(): Promise<SyncFromEmailResult> {
  const session = await verifySession();

  const supabase = await createClient();

  const { data: link, error: linkError } = await supabase
    .from("mailbox_links")
    .select("provider, encrypted_refresh_token, status")
    .eq("owner_id", session.userId)
    .maybeSingle();

  if (linkError) {
    console.error("booking-buddy: reading the Mailbox Link for sync failed", linkError);
    return { status: "error", message: "Couldn't sync from email. Try again." };
  }

  if (!link || link.status === "expired") {
    return { status: "reconnect_required" };
  }

  // Authoritative re-check (ADR-0009's addendum) — the Bookings page asks the
  // same entitlement; a User removed from the allowlist after connecting
  // Gmail must not keep syncing off a stale page. Gmail-only by design.
  if (!(await getEmailSyncEntitlementForCaller(link)).canSync) {
    return { status: "error", message: "Your account isn't approved for email sync." };
  }

  let encryptionKey: string;
  try {
    encryptionKey = requireMailboxLinkEncryptionKey();
  } catch (error) {
    console.error("booking-buddy: Mailbox Link encryption key isn't configured", error);
    return { status: "error", message: "Couldn't sync from email. Try again." };
  }

  const adapter = mailAdapterFor(link.provider);

  // Decrypt → refresh → persist a rotated refresh token → mark `expired` on
  // `invalid_grant`, all in the shared token-lifecycle helper so the
  // bookkeeping is identical for every provider.
  const token = await resolveMailboxAccessToken({
    supabase,
    ownerId: session.userId,
    adapter,
    encryptedRefreshToken: link.encrypted_refresh_token,
    encryptionKey,
  });
  if (!token.ok) {
    if (token.reason === "reconnect_required") {
      return { status: "reconnect_required" };
    }
    return { status: "error", message: "Couldn't reach your mailbox. Try again." };
  }

  // One search per sender, run together. The source a message came back
  // under is what decides which parser reads it — never sniffed from the body.
  const searchStartedAt = new Date();
  const searchResults = await Promise.all(
    BOOKING_EMAIL_SOURCES.map((source) =>
      adapter.searchMailbox(token.accessToken, buildBookingEmailSearchCriteria(source, searchStartedAt)),
    ),
  );
  const sourceByMessageId = new Map<string, BookingEmailSource>();
  for (const [index, searchResult] of searchResults.entries()) {
    if (!searchResult.ok) {
      return { status: "error", message: "Couldn't reach your mailbox. Try again." };
    }
    for (const messageId of searchResult.messageIds) {
      sourceByMessageId.set(messageId, BOOKING_EMAIL_SOURCES[index]);
    }
  }

  const { data: processedRows, error: processedError } = await supabase
    .from("processed_messages")
    .select("provider_message_id")
    .eq("owner_id", session.userId)
    .eq("provider", link.provider);

  if (processedError) {
    console.error("booking-buddy: reading processed messages failed", processedError);
    return { status: "error", message: "Couldn't sync from email. Try again." };
  }

  const processedIds = new Set((processedRows ?? []).map((row) => row.provider_message_id));
  const unseen = [...sourceByMessageId].filter(([id]) => !processedIds.has(id));

  // Captured once, ahead of every read and the per-message fetch, so every
  // past-date decision in this sync shares one "now" regardless of how long
  // the fetch loop runs.
  const now = new Date();

  const [{ orgs, bookings }, connections, dismissedSlots] = await Promise.all([
    getBookingsPageData(),
    listConnections(),
    // Reservations already dismissed from either source (issue #437) — a
    // feed-side dismissal leaves no Booking behind for the duplicate check to
    // recognise, so this list is what carries it across. Every Org, since an
    // email's facility is only matched to one further down.
    listDismissedReservations(supabase, session.userId),
    // Housekeeping (issue #447), riding along in the same round trip so it
    // costs no wall time. It races the read above on the same table, which is
    // deliberate and harmless: the only rows it removes are for slots already
    // past, and a candidate for one of those is dropped by the review's own
    // past-date check whether the dismissal was still there or not.
    pruneExpiredDismissedReservations(supabase, session.userId, now),
  ]);

  // The mailbox fetch is the only per-message I/O left here — one unreadable
  // message shouldn't sink the whole sync. Everything decidable from the
  // bodies down is `reviewCourtReserveEmails`.
  const rawEmails: RawCourtReserveEmail[] = [];
  for (const [messageId, source] of unseen) {
    const fetched = await adapter.fetchMessage(token.accessToken, messageId);
    if (!fetched.ok) {
      console.error("booking-buddy: fetching a mailbox message failed", messageId);
      continue;
    }
    rawEmails.push({
      gmailMessageId: messageId,
      source,
      ...fetched.email,
    });
  }

  const { items, suppressed } = reviewCourtReserveEmails({
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
      // The rest of the Booking as it stands, for the before-side of a
      // suggested update match (issue #458). Its end clock reads in the same
      // zone as its start, so a Booking that runs past midnight reads
      // "22:00" to "01:00" here — exactly what the review's own overlap
      // scoring and the card's before/after both expect.
      endTime: clockInZone(booking.timeZone, new Date(booking.endsAt)),
      format: booking.format,
      players: booking.players,
    })),
    dismissedSlots,
    connectionCandidates: connectionCandidatesFromFriends(connections.friends),
    now,
  });

  after(() =>
    trackEmailSyncEvent("bb_email_sync_run", link.provider, { candidates: items.length }),
  );

  return { status: "ok", items, suppressed };
}

/**
 * Confirming a matched cancellation candidate removes the Booking it refers
 * to (issue #65) — `bookingId` comes from the review screen's own hidden
 * field, which only ever holds what `syncFromEmail`'s own
 * `matchCancellationToBooking` resolved server-side, not anything the User
 * (or a tampered request) picks.
 *
 * Deleting the Booking would, on its own, cascade away any `confirmed`/
 * `updated` `processed_messages` rows that point at it (issue #286's FK) —
 * right when the User deletes a Booking from the UI (they want that email
 * offered again), wrong here: they're cancelling the reservation, so the
 * original confirmation must stay suppressed too. So those rows' message ids
 * are re-recorded as `cancelled` after the delete.
 */
export async function confirmCancellationCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const gate = await authorizeEmailSyncForCaller();
  if ("error" in gate) return gate;

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  if (!gmailMessageId || !bookingId) {
    return { error: "Couldn't remove that booking. Try again." };
  }

  const supabase = await createClient();

  // Captured before the delete, while the FK still links them. `processed_messages`
  // is INSERT-only (no update/delete grant), so these rows aren't edited —
  // the cascade removes them and the matching id is re-inserted as `cancelled`
  // below, which keeps that confirmation email out of every later sync.
  const { data: supersededRows } = await supabase
    .from("processed_messages")
    .select("provider, provider_message_id")
    .eq("owner_id", session.userId)
    .eq("booking_id", bookingId);

  // The candidate's own `bookingId` was resolved against this same caller's
  // Bookings a moment ago, so `deleteOwnedBooking`'s own empty-result error
  // here only realistically means a race (deleted from another tab since).
  const deleteResult = await deleteOwnedBooking(bookingId);
  if (!deleteResult.ok) {
    return deleteResult;
  }

  const { error: recordError } = await supabase.from("processed_messages").insert([
    {
      owner_id: session.userId,
      provider: gate.provider,
      provider_message_id: gmailMessageId,
      outcome: "cancelled",
    },
    ...(supersededRows ?? []).map((row) => ({
      owner_id: session.userId,
      provider: row.provider,
      provider_message_id: row.provider_message_id,
      outcome: "cancelled" as const,
    })),
  ]);

  if (recordError) {
    // Not fatal — the Booking is already gone either way. Even if this
    // record never lands, the cancellation email simply won't have a
    // matching Booking to resolve to on a later sync, and would instead
    // surface as the "no match found" notice; the superseded confirmation
    // would re-appear once as an import candidate the User can Dismiss.
    console.error("booking-buddy: recording a cancelled Gmail message failed", recordError);
  }

  return { ok: true };
}

/**
 * Applying an update candidate edits the Booking it refers to in place
 * (issue #91, widened by #458) — the whole reservation as the email now
 * describes it, re-validated through `parseUpdateApplication` the same way
 * `settleImportCandidate` re-runs `parseNewBooking` rather than trusting the
 * already-parsed candidate a second time.
 *
 * `booking_id` is either the Booking `matchUpdateToBooking` resolved
 * server-side or one of the suggestions the User picked from — both come from
 * the review screen's own fields, both are re-scoped to this caller by RLS on
 * the write, and the card showed the before/after either way. Everything else
 * travels as a plain form field for the same reason it does on an import
 * card: the review screen already showed the User exactly what they're about
 * to apply.
 *
 * The `processed_messages` row records `booking_id` (issue #286), same as a
 * confirmed import: deleting that Booking later cascades the row away so a
 * future sync re-offers the update email.
 */
export async function confirmUpdateCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const gate = await authorizeEmailSyncForCaller();
  if ("error" in gate) return gate;

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  if (!gmailMessageId) {
    return { error: "Couldn't update that booking. Try again." };
  }

  const parsed = parseUpdateApplication(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const updateResult = await applyUpdateToOwnedBooking(session.userId, parsed);
  if (!updateResult.ok) {
    return updateResult;
  }

  const bookingId = parsed.bookingId;

  const supabase = await createClient();
  const { error: recordError } = await supabase.from("processed_messages").insert({
    owner_id: session.userId,
    provider: gate.provider,
    provider_message_id: gmailMessageId,
    outcome: "updated",
    // Ties this ledger row to the Booking the update was applied to (issue
    // #286) — the FK cascades, so deleting that Booking re-opens the email to
    // a later sync. `bookingId` was validated non-empty above.
    booking_id: bookingId,
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
 * later sync's own `processed_messages` filter skips it. Already
 * kind-generic (it reads only `gmail_message_id`), so one action covers an
 * import, a cancellation, and an update alike — matched or the "no match
 * found" notice.
 *
 * An `import` card also posts the reservation's slot, recorded in
 * `dismissed_reservations` (issue #437) so the calendar feed honours the
 * dismissal too — that `processed_messages` row is keyed on an opaque provider
 * message id the feed review knows nothing about, and a dismissal leaves no
 * Booking behind for it to recognise either. A `cancellation`/`update` card
 * posts no slot and records none: dismissing one means "leave this Booking
 * alone", not "I don't want this reservation". Neither does an import whose
 * facility matched no Org — there is no Org to key the slot on.
 */
export async function dismissReviewItem(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const gate = await authorizeEmailSyncForCaller();
  if ("error" in gate) return gate;

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  if (!gmailMessageId) {
    return { error: "Couldn't dismiss that. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("processed_messages").insert({
    owner_id: session.userId,
    provider: gate.provider,
    provider_message_id: gmailMessageId,
    outcome: "dismissed",
  });

  // A unique-violation here means this exact message was already recorded
  // (a double-submit, or confirmed/dismissed from another tab) — the
  // caller's own goal, "never show me this again," is already true either
  // way, so this isn't a failure worth reporting.
  if (error && (error as { code?: string }).code !== "23505") {
    return { error: "Couldn't dismiss that. Try again." };
  }

  await recordDismissedSlotFromForm(supabase, session.userId, formData);

  return { ok: true };
}
