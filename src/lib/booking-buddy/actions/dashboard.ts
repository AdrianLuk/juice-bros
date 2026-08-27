"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { readFailed } from "./result.ts";
import { getBookingsPageData, type Booking } from "./bookings.ts";
import type { Org } from "./orgs.ts";
import type { AvailabilityWindow } from "../availability.ts";

/** `AvailabilityWindow` plus the id the sidebar list's delete button needs — `resolveAvailability`/`resolveAvailabilitySegments` never needed it, so it stayed off the pure type. */
export type DashboardAvailabilityWindow = AvailabilityWindow & { id: string };

export type DashboardPageData = {
  orgs: Org[];
  bookings: Booking[];
  /** Raw rows — the client component resolves these against Bookings itself, per visible range (ADR 0006). */
  availabilityWindows: DashboardAvailabilityWindow[];
  /** Whether the caller owns at least one Slot — half of the Onboarding trigger (#176), alongside `bookings.length`. */
  hasSlot: boolean;
};

/**
 * Everything the dashboard calendar (issue #23) renders: the caller's own
 * Bookings and Orgs (the latter for the quick-add sheet's picker, reusing
 * `getBookingsPageData` rather than re-querying), plus their own raw
 * Availability Windows.
 *
 * Windows are handed over unresolved on purpose — `resolveAvailabilitySegments`
 * needs a visible range to resolve against, and that range is client-side
 * navigation state (which week/month is on screen), not something the server
 * render loop knows.
 */
export async function getDashboardPageData(): Promise<DashboardPageData> {
  const session = await verifySession();
  const supabase = await createClient();

  const [{ orgs, bookings }, windowsResult, slotCountResult] = await Promise.all([
    getBookingsPageData(),
    supabase
      .from("availability_windows")
      .select("id, type, starts_at, ends_at, created_at")
      .eq("owner_id", session.userId)
      .order("created_at", { ascending: true }),
    // Own Slots only — `slots` RLS also returns friends' visible ones, so the
    // `owner_id` filter is load-bearing here (same reason `trackFirstSlot` in
    // analytics.ts filters).
    supabase
      .from("slots")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", session.userId),
  ]);

  if (windowsResult.error) {
    readFailed("your availability", windowsResult.error);
  }
  if (slotCountResult.error) {
    readFailed("whether you have any slots", slotCountResult.error);
  }

  return {
    orgs,
    bookings,
    availabilityWindows: (windowsResult.data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    })),
    hasSlot: (slotCountResult.count ?? 0) > 0,
  };
}
