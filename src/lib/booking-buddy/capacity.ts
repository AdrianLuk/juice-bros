/**
 * Pure logic for a Slot's Capacity (see CONTEXT.md, ADR 0001, ADR 0008).
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `slots`/`slot_bookings` migrations — change one and you must change the
 * other.
 */

import type { Gender } from "./gender.ts";
import type { Division } from "./division.ts";

/** What a Booking was reserved for — decides its own court's share of Capacity (ADR 0008). */
export type BookingFormat = "singles" | "doubles";

export const BOOKING_FORMATS: readonly BookingFormat[] = ["doubles", "singles"];

/** See ADR 0008 — a court's capacity comes from the Booking's own format, and the rotation buffer covers the rest. */
export const COURT_CAPACITY: Record<BookingFormat, number> = {
  singles: 2,
  doubles: 4,
};

export function isBookingFormat(value: unknown): value is BookingFormat {
  return BOOKING_FORMATS.includes(value as BookingFormat);
}

export const BOOKING_FORMAT_LABEL: Record<BookingFormat, string> = {
  doubles: "Doubles",
  singles: "Singles",
};

/** A buffer past this stops describing rotation and starts describing a different game. */
export const MAX_ROTATION_BUFFER = 20;

/**
 * The ceiling on "yes" Responses, or `null` for a Slot with no Booking
 * attached — a bare proposal has nothing to enforce yet (ADR 0001), which is
 * not the same as a capacity of zero.
 */
export function computeCapacity({
  formats,
  rotationBuffer,
}: {
  formats: BookingFormat[];
  rotationBuffer: number;
}): number | null {
  if (formats.length === 0) {
    return null;
  }

  return (
    formats.reduce((sum, format) => sum + COURT_CAPACITY[format], 0) + rotationBuffer
  );
}

/**
 * Whether the organizer should see the over-capacity signal.
 *
 * Strictly past the ceiling: a Slot filled exactly to Capacity is full, not
 * over. Nothing acts on this beyond showing it — "yes" Responses are never
 * blocked (ADR 0001).
 */
export function isOverCapacity({
  capacity,
  yesCount,
}: {
  capacity: number | null;
  yesCount: number;
}): boolean {
  return capacity !== null && yesCount > capacity;
}

/** One gender's own share of a gender-broken-down Capacity signal (issue #80). */
export type GenderCapacityBucket = {
  gender: Gender;
  yes: number;
  capacity: number;
};

export type GenderedCapacity = {
  /** One bucket for `mens`/`womens`, two (male, female) for `mixed`. */
  buckets: GenderCapacityBucket[];
  /** "Yes" Responses that aren't in any bucket — no Gender set, or (for `mens`/`womens`) the other gender. Still visible, just not reasoned about by side. */
  unspecified: number;
};

/**
 * The gender-broken-down version of the Capacity signal (issue #80) — `null`
 * for an `open` Slot or one with no Capacity yet, both of which keep today's
 * plain single-number signal unchanged (`isOverCapacity` still runs against
 * the flat total in that case). Nothing here blocks a "yes" Response either
 * way — this is ADR 0001's "signal, never block" posture, just a smarter
 * version of the number the organizer already sees.
 *
 * `mixed` is always a fixed even split of the Slot's own Capacity between the
 * two buckets — not something the organizer configures per Slot (decided
 * while scoping this ticket). For `mens`/`womens`, the whole Capacity is one
 * bucket for that gender; a "yes" from anyone else falls into `unspecified`
 * rather than being silently counted toward a side they didn't say yes as.
 */
export function computeGenderedCapacity({
  division,
  capacity,
  yesGenders,
}: {
  division: Division;
  capacity: number | null;
  yesGenders: (Gender | null)[];
}): GenderedCapacity | null {
  if (division === "open" || capacity === null) {
    return null;
  }

  const countOf = (gender: Gender) =>
    yesGenders.filter((g) => g === gender).length;

  if (division === "mixed") {
    const maleCapacity = Math.floor(capacity / 2);
    const femaleCapacity = capacity - maleCapacity;
    return {
      buckets: [
        { gender: "male", yes: countOf("male"), capacity: maleCapacity },
        { gender: "female", yes: countOf("female"), capacity: femaleCapacity },
      ],
      unspecified: yesGenders.filter((g) => g === null).length,
    };
  }

  const target: Gender = division === "mens" ? "male" : "female";
  return {
    buckets: [{ gender: target, yes: countOf(target), capacity }],
    unspecified: yesGenders.filter((g) => g !== target).length,
  };
}

/** Strictly past the ceiling, same rule as `isOverCapacity` — a bucket filled exactly to its own share is full, not over. */
export function isGenderBucketOverCapacity(bucket: GenderCapacityBucket): boolean {
  return bucket.yes > bucket.capacity;
}

/**
 * Whether a Booking's own reservation window overlaps a Slot's proposed one —
 * what makes it a candidate to attach at all. A multi-court game is several
 * Bookings at the *same* time, one Slot (CONTEXT.md's Booking entry); nothing
 * about ownership stops attaching a Booking from a different date entirely,
 * so this is the one place that rules it out before the picker ever offers it.
 *
 * Overlap, not exact equality: two courts booked 9:00–10:30 and 9:00–11:00
 * for the same game are still the same game.
 */
export function bookingOverlapsSlot(
  booking: { startsAt: string; endsAt: string },
  slot: { proposedStart: string; proposedEnd: string },
): boolean {
  return (
    new Date(booking.startsAt).getTime() < new Date(slot.proposedEnd).getTime() &&
    new Date(booking.endsAt).getTime() > new Date(slot.proposedStart).getTime()
  );
}

export function parseRotationBuffer(
  formData: FormData,
): { slotId: string; rotationBuffer: number } | { error: string } {
  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which slot is this for?" };
  }

  const raw = String(formData.get("rotation_buffer") ?? "").trim();
  if (raw === "") {
    return { slotId, rotationBuffer: 0 };
  }

  const rotationBuffer = Number(raw);
  if (!Number.isInteger(rotationBuffer) || rotationBuffer < 0) {
    return { error: "A rotation buffer is a whole number of extra players, or nothing." };
  }

  if (rotationBuffer > MAX_ROTATION_BUFFER) {
    return { error: `That's a lot of rotation — ${MAX_ROTATION_BUFFER} extra players at most.` };
  }

  return { slotId, rotationBuffer };
}

/** Turns a failed attach into something worth reading. */
export function slotBookingWriteMessage(error: {
  code?: string;
  message?: string;
} | null): string {
  if (error?.code === "23505") {
    // Two different constraints raise the same code: the primary key (this
    // exact pairing already exists) and `slot_bookings_booking_unique` (the
    // Booking is already on a *different* Slot) — worth telling apart, since
    // only one of them is "you already did this".
    if (error.message?.includes("slot_bookings_booking_unique")) {
      return "That booking is already attached to a different slot.";
    }
    return "That booking is already attached to this slot.";
  }

  // `assert_slot_booking_coherent` — the Slot and the Booking have different
  // owners. Reachable through a stale or tampered form, not the picker.
  if (error?.code === "23514") {
    return "You can only attach your own bookings, to your own slots.";
  }

  // `42501`: RLS filtered the insert out — an INSERT that fails `WITH CHECK`
  // raises rather than silently matching zero rows (unlike an UPDATE/DELETE),
  // so this is reachable, and for this table it means the Slot isn't the
  // caller's.
  if (error?.code === "42501") {
    return "You can only attach a booking to your own slot.";
  }

  return "Couldn't attach that booking. Try again.";
}
