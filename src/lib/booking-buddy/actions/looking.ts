"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { readFailed } from "./result.ts";
import { getFriendsPageData } from "./connections.ts";
import { personLabel } from "../connections.ts";
import { formatAvailabilityWindowRange } from "../availability.ts";
import { proposeGamePrefill } from "../slots.ts";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "../orgs.ts";
import { proposeGameHref } from "../routes.ts";

export type FriendLookingWindow = {
  /** The Availability Window's own id — only used as a React key. */
  id: string;
  friendName: string;
  /** Already rendered in `DEFAULT_HAND_NAMED_TIME_ZONE` — e.g. "Aug 24 · 6:00 PM – 9:00 PM". */
  rangeLabel: string;
  /** Deep link into the Games form, prefilled to this window (or today, if it's already running). */
  proposeHref: string;
  /** ISO instant — the list is already sorted by it; kept for the client if it ever needs to re-sort. */
  startsAt: string;
};

/**
 * Every upcoming "Looking to play" window a friend of the caller's has shared
 * with them — the pool behind the Games page's "Friends looking to play"
 * section (#230). One row per window, soonest first.
 *
 * A friend only appears if their resolved Visibility currently grants the
 * caller `open_time` — the same gate the friend calendar and "Find a time"
 * use. `getFriendsPageData` already resolves that set (and the display names),
 * so this reuses it rather than re-running the RPC; the
 * `availability_windows` RLS policy (`has_open_time_visibility`) is the actual
 * enforcement, the `owner_id` filter is just to keep the read small.
 *
 * Deliberately not an intersection or a "when are we all free" view — that is
 * "Find a time". This is a flat feed of individual intent.
 */
export async function listFriendsLookingToPlay(): Promise<FriendLookingWindow[]> {
  await verifySession();
  const supabase = await createClient();

  const { friends, calendarVisibleFriendIds } = await getFriendsPageData();

  const nameById = new Map<string, string>();
  const visibleFriendIds: string[] = [];
  for (const friend of friends) {
    if (calendarVisibleFriendIds.has(friend.userId)) {
      visibleFriendIds.push(friend.userId);
      nameById.set(friend.userId, personLabel(friend));
    }
  }

  if (visibleFriendIds.length === 0) {
    return [];
  }

  const now = new Date();
  const { data, error } = await supabase
    .from("availability_windows")
    .select("id, owner_id, starts_at, ends_at")
    .in("owner_id", visibleFriendIds)
    .eq("type", "looking")
    .gt("ends_at", now.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    readFailed("which friends are looking to play", error);
  }

  return (data ?? []).map((row) => {
    const window = {
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timeZone: DEFAULT_HAND_NAMED_TIME_ZONE,
    };
    return {
      id: row.id,
      friendName: nameById.get(row.owner_id) ?? "A friend",
      rangeLabel: formatAvailabilityWindowRange(window, DEFAULT_HAND_NAMED_TIME_ZONE),
      proposeHref: proposeGameHref(proposeGamePrefill(window, now)),
      startsAt: row.starts_at,
    };
  });
}
