"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { AVAILABILITY_PATH, BOOKING_BUDDY_ROOT } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  availabilityWriteMessage,
  parseNewAvailabilityWindow,
  type AvailabilityWindow,
} from "../availability.ts";
import { nextCalendarDate } from "../datetime.ts";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "../orgs.ts";

export type { ActionResult } from "./result.ts";

/**
 * An `AvailabilityWindow` plus the `id` a delete needs — the shape both the
 * "Availability" page (`listAvailabilityWindows`) and the dashboard
 * (`getDashboardPageData`) hand their windows over in.
 */
export type AvailabilityWindowRecord = AvailabilityWindow & { id: string };

/**
 * The caller's own Availability Windows, oldest first — the one read behind
 * both the "Availability" page (issue #197) and the dashboard calendar/sidebar
 * (ADR 0006). Raw rows: the "Availability" page splits them into upcoming/past
 * and the dashboard resolves them against Bookings per visible range, so
 * neither wants them pre-filtered here.
 */
export async function listAvailabilityWindows(): Promise<AvailabilityWindowRecord[]> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_windows")
    .select("id, type, starts_at, ends_at, created_at")
    .eq("owner_id", session.userId)
    .order("created_at", { ascending: true });

  if (error) {
    readFailed("your availability", error);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  }));
}

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

  // Rendered on the dashboard (calendar overlay + sidebar list) and on the
  // "Availability" page's own list (issue #197) — revalidate both.
  revalidatePath(BOOKING_BUDDY_ROOT);
  revalidatePath(AVAILABILITY_PATH);
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
  revalidatePath(AVAILABILITY_PATH);
  return { ok: true };
}
