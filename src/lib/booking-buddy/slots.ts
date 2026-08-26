/**
 * Pure input handling for Slots (see CONTEXT.md, ADR 0001).
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `slots` migration — change one and you must change the other.
 */

import { isKnownTimeZone } from "./timezone.ts";
import {
  formatInstantRange,
  isHourTime,
  isPastDate,
  isRealDate,
} from "./datetime.ts";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "./orgs.ts";
import { parseDivision, type Division } from "./division.ts";

/** Mirrors `slot_notes_length` — bigger than a Booking name's cap since notes is meant to hold more than a short label. */
export const NOTES_MAX_LENGTH = 500;

export type NewSlotProposal = {
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  division: Division;
  /** The organizer's own hint at which facility they plan to book (issue #36) — optional, same as `setIntendedOrg`. */
  orgId: string | null;
  /** Null when the owner didn't add one — editable afterward via `setSlotNotes`. */
  notes: string | null;
};

/**
 * Trims to null when blank, and refuses anything over NOTES_MAX_LENGTH —
 * shared by `parseNewSlotProposal` and `setSlotNotes` (actions/slots.ts) so
 * create-time and edit-time validation can't drift apart.
 */
export function parseSlotNotes(raw: string): { notes: string | null } | { error: string } {
  const trimmed = raw.trim();
  const notes = trimmed === "" ? null : trimmed;

  if (notes && notes.length > NOTES_MAX_LENGTH) {
    return { error: `That note is too long — ${NOTES_MAX_LENGTH} characters at most.` };
  }

  return { notes };
}

/**
 * A bare-proposal Slot has no Org yet, so there is nothing to read a clock
 * off (unlike a Booking, per issue #20). Every early User is in Toronto —
 * the same reasoning `parseHandNamedOrg` already applies, not a second
 * decision made here — so this asks nothing and defaults silently. A
 * `time_zone` field is still honoured if a future form sends one.
 */
export function parseNewSlotProposal(
  formData: FormData,
  now: Date = new Date(),
): NewSlotProposal | { error: string } {
  const date = String(formData.get("date") ?? "").trim();
  if (!isRealDate(date)) {
    return { error: "Pick a date for the slot." };
  }

  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();

  if (!isHourTime(startTime) || !isHourTime(endTime)) {
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

  // Calendar-day-only, not exact-instant — a same-day proposal whose start
  // time has already passed slips through here and is caught by the
  // database trigger instead (`slotWriteMessage` translates it). Resolving
  // `timeZone` first is what makes this check possible at all: unlike a
  // Booking, a bare-proposal Slot has no Org to read a clock off, so this is
  // the only place in the whole write path that ever knows both the date and
  // the zone before the instant itself gets constructed.
  if (isPastDate(date, timeZone, now)) {
    return { error: "That date has already passed. Pick a date in the future." };
  }

  // Never refused for an odd value — a stray/tampered value just falls back
  // to `open`, the same "default rather than error" posture the rest of this
  // parser's siblings (`parseNewBooking`'s format) already take.
  const division = parseDivision(String(formData.get("division") ?? ""));

  // Ownership isn't checked here — same posture as `setIntendedOrg`, which
  // this reuses the column for. The picker only ever lists the caller's own
  // Orgs, and `assert_slot_intended_org_coherent` is what actually enforces
  // it if that's ever untrue.
  const orgId = String(formData.get("org_id") ?? "").trim() || null;

  const notesResult = parseSlotNotes(String(formData.get("notes") ?? ""));
  if ("error" in notesResult) {
    return notesResult;
  }

  return { date, startTime, endTime, timeZone, division, orgId, notes: notesResult.notes };
}

/**
 * A Slot's own title needs the facility without needing the Booking behind
 * it — friend-visible, unlike the Booking itself, since it only ever reads
 * `slot_bookings.org_name` (see the migration). Distinct names only, since
 * two courts at the same facility shouldn't repeat it twice; more than one
 * distinct facility is the multi-venue edge case, joined rather than picked
 * arbitrarily from.
 */
export function facilityLabel(orgNames: Iterable<string>): string | null {
  const distinct = [...new Set(orgNames)];
  if (distinct.length === 0) {
    return null;
  }
  return distinct.join(" & ");
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

/**
 * Turns a failed Slot write into something worth reading.
 *
 * `23514` arrives from three rules now: the two check constraints (end not
 * after start, a negative buffer — neither reachable through
 * `parseNewSlotProposal`, which already refuses the first and never sends
 * the second) and the `slots_not_in_the_past` trigger, which *is* reachable
 * — `parseNewSlotProposal`'s own past-date guard is calendar-day-only, so a
 * same-day proposal whose start time already passed reaches the database
 * before anything catches it.
 */
export function slotWriteMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23514") {
    if (error.message?.includes("in the past")) {
      return "That time has already passed. Pick a time in the future.";
    }
    return "Something about that slot doesn't add up.";
  }

  return "Couldn't create that slot. Try again.";
}
