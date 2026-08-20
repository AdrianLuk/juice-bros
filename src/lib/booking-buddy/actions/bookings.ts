"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKING_BUDDY_ROOT, BOOKINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  bookingWriteMessage,
  formatBookingWhen,
  parseNewBooking,
  type NewBooking,
} from "../bookings.ts";
import { isPastDate } from "../datetime.ts";
import type { BookingFormat } from "../capacity.ts";
import { connectionCandidatesFromFriends, matchPlayerNamesToConnections } from "../email-sync-matching.ts";
import { listOrgs, type Org } from "./orgs.ts";
import { listConnections } from "./connections.ts";

export type { ActionResult } from "./result.ts";

export type Booking = {
  id: string;
  orgId: string;
  /** Resolved the same way the Orgs page resolves it, cache miss included. */
  orgName: string;
  /** Null when the User didn't note one down — not every facility labels its courts. */
  courtLabel: string | null;
  /** Null when the User didn't give the Booking a name. */
  name: string | null;
  /** Already rendered in the Booking's own zone — see `formatBookingWhen`. */
  when: string;
  startsAt: string;
  endsAt: string;
  /** The facility's own clock (issue #20) — what `when` was rendered in. Surfaced raw for the dashboard calendar's (#23) detail popover. */
  timeZone: string;
  /** Doubles (4) or singles (2) — what this court's own share of Capacity is (ADR 0008). */
  format: BookingFormat;
  /** Names only, alphabetical — the Connection link is write-time-only data (ADR 0011), not surfaced on this list. */
  players: string[];
};

export type BookingsPageData = {
  orgs: Org[];
  bookings: Booking[];
};

/**
 * Everything the bookings page renders: the caller's Bookings, soonest first,
 * and the Orgs the form's picker offers.
 *
 * Formatting happens here rather than in the component because it needs each
 * Booking's own `time_zone`, and the alternative — letting the browser pick —
 * is the bug that column exists to prevent.
 */
export async function getBookingsPageData(): Promise<BookingsPageData> {
  await verifySession();
  const supabase = await createClient();

  const [orgs, bookingsResult, playersResult] = await Promise.all([
    listOrgs(),
    supabase
      .from("bookings")
      .select("id, org_id, court_label, name, starts_at, ends_at, format")
      .order("starts_at", { ascending: true }),
    // A separate query rather than a PostgREST embed — this codebase avoids
    // embedding (see PROGRESS.md's connections notes) and joins in
    // application code instead.
    //
    // Ordered by name, not created_at: every Player from one Booking is
    // written in a single insert (`insertBookingPlayers`), so they all share
    // the exact same `now()` — Postgres gives no guarantee about the order of
    // ties, so a real tiebreaker is what actually makes the list stable.
    supabase
      .from("booking_players")
      .select("booking_id, name")
      .order("name", { ascending: true }),
  ]);

  if (bookingsResult.error) {
    readFailed("your bookings", bookingsResult.error);
  }
  if (playersResult.error) {
    readFailed("your bookings' players", playersResult.error);
  }

  const orgById = new Map(orgs.map((org) => [org.id, org]));

  const playerNamesByBookingId = new Map<string, string[]>();
  for (const row of playersResult.data ?? []) {
    const names = playerNamesByBookingId.get(row.booking_id) ?? [];
    names.push(row.name);
    playerNamesByBookingId.set(row.booking_id, names);
  }

  return {
    orgs,
    bookings: (bookingsResult.data ?? []).map((row) => {
      const org = orgById.get(row.org_id);
      return {
        id: row.id,
        orgId: row.org_id,
        // An Org deleted between the two reads would leave this blank rather
        // than crash; the cascade means its Bookings are on their way out
        // anyway. Same fallback spirit for the zone: UTC is honest about not
        // knowing rather than a guess.
        orgName: org?.displayName ?? "Somewhere you played",
        courtLabel: row.court_label,
        name: row.name,
        when: formatBookingWhen({
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          timeZone: org?.timeZone ?? "UTC",
        }),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timeZone: org?.timeZone ?? "UTC",
        format: row.format,
        players: playerNamesByBookingId.get(row.id) ?? [],
      };
    }),
  };
}

/**
 * The org-ownership re-check and past-date check shared by
 * `insertValidatedBooking` and `updateValidatedBooking` — both start from an
 * already-validated `NewBooking` and need the same answer to "is this
 * actually one of the caller's own Orgs, and is the date still good", before
 * either an insert or an update.
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
  ownerId: string,
  parsed: NewBooking,
): Promise<{ timeZone: string } | { error: string }> {
  const supabase = await createClient();

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
  if (isPastDate(parsed.date, org.time_zone, new Date())) {
    return { error: "That date has already passed. Pick a date in the future." };
  }

  return { timeZone: org.time_zone };
}

/**
 * Matches `players` against the caller's own Connections and writes them as
 * `booking_players` rows under `bookingId` — the match is resolved here, once,
 * and stored; nothing downstream recomputes it (ADR 0011). A no-op for zero
 * Players, e.g. an Import Candidate whose parsed email carried no names
 * (issue #100).
 */
