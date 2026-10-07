/**
 * Every write that creates, edits or removes a Booking: the Org re-check, the
 * wall-clock instants, the Player match against the caller's Connections (ADR
 * 0011) and the error translation (issue #608).
 *
 * Moved out of `actions/bookings.ts` so that settling an Import Candidate
 * (`import-candidate-settlement.ts`) and the Bookings page's own forms run the
 * same code, and so both can be tested against a real database. Takes the
 * caller's `SupabaseClient` and imports nothing from Next.js: the Server
 * Actions in front of it own the session, analytics and `revalidatePath`.
 * Relative imports only, so `node --test` can load it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { readFailed } from "./actions/result.ts";
import {
  bookingWriteMessage,
  type BookingUpdateApplication,
  type NewBooking,
} from "./bookings.ts";
import { groupConnections, type ConnectionRow } from "./connections.ts";
import { crossesMidnight, isPastDate, nextCalendarDate } from "./datetime.ts";
import {
  connectionCandidatesFromFriends,
  diffBookingPlayers,
  matchPlayerNamesToConnections,
} from "./email-sync-matching.ts";

/**
 * A write that reached `bookings`. `playersError` is set when the Booking
 * itself committed but its Players didn't: the caller still revalidates and
 * still counts the Booking, rather than leaving the User to resubmit and log
 * a duplicate on top of the one that already saved.
 */
export type BookingWrite = { bookingId: string; playersError: string | null } | { error: string };

/**
 * The org-ownership re-check and past-date check every write that names an
 * Org shares — a create, an edit, and an update applying to a Booking already
 * on file all need the same answer to "is this actually one of the caller's
 * own Orgs, and is the date still good", before the write.
 *
 * The zone comes from the Org, not the caller (issue #20) — every Booking
 * under one Org is on the same clock, so there's nothing left to pick. This
 * means a fresh read of the Org right before the write, rather than trusting
 * whatever `orgs` list the caller already had: the read doubles as the
 * ownership check (a stale or tampered `org_id` fails here with a clear
 * message, ahead of the `bookings_coherent` trigger, which is still the
 * authority — the rule needs a subquery and RLS does not cover it, since the
 * write is on `bookings`, a table the User may write, and nothing in that
 * policy looks at whose Org they named).
 */
