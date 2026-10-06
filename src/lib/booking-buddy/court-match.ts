/**
 * Which of the organizer's Bookings could be this week's court for a
 * Standing Game's posted Slot (issue #582). Pure, relative imports only, so it
 * runs under `node --test`.
 *
 * A match only ever becomes a suggestion: attaching stays the organizer's own
 * tap through `attachBookingToSlot` (ADR 0002, CONTEXT.md's Standing Game
 * entry). Nothing here writes, and nothing calls it to write.
 */

import { bookingOverlapsSlot } from "./capacity.ts";

export type MatchableSlot = {
  /** Only a Standing Game's posted Slot gets suggestions; `null` is a one-off game. */
  standingGameId: string | null;
  intendedOrgId: string | null;
  proposedStart: string;
  proposedEnd: string;
  /** Whether any Booking is attached to this Slot already. */
  hasBooking: boolean;
};

export type MatchableBooking = {
  id: string;
  orgId: string;
  startsAt: string;
  endsAt: string;
  /** Attached to some Slot already (`slot_bookings` is unique on the Booking). */
  attached: boolean;
};

/**
 * Every Booking that matches the Slot, soonest start first. Several matches
 * all come back: picking one is the organizer's call, never this function's.
 */
export function courtMatches<B extends MatchableBooking>(
  slot: MatchableSlot,
  bookings: readonly B[],
): B[] {
  if (slot.standingGameId === null || slot.intendedOrgId === null || slot.hasBooking) {
    return [];
  }
  return bookings
    .filter(
      (booking) =>
        !booking.attached &&
        booking.orgId === slot.intendedOrgId &&
        bookingOverlapsSlot(booking, slot),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
