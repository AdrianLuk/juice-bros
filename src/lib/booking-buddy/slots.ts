/**
 * Pure input handling for Slots (see CONTEXT.md, ADR 0001).
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `slots` migration — change one and you must change the other.
 */

import { isKnownTimeZone } from "./timezone.ts";
import { formatInstantRange, isHalfHourTime, isRealDate } from "./datetime.ts";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "./orgs.ts";

export type NewSlotProposal = {
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
};

/**
 * A bare-proposal Slot has no Org yet, so there is nothing to read a clock
 * off (unlike a Booking, per issue #20). Every early User is in Toronto —
 * the same reasoning `parseHandNamedOrg` already applies, not a second
 * decision made here — so this asks nothing and defaults silently. A
 * `time_zone` field is still honoured if a future form sends one.
 */
export function parseNewSlotProposal(
  formData: FormData,
): NewSlotProposal | { error: string } {
  const date = String(formData.get("date") ?? "").trim();
  if (!isRealDate(date)) {
    return { error: "Pick a date for the slot." };
  }

  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();

  if (!isHalfHourTime(startTime) || !isHalfHourTime(endTime)) {
    return { error: "Pick a start and end time." };
  }

  // Zero-padded 24-hour times compare correctly as strings. A Slot spanning
  // midnight would defeat this, and is not something this form can produce.
  if (endTime <= startTime) {
    return { error: "The end time has to be after the start time." };
  }

  const rawTimeZone = String(formData.get("time_zone") ?? "").trim();
  const timeZone = rawTimeZone || DEFAULT_HAND_NAMED_TIME_ZONE;

  if (!isKnownTimeZone(timeZone)) {
    return { error: "Couldn't tell what time zone to use for this slot. Try again." };
  }

  return { date, startTime, endTime, timeZone };
}

/**
 * When a Slot is proposed for, written as the zone it was created in.
 *
 * `proposed_start` is an instant, and rendering it needs to be told which
 * clock to use, or the server's own zone (UTC in production) turns a 9am
 * proposal into whatever hour that instant happens to be elsewhere — the
 * same reasoning `formatBookingWhen` follows, via the shared `datetime.ts`
 * formatter both now call.
 */
export function formatSlotWhen(slot: {
  proposedStart: string;
  proposedEnd: string;
  timeZone: string;
}): string {
  return formatInstantRange({
    startsAt: slot.proposedStart,
    endsAt: slot.proposedEnd,
    timeZone: slot.timeZone,
  });
}

/** Turns a failed Slot write into something worth reading. */
export function slotWriteMessage(error: { code?: string }): string {
  if (error.code === "23514") {
    // The two check constraints: end not after start, or a negative buffer —
    // neither reachable through `parseNewSlotProposal`, which already refuses
    // the first and never sends the second.
    return "Something about that slot doesn't add up.";
  }

  return "Couldn't create that slot. Try again.";
}