async function resolveValidatedOrg(
  supabase: SupabaseClient,
  ownerId: string,
  // Only the Org and the date are read, so an update applying to a Booking
  // that already has an Org (`applyBookingUpdate`) passes the same check as a
  // whole `NewBooking` does.
  parsed: { orgId: string; date: string },
  now: Date,
): Promise<{ timeZone: string } | { error: string }> {
  const { data: org, error: orgError } = await supabase
    .from("orgs")
    .select("time_zone")
    .eq("id", parsed.orgId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (orgError || !org) {
    return { error: "Pick one of your own places." };
  }

  // Calendar-day-only, not exact-instant — same reasoning as
  // `parseNewSlotProposal`'s own check, just run here instead of inside
  // `parseNewBooking`: the Org's zone (and therefore the only way to ask this
  // question correctly) isn't known until this read completes. A same-day
  // booking whose start time already passed reaches `bookings_not_in_the_past`
  // instead, translated by `bookingWriteMessage`.
  if (isPastDate(parsed.date, org.time_zone, now)) {
    return { error: "That date has already passed. Pick a date in the future." };
  }

  return { timeZone: org.time_zone };
}

/**
 * The `starts_at`/`ends_at` pair a `NewBooking` writes — wall-clock strings
 * carrying the Org's own zone, left for Postgres to convert to instants
 * (DST-aware, much harder to get wrong than doing it here). When the End clock
 * reads at or before the Start, the session ran past midnight (a 9pm–midnight
 * or 10pm–1am game) and its End instant sits on the next calendar day; the
 * `ends_at > starts_at` check is what that day-bump is there to satisfy.
 */
function bookingInstants(
  parsed: { date: string; startTime: string; endTime: string },
  timeZone: string,
): { starts_at: string; ends_at: string } {
  const endDate = crossesMidnight(parsed.startTime, parsed.endTime)
    ? nextCalendarDate(parsed.date)
    : parsed.date;
  return {
    starts_at: `${parsed.date} ${parsed.startTime}:00 ${timeZone}`,
    ends_at: `${endDate} ${parsed.endTime}:00 ${timeZone}`,
  };
}

/**
 * The caller's accepted Connections with a display name to match on — the
 * `friends` half of `listConnections`, read through the client this module
 * was handed. Throws on a failed read, as `listConnections` does: matching
 * against an empty list would silently store every Player unlinked.
 */
async function readConnectionCandidates(supabase: SupabaseClient, ownerId: string) {
  const { data: rows, error } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, status, created_at");

  if (error) {
    readFailed("your connections", error);
  }

  const friendIds = groupConnections((rows ?? []) as ConnectionRow[], ownerId).friends.map(
    (entry) => entry.otherUserId,
  );
  if (friendIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", friendIds);

  if (profilesError) {
    readFailed("who those connections are with", profilesError);
  }

  return connectionCandidatesFromFriends(
    (profiles ?? []).map((profile) => ({ userId: profile.id, displayName: profile.display_name })),
  );
}

/**
 * Matches `names` against the caller's own current Connections — the one
 * write-time resolution both `insertBookingPlayers` (a Booking's first
 * Players) and `replaceBookingPlayers` (an edit's newly-added or
 * newly-edited ones) run, so the two don't drift apart. Resolved once and
 * stored by whichever caller inserts the result; nothing downstream
 * recomputes it (ADR 0011).
 */
async function matchNewPlayers(supabase: SupabaseClient, ownerId: string, names: readonly string[]) {
  return matchPlayerNamesToConnections(names, await readConnectionCandidates(supabase, ownerId));
}

/**
 * Matches `players` against the caller's own Connections and writes them as
 * `booking_players` rows under `bookingId`. A no-op for zero Players, e.g. an
 * Import Candidate whose parsed email carried no names (issue #100).
 */
async function insertBookingPlayers(
  supabase: SupabaseClient,
  ownerId: string,
  bookingId: string,
  players: readonly string[],
): Promise<string | null> {
  if (players.length === 0) {
    return null;
  }

  const matches = await matchNewPlayers(supabase, ownerId, players);

  const { error } = await supabase.from("booking_players").insert(
    matches.map((match) => ({
      booking_id: bookingId,
      name: match.name,
      connection_user_id: match.userId,
    })),
  );

  // Not expected in practice — parseNewBooking already refuses a blank or
  // over-long name before this is reached — so there's nothing more specific
  // to translate the way bookingWriteMessage does for `bookings` itself.
  return error ? "Couldn't save the players on that booking." : null;
}

/**
 * Replaces `bookingId`'s `booking_players` rows to match `players` on every
 * edit save (issue #101) — as a row-level delta, not a wholesale
 * delete-then-reinsert: `diffBookingPlayers` (ordered by `created_at` so a
 * collapsed duplicate name deterministically keeps its earliest-added row's
 * link) says which existing rows an unchanged submitted name pairs with —
 * those are never written at all, so a failure elsewhere in this function
 * can't lose an already-resolved Connection link ADR 0011 says must survive
 * untouched — which existing rows have no submitted name left to claim them
 * (dropped, or an extra duplicate) and get deleted, and which submitted
 * names have no existing row to pair with (added, or a name edited) and need
 * a fresh match before being inserted. Nothing at all is written when the
 * Players list didn't actually change. The two writes aren't transactional,
 * so the insert runs before the delete — a partial failure then leaves a
 * stray extra row rather than losing one.
 */
async function replaceBookingPlayers(
  supabase: SupabaseClient,
  ownerId: string,
  bookingId: string,
  players: readonly string[],
): Promise<string | null> {
  const { data: existing, error: readError } = await supabase
    .from("booking_players")
    .select("id, name, connection_user_id")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (readError) {
    return "Couldn't update the players on that booking.";
  }

  const { toMatch, removeIds } = diffBookingPlayers(
    players,
    (existing ?? []).map((row) => ({ id: row.id, name: row.name, userId: row.connection_user_id })),
  );

  // Insert before delete: these two writes aren't transactional, so if one of
  // them fails partway, an extra row a User can see and remove by hand is a
  // far cheaper mistake than a deleted Player — and their already-resolved
  // Connection link — vanishing with no way to get it back.
  if (toMatch.length > 0) {
    const matches = await matchNewPlayers(supabase, ownerId, toMatch);
    const { error: insertError } = await supabase.from("booking_players").insert(
      matches.map((match) => ({
        booking_id: bookingId,
        name: match.name,
        connection_user_id: match.userId,
      })),
    );
    if (insertError) {
      return "Couldn't update the players on that booking.";
    }
  }

  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase.from("booking_players").delete().in("id", removeIds);
    if (deleteError) {
      return "Couldn't update the players on that booking.";
    }
  }

  return null;
}

/**
 * Create a Booking from an already-validated `NewBooking` — what the Bookings
 * form logs and what confirming an Import Candidate creates (issue #64).
 *
 * Returns the new Booking's `id` (issue #286) so settling an Import Candidate
 * can hang its ledger rows off it — a `processed_messages` row then cascades
 * away if the User later deletes the Booking, letting a future sync re-offer
 * the email.
 */
export async function insertBooking(
  supabase: SupabaseClient,
  ownerId: string,
  parsed: NewBooking,
  now: Date = new Date(),
): Promise<BookingWrite> {
  const org = await resolveValidatedOrg(supabase, ownerId, parsed, now);
  if ("error" in org) {
    return org;
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      org_id: parsed.orgId,
      owner_id: ownerId,
      court_label: parsed.courtLabel,
      name: parsed.name,
      notes: parsed.notes,
      format: parsed.format,
      ...bookingInstants(parsed, org.timeZone),
    })
    .select("id")
    .single();

  if (error || !booking) {
    return { error: bookingWriteMessage(error ?? {}) };
  }

  const playersError = await insertBookingPlayers(supabase, ownerId, booking.id, parsed.players);
  return { bookingId: booking.id, playersError };
}

