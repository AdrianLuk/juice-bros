"use server";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKING_BUDDY_ROOT, BOOKINGS_PATH, SETTINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { getOwnProfile } from "./profile.ts";
import { isGmailConnectAllowed } from "../email-sync-allowlist.ts";
import {
  readEmailSyncAllowlist,
  readMicrosoftOAuthClientId,
  requireMailboxLinkEncryptionKey,
} from "../env.ts";
import { mailAdapterFor } from "../mail-adapters/index.ts";
import { resolveMailboxAccessToken } from "../mailbox-token-lifecycle.ts";
import type { MailboxProvider } from "../mailbox-provider.ts";
import { MAILBOX_OAUTH_STATE_COOKIE, encodeMailboxOAuthState } from "../mailbox-oauth.ts";
import { absoluteAppUrl } from "../request-origin.ts";
import { buildCourtReserveSearchCriteria } from "../courtreserve-email.ts";
import { connectionCandidatesFromFriends } from "../email-sync-matching.ts";
import {
  reviewCourtReserveEmails,
  type RawCourtReserveEmail,
  type ReviewItem,
} from "../email-sync-review.ts";
import { upsertFeedEventRow } from "../feed-events.ts";
import type { MergedImportCandidate } from "../merge-import-candidates.ts";
import { parseNewBooking } from "../bookings.ts";
import { todayInZone, clockInZone } from "../datetime.ts";
import { isBookingFormat } from "../capacity.ts";
import { isKnownTimeZone } from "../timezone.ts";
import {
  deleteOwnedBooking,
  getBookingsPageData,
  insertValidatedBooking,
  updateOwnedBookingFormatAndCourt,
} from "./bookings.ts";
import { listConnections } from "./connections.ts";
import { trackEmailSyncEvent, trackFacilitySyncEvent } from "../analytics.ts";

export type { ActionResult } from "./result.ts";
export type { ReviewItem };
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

/**
 * Whether the signed-in User is allowed to see/use email sync at all
 * (ADR-0009's addendum) — the optimistic half. `connectMailbox` below re-checks
 * this authoritatively.
 *
 * Fetches the profile itself rather than taking a `username` param: the one
 * caller that already has a profile in hand (the Settings page) calls
 * `isGmailConnectAllowed` directly instead of going through here, so this
 * stays the "I don't already have one" convenience path, not a second query
 * on top of one a caller already ran.
 */
