"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { readFailed } from "./result.ts";
import type { AvailabilityWindow } from "../availability.ts";

/** One `friend_visible_bookings` row — never `court_label`, and never the raw `bookings`/`orgs` rows behind it (see the view's own migration comment). */
export type FriendVisibleBooking = {
  id: string;
  facilityName: string;
  startsAt: string;
  endsAt: string;
};

export type FriendCalendarPageData = {
  friend: { displayName: string | null; username: string };
  bookings: FriendVisibleBooking[];
  availabilityWindows: AvailabilityWindow[];
};

/**
 * Everything the friend calendar (issue #61) renders: the named friend's
 * busy Bookings and their raw Availability Windows, or `null` if that
 * Username doesn't resolve to a *different* User the caller can even see the
 * profile of — an unknown handle, a real User with no Connection to the
 * caller, and the caller's own Username all collapse to the same `null`.
 * The first two are indistinguishable on purpose, same as `getSlotDetail`'s
 * own "missing row and RLS-hid are the same answer" posture; the third is
 * different in kind (there's no missing data — RLS lets your own profile
 * and Availability Windows through, just not `friend_visible_bookings`,
 * which never matches a self-pair) but would otherwise render a half-real
 * page with your own Availability Windows and zero Bookings, which is worse
 * than a 404 for a route whose entire premise is "someone else's calendar."
 *
 * The Visibility gate is not re-checked here beyond the self-pair guard —
 * it doesn't need to be. `friend_visible_bookings` and `availability_windows`
 * are each already gated by `has_open_time_visibility` at the database layer
 * (the view's own `where` clause; the table's own RLS policy), so a caller
 * without the `open_time` grant gets empty arrays back, server-enforced,
 * regardless of what this function does or doesn't check — issue #61's own
 * acceptance criterion for reaching this route directly by URL.
 */
export async function getFriendCalendarPageData(
  username: string,
): Promise<FriendCalendarPageData | null> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("username", username)
    .maybeSingle();

  if (profileError) {
    readFailed("that friend", profileError);
  }

  if (!profile || !profile.username || profile.id === session.userId) {
    return null;
  }

  const [bookingsResult, windowsResult] = await Promise.all([
    supabase
      .from("friend_visible_bookings")
      .select("booking_id, facility_name, starts_at, ends_at")
      .eq("owner_id", profile.id)
      .order("starts_at", { ascending: true }),
    supabase
      .from("availability_windows")
      .select("type, starts_at, ends_at, created_at")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: true }),
  ]);

  if (bookingsResult.error) {
    readFailed("their busy time", bookingsResult.error);
  }
  if (windowsResult.error) {
    readFailed("their availability", windowsResult.error);
  }

  return {
    friend: { displayName: profile.display_name, username: profile.username },
    bookings: (bookingsResult.data ?? []).map((row) => ({
      id: row.booking_id,
      facilityName: row.facility_name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
    availabilityWindows: (windowsResult.data ?? []).map((row) => ({
      type: row.type,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    })),
  };
}
