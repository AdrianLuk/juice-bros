"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { clockInZone, formatShortDateLabel, formatTimeLabel, todayInZone } from "../datetime.ts";
import { courtMatches, type MatchableBooking } from "../court-match.ts";
import type { BookingFormat } from "../capacity.ts";
import { readFailed } from "./result.ts";
import { getBookingsPageData, type Booking } from "./bookings.ts";

/**
 * One Booking the organizer could attach to one of their Standing Games'
 * posted games (issue #582). Only ever shown as a suggestion; attaching is
 * the organizer's tap through `attachBookingToSlot`.
 */
export type CourtMatch = {
  slotId: string;
  standingGameId: string;
  /** The game it would be attached to, in the game's own zone: "Tue, Oct 13". */
  gameDay: string;
  bookingId: string;
  orgName: string;
  courtLabel: string | null;
  format: BookingFormat;
  /** The Booking's own start in its own zone: "8:00 PM". */
  startLabel: string;
};

/**
 * Every court suggestion across the caller's own upcoming Standing Game
 * games, soonest game first. Reads only; never attaches anything. All reads
 * are the owner's own rows under existing RLS.
 */
export async function listCourtMatches(): Promise<CourtMatch[]> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data: slotRows, error: slotsError } = await supabase
    .from("slots")
    .select("id, standing_game_id, intended_org_id, proposed_start, proposed_end, time_zone")
    .eq("owner_id", session.userId)
    .not("standing_game_id", "is", null)
    .not("intended_org_id", "is", null)
    .gte("proposed_end", new Date().toISOString())
    .order("proposed_start", { ascending: true });

  if (slotsError) {
    readFailed("your weekly games' courts", slotsError);
  }
  const slots = slotRows ?? [];
  if (slots.length === 0) {
    return [];
  }

  const [bookedResult, { bookings }] = await Promise.all([
    supabase
      .from("slot_bookings")
      .select("slot_id")
      .in(
        "slot_id",
        slots.map((slot) => slot.id),
      ),
    getBookingsPageData(),
  ]);

  if (bookedResult.error) {
    readFailed("your weekly games' courts", bookedResult.error);
  }
  const bookedSlotIds = new Set((bookedResult.data ?? []).map((row) => row.slot_id));

  // Only Bookings at one of these games' facilities can match, so only those
  // need the "attached anywhere?" check.
  const intendedOrgIds = new Set(slots.map((slot) => slot.intended_org_id));
  const candidates = bookings.filter((booking) => intendedOrgIds.has(booking.orgId));
  if (candidates.length === 0) {
    return [];
  }

  const { data: takenRows, error: takenError } = await supabase
    .from("slot_bookings")
    .select("booking_id")
    .in(
      "booking_id",
      candidates.map((booking) => booking.id),
    );

  if (takenError) {
    readFailed("which of your bookings are attached", takenError);
  }
  const takenIds = new Set((takenRows ?? []).map((row) => row.booking_id));
  const matchable: (Booking & MatchableBooking)[] = candidates.map((booking) => ({
    ...booking,
    attached: takenIds.has(booking.id),
  }));

  return slots.flatMap((slot) =>
    courtMatches(
      {
        standingGameId: slot.standing_game_id,
        intendedOrgId: slot.intended_org_id,
        proposedStart: slot.proposed_start,
        proposedEnd: slot.proposed_end,
        hasBooking: bookedSlotIds.has(slot.id),
      },
      matchable,
    ).map((booking) => ({
      slotId: slot.id,
      standingGameId: slot.standing_game_id as string,
      gameDay: formatShortDateLabel(todayInZone(slot.time_zone, new Date(slot.proposed_start))),
      bookingId: booking.id,
      orgName: booking.orgName,
      courtLabel: booking.courtLabel,
      format: booking.format,
      startLabel: formatTimeLabel(clockInZone(booking.timeZone, new Date(booking.startsAt))),
    })),
  );
}
