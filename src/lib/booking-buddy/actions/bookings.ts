"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { bookingWriteMessage, formatBookingWhen, parseNewBooking } from "../bookings.ts";
import { listOrgs, type Org } from "./orgs.ts";

export type { ActionResult } from "./result.ts";

export type Booking = {
  id: string;
  orgId: string;
  /** Resolved the same way the Orgs page resolves it, cache miss included. */
  orgName: string;
  courtLabel: string;
  /** Already rendered in the Booking's own zone — see `formatBookingWhen`. */
  when: string;
  startsAt: string;
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
      .select("id, org_id, court_label, starts_at, ends_at, time_zone")
      .order("starts_at", { ascending: true }),
  ]);

  if (bookingsResult.error) {
    readFailed("your bookings", bookingsResult.error);
  }

  const orgById = new Map(orgs.map((org) => [org.id, org]));

  return {
    orgs,
    bookings: (bookingsResult.data ?? []).map((row) => ({
      id: row.id,
      orgId: row.org_id,
      // An Org deleted between the two reads would leave this blank rather than
      // crash; the cascade means its Bookings are on their way out anyway.
      orgName: orgById.get(row.org_id)?.displayName ?? "Somewhere you played",
      courtLabel: row.court_label,
      when: formatBookingWhen({
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timeZone: row.time_zone,
      }),
      startsAt: row.starts_at,
    })),
  };
}

/**
 * Log a court reservation that already exists on the facility's own platform.
 *
 * The Org has to be one of the caller's own. This doesn't re-check that: the
 * `bookings_coherent` trigger does, because the rule needs a subquery and RLS
 * does not cover it — the insert is on `bookings`, a table the User may write,
 * and nothing in that policy looks at whose Org they named.
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
  const { error } = await supabase.from("bookings").insert({
    org_id: parsed.orgId,
    owner_id: session.userId,
    court_label: parsed.courtLabel,
    // Wall-clock strings carrying their own zone. Postgres does the DST-aware
    // conversion to an instant, which is much harder to get wrong than doing it
    // in JavaScript.
    starts_at: parsed.startsAt,
    ends_at: parsed.endsAt,
    time_zone: parsed.timeZone,
  });

  if (error) {
    return { error: bookingWriteMessage(error) };
  }

  revalidatePath(BOOKINGS_PATH);
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
  return { ok: true };
}
