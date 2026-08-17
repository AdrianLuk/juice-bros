"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKING_BUDDY_ROOT } from "../routes.ts";
import { type ActionResult } from "./result.ts";
import { availabilityWriteMessage, parseNewAvailabilityWindow } from "../availability.ts";
import { nextCalendarDate } from "../datetime.ts";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "../orgs.ts";

export type { ActionResult } from "./result.ts";

/**
 * Declare a stretch of open or busy time, entirely informational (ADR 0006 —
 * never blocks a Slot invite or Response).
 *
 * No zone picker, same call as `CreateOrgForm`'s hand-typed path
 * (`DEFAULT_HAND_NAMED_TIME_ZONE` in orgs.ts): every early User is in
 * Toronto, and an Availability Window has no Org to derive one from either.
 *
 * All day (the common "block off a week" case): `toDate` is inclusive as the
 * User picked it, and the row stores the exclusive `nextCalendarDate` after
 * it, matching how `resolveAvailability`'s `covers` check treats `endsAt`.
 * Timed (e.g. "busy tonight 6–9pm"): `fromDate`/`toDate` are used as-is with
 * their own clock times, same wall-clock-string-plus-zone construction as
 * `createBooking`.
 */
export async function createAvailabilityWindow(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseNewAvailabilityWindow(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const startsAt = `${parsed.fromDate} ${parsed.startTime ?? "00:00"}:00 ${DEFAULT_HAND_NAMED_TIME_ZONE}`;
  const endsAt =
    parsed.endTime === null
      ? `${nextCalendarDate(parsed.toDate)} 00:00:00 ${DEFAULT_HAND_NAMED_TIME_ZONE}`
      : `${parsed.toDate} ${parsed.endTime}:00 ${DEFAULT_HAND_NAMED_TIME_ZONE}`;

  const supabase = await createClient();

  const { error } = await supabase.from("availability_windows").insert({
    owner_id: session.userId,
    type: parsed.type,
    starts_at: startsAt,
    ends_at: endsAt,
  });

  if (error) {
    return { error: availabilityWriteMessage(error) };
  }

  // The dashboard is the only place these render (calendar overlay + sidebar
  // list) — same single revalidation as `createBooking`'s dashboard branch.
  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true };
}

/**
 * Delete an Availability Window — per ADR 0006, the intended way to "undo"
 * one: deleting reveals whichever older window, if any, still covers that
 * span, rather than leaving a gap.
 */
export async function deleteAvailabilityWindow(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const windowId = String(formData.get("window_id") ?? "");

  if (!windowId) {
    return { error: "Pick a window to remove." };
  }

  const supabase = await createClient();
  // Selected back for the same reason as `deleteBooking`: RLS turns "that
  // isn't yours" into an empty result, not an error.
  const { data, error } = await supabase
    .from("availability_windows")
    .delete()
    .eq("id", windowId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't remove that. Try again." };
  }

  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true };
}