export async function isGmailConnectAllowedForCaller(): Promise<boolean> {
  const [profile, session] = await Promise.all([getOwnProfile(), verifySession()]);
  return isGmailConnectAllowed(profile.username, session.email, readEmailSyncAllowlist());
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
 * The one provider-authorization rule, shared by `syncFromEmail` and the
 * candidate actions so it can't drift between "run a sync" and "act on its
 * results" (spec #280): a Gmail link still needs the caller on the allowlist
 * (ADR-0009's addendum — a User removed from it after connecting must not
 * keep syncing); a Microsoft link needs nothing more, its consumer identity
 * platform has no equivalent of Google's capped Testing mode.
 */
async function providerSyncAllowed(provider: MailboxProvider): Promise<boolean> {
  return provider === "google" ? isGmailConnectAllowedForCaller() : true;
}

/**
 * Whether the signed-in User may act on a review candidate, and under which
 * provider to record the `processed_messages` row.
 *
 * Reads the Mailbox Link's provider when there is one. When there isn't — the
 * User disconnected their mailbox while a review screen was still open — a
 * Gmail-allowlisted caller is still allowed (confirming just re-validates a
 * Booking form; dismissing just records an outcome), recorded under `google`,
 * exactly the pre-#284 behaviour. A non-allowlisted caller with no link has
 * nothing to act on.
 */
async function authorizeEmailSyncForCaller(
  userId: string,
): Promise<{ ok: true; provider: MailboxProvider } | { ok: false }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailbox_links")
    .select("provider")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false };
  }

  const provider: MailboxProvider = data?.provider ?? "google";
  if (!(await providerSyncAllowed(provider))) {
    return { ok: false };
  }

  return { ok: true, provider };
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

  if (provider === "google") {
    const allowed = await isGmailConnectAllowedForCaller();
    if (!allowed) {
      redirect(`${SETTINGS_PATH}?error=email_sync_not_allowed`);
    }
  } else if (!readMicrosoftOAuthClientId()) {
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

  // Authoritative re-check (ADR-0009's addendum) — the Bookings page not
  // rendering this section for a disallowed User is the optimistic half; a
  // User removed from the allowlist after connecting Gmail must not keep
  // syncing off a stale page. `providerSyncAllowed` is Gmail-only by design.
  if (!(await providerSyncAllowed(link.provider))) {
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

  const searchResult = await adapter.searchMailbox(
    token.accessToken,
    buildCourtReserveSearchCriteria(new Date()),
  );
  if (!searchResult.ok) {
    return { status: "error", message: "Couldn't reach your mailbox. Try again." };
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
  const unseenIds = searchResult.messageIds.filter((id) => !processedIds.has(id));

  const [{ orgs, bookings }, connections] = await Promise.all([
    getBookingsPageData(),
    listConnections(),
  ]);

  // Captured once, ahead of the per-message fetch, so every past-date check
  // in this sync shares one "now" regardless of how long the fetch loop runs.
  const now = new Date();

  // The mailbox fetch is the only per-message I/O left here — one unreadable
  // message shouldn't sink the whole sync. Everything decidable from the
  // bodies down is `reviewCourtReserveEmails`.
  const rawEmails: RawCourtReserveEmail[] = [];
  for (const messageId of unseenIds) {
    const fetched = await adapter.fetchMessage(token.accessToken, messageId);
    if (!fetched.ok) {
      console.error("booking-buddy: fetching a mailbox message failed", messageId);
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

  after(() =>
    trackEmailSyncEvent("bb_email_sync_run", link.provider, { candidates: items.length }),
  );

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
 *
 * The `processed_messages` row records `booking_id` (issue #286) so that
 * deleting this Booking later cascades the row away and a future sync
 * re-offers the email — the realistic "deleted a confirmed booking, want it
 * back" path is recovery.
 *
 * Confirm-time duplicate guard (issue #294 / ADR-0019): the duplicate-Booking
 * check the review list already applies when it's shaped also runs here,
 * against the caller's Bookings as they are at confirm time. Without it,
 * confirming a feed candidate first and then this email candidate for the same
 * slot in one session would create a second Booking — the email review ran
 * before the feed confirm existed. On a hit the message is recorded settled
 * and no Booking is created.
 */
export async function confirmImportCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const gate = await authorizeEmailSyncForCaller(session.userId);
  if (!gate.ok) {
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

  const supabase = await createClient();

  const { data: guardOrg } = await supabase
    .from("orgs")
    .select("time_zone")
    .eq("id", parsed.orgId)
    .eq("owner_id", session.userId)
    .maybeSingle();
  const guardZone =
    guardOrg?.time_zone && isKnownTimeZone(guardOrg.time_zone) ? guardOrg.time_zone : "UTC";

  const { data: guardBookings } = await supabase
    .from("bookings")
    .select("id, org_id, court_label, starts_at")
    .eq("owner_id", session.userId)
    .eq("org_id", parsed.orgId);

  const alreadyBookedRow = (guardBookings ?? [])
    .map((row) => ({
      id: row.id,
      identity: {
        orgId: row.org_id,
        courtLabel: row.court_label,
        date: todayInZone(guardZone, new Date(row.starts_at)),
        startTime: clockInZone(guardZone, new Date(row.starts_at)),
      },
    }))
    .find(
      ({ identity }) =>
        identity.orgId === parsed.orgId &&
        identity.courtLabel === parsed.courtLabel &&
        identity.date === parsed.date &&
        identity.startTime === parsed.startTime,
    );

  if (alreadyBookedRow) {
    // Record the message as settled, tied to the Booking that already covers
    // this slot (issue #286) — so deleting *that* Booking later still cascades
    // the ledger row away and a future sync re-offers the email, exactly as if
    // this confirm had created it. A null `booking_id` here would suppress the
    // email permanently, reintroducing the bug #286's FK fixed.
    const { error } = await supabase.from("processed_messages").insert({
      owner_id: session.userId,
      provider: gate.provider,
      provider_message_id: gmailMessageId,
      outcome: "confirmed",
      booking_id: alreadyBookedRow.id,
    });
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("booking-buddy: recording a duplicate-skipped Gmail message failed", error);
    }
    return { ok: true };
  }

  const result = await insertValidatedBooking(session.userId, parsed);
  if (!result.ok) {
    return result;
  }

  const { error } = await supabase.from("processed_messages").insert({
    owner_id: session.userId,
    provider: gate.provider,
    provider_message_id: gmailMessageId,
    outcome: "confirmed",
    // Ties this ledger row to the Booking just created (issue #286): the FK
    // cascades, so deleting that Booking in the UI removes this row and a
    // later sync re-offers the email. `result.ok` guarantees `bookingId` here.
    booking_id: result.bookingId ?? null,
  });

  if (error) {
    // Not fatal — the Booking is real either way. Even if this record never
    // lands, a later sync's own `isDuplicateBooking` filter catches a
    // re-parse of the same email against the Booking just created.
    console.error("booking-buddy: recording a confirmed Gmail message failed", error);
  }

  after(() => trackEmailSyncEvent("bb_email_sync_import", gate.provider));

  return { ok: true };
}

/**
 * Reads the four `org_feed_events` fields the merged review card carries as
 * hidden inputs, defensively (a tampered or stale post shouldn't 500). `uid`
 * missing is fatal — there's no feed row to settle without it; a bad
 * `sequence` / `starts_at` degrades to a safe default, same as
 * `confirmFeedCandidate`.
 */
function readMergedFeedFields(formData: FormData):
  | { ok: true; uid: string; sequence: number; startsAt: string }
  | { ok: false } {
  const uid = String(formData.get("feed_event_uid") ?? "").trim();
  if (!uid) {
    return { ok: false };
  }

  const sequenceRaw = Number(formData.get("sequence"));
  const sequence = Number.isInteger(sequenceRaw) && sequenceRaw >= 0 ? sequenceRaw : 0;

  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const startsAt =
    startsAtRaw && !Number.isNaN(Date.parse(startsAtRaw))
      ? new Date(startsAtRaw).toISOString()
      : new Date(0).toISOString();

  return { ok: true, uid, sequence, startsAt };
}

/**
 * Confirming a *merged* Import Candidate (issue #348) — one reservation that
 * came in from both the mailbox and a calendar feed, shown as a single
 * consolidated card. Creates one Booking (the email path — it carries the
 * Player(s)) and settles **both** sources: a `processed_messages` row *and* an
 * `imported` `org_feed_events` row, both tied to that Booking.
 *
 * The union of `confirmImportCandidate` and `confirmFeedCandidate`: the form
 * posts the same booking field names `CreateBookingForm` does (so
 * `parseNewBooking` re-validates as-is) plus `gmail_message_id`,
 * `feed_event_uid`, `sequence` and `starts_at`. The confirm-time duplicate
 * guard runs exactly as it does for the other two — if a Booking already
 * covers the slot (e.g. the User confirmed the email or feed card for it in
 * another tab), no second Booking is made and both source rows are pointed at
 * the one that exists.
 */
export async function confirmMergedCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const gate = await authorizeEmailSyncForCaller(session.userId);
  if (!gate.ok) {
    return { error: "Your account isn't approved for email sync." };
  }

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  const feed = readMergedFeedFields(formData);
  if (!gmailMessageId || !feed.ok) {
    return { error: "Couldn't confirm that booking. Try again." };
  }

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();

  const { data: guardOrg } = await supabase
    .from("orgs")
    .select("time_zone")
    .eq("id", parsed.orgId)
    .eq("owner_id", session.userId)
    .maybeSingle();
  const guardZone =
    guardOrg?.time_zone && isKnownTimeZone(guardOrg.time_zone) ? guardOrg.time_zone : "UTC";

  const { data: guardBookings } = await supabase
    .from("bookings")
    .select("id, org_id, court_label, starts_at")
    .eq("owner_id", session.userId)
    .eq("org_id", parsed.orgId);

  const alreadyBookedRow = (guardBookings ?? [])
    .map((row) => ({
      id: row.id,
      identity: {
        orgId: row.org_id,
        courtLabel: row.court_label,
        date: todayInZone(guardZone, new Date(row.starts_at)),
        startTime: clockInZone(guardZone, new Date(row.starts_at)),
      },
    }))
    .find(
      ({ identity }) =>
        identity.orgId === parsed.orgId &&
        identity.courtLabel === parsed.courtLabel &&
        identity.date === parsed.date &&
        identity.startTime === parsed.startTime,
    );

  const bookingId = alreadyBookedRow?.id ?? null;

  if (!bookingId) {
    const result = await insertValidatedBooking(session.userId, parsed);
    if (!result.ok) {
      return result;
    }
    await settleMergedSources(supabase, session.userId, {
      provider: gate.provider,
      gmailMessageId,
      feed,
      orgId: parsed.orgId,
      bookingId: result.bookingId ?? null,
      outcome: "confirmed",
    });
    after(() => trackFacilitySyncEvent("bb_sync_merged_import"));
    return { ok: true };
  }

  // A Booking already covers this slot — link both sources to it, make nothing new.
  await settleMergedSources(supabase, session.userId, {
    provider: gate.provider,
    gmailMessageId,
    feed,
    orgId: parsed.orgId,
    bookingId,
    outcome: "confirmed",
  });
  return { ok: true };
}

/**
 * Dismissing a merged Import Candidate (issue #348) settles **both** sources
 * without touching a Booking: a `dismissed` `processed_messages` row (so a
 * later email sync skips the message) and a `dismissed` `org_feed_events` row
 * (so a later feed sync skips the still-present event). Mirrors
 * `dismissReviewItem` + `dismissFeedCandidate` run together.
 */
export async function dismissMergedCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const gate = await authorizeEmailSyncForCaller(session.userId);
  if (!gate.ok) {
    return { error: "Your account isn't approved for email sync." };
  }

  const gmailMessageId = String(formData.get("gmail_message_id") ?? "").trim();
  const orgId = String(formData.get("org_id") ?? "").trim();
  const feed = readMergedFeedFields(formData);
  if (!gmailMessageId || !orgId || !feed.ok) {
    return { error: "Couldn't dismiss that. Try again." };
  }

  const supabase = await createClient();
  const outcome = await settleMergedSources(supabase, session.userId, {
    provider: gate.provider,
    gmailMessageId,
    feed,
    orgId,
    bookingId: null,
    outcome: "dismissed",
  });

  return outcome.hardError ? { error: "Couldn't dismiss that. Try again." } : { ok: true };
}

/**
 * Write the email-side `processed_messages` row and the feed-side
 * `org_feed_events` row for one merged card. A `processed_messages` unique
 * violation (double-submit / already settled from another tab) is not an error
 * — the goal, "this is handled," is already true. Any other write failure on
 * the confirm path is non-fatal (the Booking is real; a later sync's own
 * dedupe recovers), same posture as `confirmImportCandidate`; on the dismiss
 * path a real feed-row failure is surfaced so the User can retry.
 */
async function settleMergedSources(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  input: {
    provider: MailboxProvider;
    gmailMessageId: string;
    feed: { uid: string; sequence: number; startsAt: string };
    orgId: string;
    bookingId: string | null;
    outcome: "confirmed" | "dismissed";
  },
): Promise<{ hardError: boolean }> {
  const { error: messageError } = await supabase.from("processed_messages").insert({
    owner_id: ownerId,
    provider: input.provider,
    provider_message_id: input.gmailMessageId,
    outcome: input.outcome,
    booking_id: input.bookingId,
  });
  if (messageError && (messageError as { code?: string }).code !== "23505") {
    console.error("booking-buddy: recording a merged-candidate Gmail message failed", messageError);
  }

  const { error: feedError } = await upsertFeedEventRow(supabase, ownerId, {
    orgId: input.orgId,
    uid: input.feed.uid,
    sequence: input.feed.sequence,
    startsAt: input.feed.startsAt,
    status: input.outcome === "confirmed" ? "imported" : "dismissed",
    bookingId: input.bookingId,
  });
  if (feedError) {
    console.error("booking-buddy: recording a merged-candidate feed event failed", feedError);
  }

  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);

  return { hardError: Boolean(feedError) };
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

  const gate = await authorizeEmailSyncForCaller(session.userId);
  if (!gate.ok) {
    return { error: "Your account isn't approved for email sync." };
  }

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
 * Applying a matched update candidate edits the Booking it refers to in
 * place (issue #91) — `booking_id`, `format`, and `court_label` all come
 * from the review screen's own hidden fields, which only ever hold what
 * `syncFromEmail`'s own `matchUpdateToBooking` resolved server-side, not
 * anything the User (or a tampered request) picks. `format`/`court_label`
 * still travel as plain form fields rather than being re-derived from
 * `bookingId` here, same reasoning `confirmCancellationCandidate` doesn't
 * re-parse `formData` through `parseNewBooking` either — the review screen
 * already showed the User exactly what they're about to apply.
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

  const gate = await authorizeEmailSyncForCaller(session.userId);
  if (!gate.ok) {
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
 */
export async function dismissReviewItem(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const gate = await authorizeEmailSyncForCaller(session.userId);
  if (!gate.ok) {
    return { error: "Your account isn't approved for email sync." };
  }

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

  return { ok: true };
}
