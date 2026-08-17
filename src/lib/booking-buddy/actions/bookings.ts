"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKING_BUDDY_ROOT, BOOKINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { bookingWriteMessage, formatBookingWhen, parseNewBooking } from "../bookings.ts";
import { isPastDate } from "../datetime.ts";
import type { BookingFormat } from "../capacity.ts";
import { listOrgs, type Org } from "./orgs.ts";

export type { ActionResult } from "./result.ts";

export type Booking = {
  id: string;
  orgId: string;
  /** Resolved the same way the Orgs page resolves it, cache miss included. */
  orgName: string;
  /** Null when the User didn't note one down — not every facility labels its courts. */
  courtLabel: string | null;
  /** Already rendered in the Booking's own zone — see `formatBookingWhen`. */
  when: string;
  startsAt: string;
  endsAt: string;
  /** The facility's own clock (issue #20) — what `when` was rendered in. Surfaced raw for the dashboard calendar's (#23) detail popover. */
  timeZone: string;
  /** Doubles (4) or singles (2) — what this court's own share of Capacity is (ADR 0008). */
  format: BookingFormat;
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

  const [orgs, bookingsResult] = await Promise.all([
    listOrgs(),
    supabase
      .from("bookings")
      .select("id, org_id, court_label, starts_at, ends_at, format")
      .order("starts_at", { ascending: true }),
  ]);

  if (bookingsResult.error) {
    readFailed("your bookings", bookingsResult.error);
  }

  const orgById = new Map(orgs.map((org) => [org.id, org]));

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
        when: formatBookingWhen({
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          timeZone: org?.timeZone ?? "UTC",
        }),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timeZone: org?.timeZone ?? "UTC",
        format: row.format,
      };
    }),
  };
}

/**
 * Log a court reservation that already exists on the facility's own platform.
 *
 * The zone comes from the Org, not the form (issue #20) — every Booking under
 * one Org is on the same clock, so there's nothing left for the User to pick.
 * This means a fresh read of the Org right before the insert, rather than
 * trusting whatever `orgs` list the form was rendered with: the read doubles
 * as the ownership check (a stale or tampered `org_id` fails here with a clear
 * message, ahead of the `bookings_coherent` trigger, which is still the
 * authority — the rule needs a subquery and RLS does not cover it, since the
 * insert is on `bookings`, a table the User may write, and nothing in that
 * policy looks at whose Org they named).
 */
export async function createBooking(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();

  const { data: org, error: orgError } = await supabase
    .from("orgs")
    .select("time_zone")
    .eq("id", parsed.orgId)
    .eq("owner_id", session.userId)
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

  const { error } = await supabase.from("bookings").insert({
    org_id: parsed.orgId,
    owner_id: session.userId,
    court_label: parsed.courtLabel,
    format: parsed.format,
    // Wall-clock strings carrying their own zone. Postgres does the DST-aware
    // conversion to an instant, which is much harder to get wrong than doing it
    // in JavaScript.
    starts_at: `${parsed.date} ${parsed.startTime}:00 ${org.time_zone}`,
    ends_at: `${parsed.date} ${parsed.endTime}:00 ${org.time_zone}`,
  });

  if (error) {
    return { error: bookingWriteMessage(error) };
  }

  revalidatePath(BOOKINGS_PATH);
  // The dashboard calendar (#23) renders these too, via a quick-add sheet
  // that posts here without navigating off `/booking-buddy`.
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