/**
 * Edit a whole Booking from an already-validated `NewBooking` (issues #97,
 * #101) — `insertBooking`'s shape on the update side, with the same Org
 * re-check. No new migration needed: `bookings_coherent` already fires
 * `before insert or update` (org-ownership + zone-validity), and RLS already
 * turns "isn't yours" into an empty result rather than an error, so
 * `bookingId` isn't re-scoped by `owner_id` in the query itself.
 */
export async function editBooking(
  supabase: SupabaseClient,
  ownerId: string,
  bookingId: string,
  parsed: NewBooking,
  now: Date = new Date(),
): Promise<BookingWrite> {
  const org = await resolveValidatedOrg(supabase, ownerId, parsed, now);
  if ("error" in org) {
    return org;
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({
      org_id: parsed.orgId,
      court_label: parsed.courtLabel,
      name: parsed.name,
      notes: parsed.notes,
      format: parsed.format,
      ...bookingInstants(parsed, org.timeZone),
    })
    .eq("id", bookingId)
    .select("id");

  if (error) {
    return { error: bookingWriteMessage(error) };
  }
  if (!data?.length) {
    return { error: "Couldn't update that booking. Try again." };
  }

  const playersError = await replaceBookingPlayers(supabase, ownerId, bookingId, parsed.players);
  return { bookingId, playersError };
}

/**
 * Delete one Booking by id — the Bookings page's own Remove and a confirmed
 * cancellation candidate (issue #65) both already know the exact id.
 */
export async function removeBooking(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<{ ok: true } | { error: string }> {
  // Selected back for the same reason as everywhere else: RLS turns "that isn't
  // yours" into an empty result, not an error.
  const { data, error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't remove that booking. Try again." };
  }

  return { ok: true };
}

/**
 * Applying a Reservation Update Notice (issue #91, widened by #458) edits a
 * Booking already on file rather than creating or removing one. The caller
 * has resolved `bookingId` against this same caller's own Bookings — either
 * `matchUpdateToBooking`'s exact match or a suggestion the User confirmed —
 * so this is scoped by `id` alone, the same "RLS turns 'isn't yours' into an
 * empty result" shape `removeBooking` uses.
 *
 * A past date is refused, the same way every other Booking write refuses one
 * (`resolveValidatedOrg`) — an update for a slot that has already been and
 * gone is dropped by the review long before this, so the guard only ever
 * catches a stale review screen.
 *
 * The slot moves too. Until #458 only format and court label were written,
 * on the reasoning that matching keyed on Org + date + start time and so the
 * slot was already known to be unchanged. That is exactly what left an update
 * that *moved the time* unappliable, and a suggested match is a Booking whose
 * time the update is expected to differ from — so date/start/end are written
 * here, through the same `bookingInstants` day-bump every other Booking write
 * goes through, in the Org's own zone.
 *
 * Players are written only when the email listed some. A Reservation Update
 * Notice carries the reservation's complete current state, so its Player(s)
 * section is what the facility says is on that court now — but an email with
 * no Player(s) section at all is the facility saying nothing, not "nobody",
 * and clearing a Booking's Players on the strength of that would be a silent
 * loss. `replaceBookingPlayers` handles the rest, including leaving an
 * already-resolved Connection link untouched (ADR 0011).
 *
 * `notes` is optional and, unlike the rest, left untouched (omitted from the
 * update) when not given — it's only ever passed when the update's own court
 * text overflowed `courtLabel`'s length limit (`splitOverlongCourtLabel`) and
 * needs somewhere to land, not a field this update otherwise means to edit,
 * so an ordinary apply can't clobber notes the User already wrote on this
 * Booking for something unrelated.
 */
export async function applyBookingUpdate(
  supabase: SupabaseClient,
  ownerId: string,
  parsed: BookingUpdateApplication,
  now: Date = new Date(),
): Promise<BookingWrite> {
  // The Booking's own Org, not one the form named: an update edits a Booking
  // whose facility is already settled, and the zone the new start/end are
  // read in has to be that Org's.
  const { data: booking } = await supabase
    .from("bookings")
    .select("org_id")
    .eq("id", parsed.bookingId)
    .maybeSingle();

  if (!booking) {
    return { error: "Couldn't update that booking. Try again." };
  }

  const org = await resolveValidatedOrg(supabase, ownerId, { orgId: booking.org_id, date: parsed.date }, now);
  if ("error" in org) {
    return org;
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({
      format: parsed.format,
      court_label: parsed.courtLabel,
      ...(parsed.notes !== null ? { notes: parsed.notes } : {}),
      ...bookingInstants(parsed, org.timeZone),
    })
    .eq("id", parsed.bookingId)
    .select("id");

  if (error) {
    return { error: bookingWriteMessage(error) };
  }
  if (!data?.length) {
    return { error: "Couldn't update that booking. Try again." };
  }

  const playersError =
    parsed.players.length > 0
      ? await replaceBookingPlayers(supabase, ownerId, parsed.bookingId, parsed.players)
      : null;

  return { bookingId: parsed.bookingId, playersError };
}
