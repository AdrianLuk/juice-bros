"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import {
  bookACourtHeading,
  bookingsOpenedLabel,
  slotsNeedingACourt,
  type CourtlessSlot,
} from "../book-a-court.ts";
import { readFailed } from "./result.ts";
import { listOrgs } from "./orgs.ts";

/**
 * One of the caller's own games still waiting on a court now that its
 * facility's Booking Window is open (issue #573), already worded for the
 * notice. Organizer-only by construction: only the caller's own Slots are read.
 */
export type BookACourtNote = {
  slotId: string;
  standingGameId: string | null;
  /** "Book a court for Tue, Oct 20 at 8:00 PM" */
  heading: string;
  /** "Pickle Palace opened bookings yesterday." */
  openedLabel: string;
};

/**
 * Every "Book a court" notice across the caller's own upcoming games, soonest
 * first. No stored state: a notice lasts exactly as long as its condition
 * (attach a Booking, clear the Intended Org, or the game starts, and it's
 * gone). Independent of the Booking Reminder email preference. All reads are
 * the owner's own rows under existing RLS.
 */
export async function listBookACourtNotes(): Promise<BookACourtNote[]> {
  const session = await verifySession();
  const supabase = await createClient();
  const now = new Date();

  const { data: slotRows, error: slotsError } = await supabase
    .from("slots")
    .select("id, standing_game_id, intended_org_id, proposed_start, time_zone")
    .eq("owner_id", session.userId)
    .not("intended_org_id", "is", null)
    .gt("proposed_start", now.toISOString());

  if (slotsError) {
    readFailed("which games still need a court", slotsError);
  }
  const slots = slotRows ?? [];
  if (slots.length === 0) {
    return [];
  }

  const [bookedResult, orgs] = await Promise.all([
    supabase
      .from("slot_bookings")
      .select("slot_id")
      .in(
        "slot_id",
        slots.map((slot) => slot.id),
      ),
    listOrgs(),
  ]);

  if (bookedResult.error) {
    readFailed("which games still need a court", bookedResult.error);
  }
  const bookedSlotIds = new Set((bookedResult.data ?? []).map((row) => row.slot_id));
  const orgsById = new Map(orgs.map((org) => [org.id, org]));

  const courtless: (CourtlessSlot & { standingGameId: string | null })[] = slots.map(
    (slot) => {
      const org = slot.intended_org_id ? orgsById.get(slot.intended_org_id) : undefined;
      return {
        id: slot.id,
        standingGameId: slot.standing_game_id,
        proposedStart: slot.proposed_start,
        timeZone: slot.time_zone,
        hasBooking: bookedSlotIds.has(slot.id),
        intendedOrg: org
          ? { name: org.displayName, timeZone: org.timeZone, bookingWindow: org.bookingWindow }
          : null,
      };
    },
  );

  return slotsNeedingACourt(courtless, now).map((notice) => ({
    slotId: notice.slot.id,
    standingGameId: notice.slot.standingGameId,
    heading: bookACourtHeading(notice),
    openedLabel: bookingsOpenedLabel(notice),
  }));
}
