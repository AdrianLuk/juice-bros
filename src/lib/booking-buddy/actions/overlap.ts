"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { readFailed } from "./result.ts";
import { getFriendsPageData } from "./connections.ts";
import { listAvailabilityWindows } from "./availability.ts";
import type { AvailabilityWindow, BusyInterval } from "../availability.ts";

/** A friend the viewer can pick in the "Find a time" view (issue #195). */
export type OverlapFriend = {
  userId: string;
  displayName: string | null;
  username: string;
};

export type OverlapPageData = {
  /**
   * The only friends whose availability this view can read: those whose
   * resolved Visibility currently grants the viewer `open_time`, the same gate
   * the friend calendar enforces (issue #61). A friend outside it never
   * appears in the picker at all.
   */
  selectableFriends: OverlapFriend[];
  /** The viewer's own Bookings (a confirmed Slot's Booking is already one of these) as busy spans. */
  viewerBusy: BusyInterval[];
  viewerWindows: AvailabilityWindow[];
};

/**
 * Everything the "Find a time" page needs for its initial render: who the
 * viewer may compare against, and the viewer's own busy time + Availability
 * Windows. The friends' own availability is fetched separately
 * (`getFriendAvailability`) once a selection is made — that's the part that
 * changes as the user picks people, and it's the interactive-route trigger
 * that puts this page on TanStack Query (see CLAUDE.md).
 */
export async function getOverlapPageData(): Promise<OverlapPageData> {
  const session = await verifySession();
  const supabase = await createClient();

  const { friends, calendarVisibleFriendIds } = await getFriendsPageData();

  const [windows, bookingsResult] = await Promise.all([
    listAvailabilityWindows(),
    supabase
      .from("bookings")
      .select("starts_at, ends_at")
      .eq("owner_id", session.userId)
      .order("starts_at", { ascending: true }),
  ]);

  if (bookingsResult.error) {
    readFailed("your booked time", bookingsResult.error);
  }

  return {
    selectableFriends: friends.flatMap((person) =>
      person.username && calendarVisibleFriendIds.has(person.userId)
        ? [
            {
              userId: person.userId,
              displayName: person.displayName,
              username: person.username,
            },
          ]
        : [],
    ),
    viewerBusy: (bookingsResult.data ?? []).map((row) => ({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
    viewerWindows: windows.map((window) => ({
      type: window.type,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      createdAt: window.createdAt,
    })),
  };
}

export type FriendAvailability = {
  userId: string;
  busyIntervals: BusyInterval[];
  windows: AvailabilityWindow[];
};

/**
 * The busy time + Availability Windows for each of `friendUserIds` — for the
 * overlap intersection (`resolveCommonOpenSegments`), run once per friend
 * selection change.
 *
 * The id list comes off the client, so it is re-filtered server-side through
 * `open_time_visible_owners` before any read: a friend the viewer no longer
 * has `open_time` into is dropped here, and the underlying `friend_visible_bookings`
 * view / `availability_windows` RLS policy would return nothing for them
 * anyway (both gated by `has_open_time_visibility`). This never widens what a
 * friend exposes — it reads exactly what the one-friend calendar already can.
 */
export async function getFriendAvailability(
  friendUserIds: string[],
): Promise<FriendAvailability[]> {
  await verifySession();

  const unique = [...new Set(friendUserIds)].filter((id) => id.length > 0);
  if (unique.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data: visibleData, error: visibleError } = await supabase.rpc(
    "open_time_visible_owners",
    { owner_users: unique },
  );
  if (visibleError) {
    readFailed("whose open time you can see", visibleError);
  }
  const visibleIds = (visibleData ?? []) as string[];
  if (visibleIds.length === 0) {
    return [];
  }

  const [bookingsResult, windowsResult] = await Promise.all([
    supabase
      .from("friend_visible_bookings")
      .select("owner_id, starts_at, ends_at")
      .in("owner_id", visibleIds),
    supabase
      .from("availability_windows")
      .select("owner_id, type, starts_at, ends_at, created_at")
      .in("owner_id", visibleIds),
  ]);

  if (bookingsResult.error) {
    readFailed("your friends' booked time", bookingsResult.error);
  }
  if (windowsResult.error) {
    readFailed("your friends' open time", windowsResult.error);
  }

  return visibleIds.map((userId) => ({
    userId,
    busyIntervals: (bookingsResult.data ?? [])
      .filter((row) => row.owner_id === userId)
      .map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at })),
    windows: (windowsResult.data ?? [])
      .filter((row) => row.owner_id === userId)
      .map((row) => ({
        type: row.type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        createdAt: row.created_at,
      })),
  }));
}