async function insertBookingPlayers(bookingId: string, players: readonly string[]): Promise<string | null> {
  if (players.length === 0) {
    return null;
  }

  const connections = await listConnections();
  const connectionCandidates = connectionCandidatesFromFriends(connections.friends);

  const matches = matchPlayerNamesToConnections(players, connectionCandidates);

  const supabase = await createClient();
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
 * The insert and error translation shared by `createBooking`'s own
 * form-parsed path and `confirmImportCandidate` (issue #64) — both start
 * from an already-validated `NewBooking`, so everything below this point is
 * identical either way.
 */
export async function insertValidatedBooking(
  ownerId: string,
  parsed: NewBooking,
): Promise<ActionResult> {
  const org = await resolveValidatedOrg(ownerId, parsed);
  if ("error" in org) {
    return org;
  }

  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      org_id: parsed.orgId,
      owner_id: ownerId,
      court_label: parsed.courtLabel,
      name: parsed.name,
      format: parsed.format,
      // Wall-clock strings carrying their own zone. Postgres does the DST-aware
      // conversion to an instant, which is much harder to get wrong than doing it
      // in JavaScript.
      starts_at: `${parsed.date} ${parsed.startTime}:00 ${org.timeZone}`,
      ends_at: `${parsed.date} ${parsed.endTime}:00 ${org.timeZone}`,
    })
    .select("id")
    .single();

  if (error || !booking) {
    return { error: bookingWriteMessage(error ?? {}) };
  }

  const playersError = await insertBookingPlayers(booking.id, parsed.players);

  revalidatePath(BOOKINGS_PATH);
  // The dashboard calendar (#23) renders these too, via a quick-add sheet
  // that posts here without navigating off `/booking-buddy`.
  revalidatePath(BOOKING_BUDDY_ROOT);

  // The Booking itself already committed — a failure here is Players-only,
  // so the two paths still revalidate above rather than leaving the User to
  // resubmit and log a duplicate Booking on top of the one that already saved.
  if (playersError) {
    return { error: playersError };
  }

  return { ok: true };
}

/** Log a court reservation that already exists on the facility's own platform. */
export async function createBooking(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  return insertValidatedBooking(session.userId, parsed);
}

/**
 * The update and error translation shared by `updateBooking`'s own
 * form-parsed path with whatever else edits a full Booking later, mirroring
 * `insertValidatedBooking`'s shape on the update side — same
 * `resolveValidatedOrg` re-check, scoped to `bookingId` instead of a fresh
 * row. No new migration needed: `bookings_coherent` already fires `before
 * insert or update` (org-ownership + zone-validity), and RLS already turns
 * "isn't yours" into an empty result rather than an error — the same shape
 * `deleteOwnedBooking` and `updateOwnedBookingFormatAndCourt` already use, so
 * `bookingId` isn't re-scoped by `owner_id` in the query itself.
 */
export async function updateValidatedBooking(
  ownerId: string,
  bookingId: string,
  parsed: NewBooking,
): Promise<ActionResult> {
  const org = await resolveValidatedOrg(ownerId, parsed);
  if ("error" in org) {
    return org;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({
      org_id: parsed.orgId,
      court_label: parsed.courtLabel,
      name: parsed.name,
      format: parsed.format,
      starts_at: `${parsed.date} ${parsed.startTime}:00 ${org.timeZone}`,
      ends_at: `${parsed.date} ${parsed.endTime}:00 ${org.timeZone}`,
    })
    .eq("id", bookingId)
    .select("id");

  if (error) {
    return { error: bookingWriteMessage(error) };
  }
  if (!data?.length) {
    return { error: "Couldn't update that booking. Try again." };
  }

  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true };
}

/** Edit an existing Booking — same validation as logging one (issue #97). */
export async function updateBooking(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const bookingId = String(formData.get("booking_id") ?? "");

  if (!bookingId) {
    return { error: "Pick a booking to edit." };
  }

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  return updateValidatedBooking(session.userId, bookingId, parsed);
}

/**
 * The delete-by-id, RLS-empty-result-means-error, and revalidate sequence
 * shared by `deleteBooking`'s own form-parsed path and
 * `confirmCancellationCandidate` (issue #65) — both already know the exact
 * `bookingId` to remove, so everything below that point is identical either
 * way, the same shared-helper shape `insertValidatedBooking` already
 * established for the create side.
 */
export async function deleteOwnedBooking(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
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

  revalidatePath(BOOKINGS_PATH);
  // The dashboard calendar's (#23) Booking popover can remove one too.
  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true };
}

/**
 * Applying a matched Reservation Update Notice (issue #91) edits the format
 * and court label already on file for a Booking, rather than creating or
 * removing one — `matchUpdateToBooking` (`email-sync-matching.ts`) already
 * resolved `bookingId` against this same caller's own Bookings, so this is
 * scoped by `id` alone, the same "RLS turns 'isn't yours' into an empty
 * result" shape `deleteOwnedBooking` already established. `startsAt`/`endsAt`
 * are never touched: matching is deliberately Org + date/start-time only
 * (not court), so the slot the update refers to is already known to be
 * unchanged — only its format and court label can differ.
 */
export async function updateOwnedBookingFormatAndCourt(
  bookingId: string,
  fields: { format: BookingFormat; courtLabel: string | null },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ format: fields.format, court_label: fields.courtLabel })
    .eq("id", bookingId)
    .select("id");

  if (error) {
    return { error: bookingWriteMessage(error) };
  }
  if (!data?.length) {
    return { error: "Couldn't update that booking. Try again." };
  }

  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true };
}

export async function deleteBooking(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const bookingId = String(formData.get("booking_id") ?? "");

  if (!bookingId) {
    return { error: "Pick a booking to remove." };
  }

  return deleteOwnedBooking(bookingId);
}
