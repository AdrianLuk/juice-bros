"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { readFailed } from "./result.ts";
import { getBookingsPageData, type Booking } from "./bookings.ts";
import type { Org } from "./orgs.ts";
import type { AvailabilityWindow } from "../availability.ts";

export type DashboardPageData = {
  orgs: Org[];
  bookings: Booking[];
  /** Raw rows — the client component resolves these against Bookings itself, per visible range (ADR 0006). */
  availabilityWindows: AvailabilityWindow[];
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

  const [{ orgs, bookings }, windowsResult] = await Promise.all([
    getBookingsPageData(),
    supabase
      .from("availability_windows")
      .select("type, starts_at, ends_at, created_at")
      .eq("owner_id", session.userId)
      .order("created_at", { ascending: true }),
  ]);

  if (windowsResult.error) {
    readFailed("your availability", windowsResult.error);
  }

  return {
    orgs,
    bookings,
    availabilityWindows: (windowsResult.data ?? []).map((row) => ({
      type: row.type,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    })),
  };
}
