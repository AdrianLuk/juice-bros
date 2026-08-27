"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession, type Session } from "../dal.ts";
import { trackFirstFriend } from "../analytics.ts";
import { FRIENDS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  groupConnections,
  type ConnectionEntry,
  type ConnectionRow,
  type GroupedConnections,
} from "../connections.ts";

export type { ActionResult } from "./result.ts";

/** One entry in a friends-page list: the Connection plus who it is with. */
export type ConnectionPerson = {
  connectionId: string;
  userId: string;
  displayName: string | null;
  username: string | null;
};

export type ConnectionLists = Record<
  keyof GroupedConnections,
  ConnectionPerson[]
>;

const NO_CONNECTIONS: ConnectionLists = { friends: [], received: [], sent: [] };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The `connections` read + grouping shared by `listConnections` and `getFriendsPageData`, so the two don't drift apart. */
async function fetchGroupedConnections(
  session: Session,
  supabase: Supabase,
): Promise<GroupedConnections> {
  const { data: rows, error } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, status, created_at");

  if (error) {
    readFailed("your connections", error);
  }

  return groupConnections((rows ?? []) as ConnectionRow[], session.userId);
}

/**
 * Turns Connection entries into display-ready people, given a profile lookup
 * map. A *missing* profile is different from a failed query and stays
 * tolerated here: RLS can legitimately hide a profile, and an unnamed friend
 * beats a crash.
 */
function peopleFromProfiles(
  entries: ConnectionEntry[],
  profileById: Map<
    string,
    { display_name: string | null; username: string | null }
  >,
): ConnectionPerson[] {
  return entries.map((entry) => {
    const profile = profileById.get(entry.otherUserId);
    return {
      connectionId: entry.connectionId,
      userId: entry.otherUserId,
      displayName: profile?.display_name ?? null,
      username: profile?.username ?? null,
    };
  });
}

/**
 * The caller's Connections, split into friends, requests received and requests
 * sent.
 *
 * Two queries rather than one join: `connections` references `auth.users`, not
 * `public.profiles`, so PostgREST has no relationship to embed across. RLS
 * scopes both — the profile policy covers pending Connections too, which is
 * what makes an incoming request show a name instead of an anonymous row.
 */
export async function listConnections(): Promise<ConnectionLists> {
  const session = await verifySession();
  const supabase = await createClient();

  const grouped = await fetchGroupedConnections(session, supabase);
  const buckets = Object.values(grouped);
  const otherUserIds = buckets.flat().map((entry) => entry.otherUserId);

  if (otherUserIds.length === 0) {
    return NO_CONNECTIONS;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", otherUserIds);

  if (profilesError) {
    readFailed("who those connections are with", profilesError);
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return {
    friends: peopleFromProfiles(grouped.friends, profileById),
    received: peopleFromProfiles(grouped.received, profileById),
    sent: peopleFromProfiles(grouped.sent, profileById),
  };
}

export type FriendsPageData = ConnectionLists & {
  /** Friends whose resolved Visibility currently grants the caller `open_time` — gates the "View calendar" action (issue #61). */
  calendarVisibleFriendIds: Set<string>;
};

/**
 * Everything `/booking-buddy/friends` needs: `listConnections`'s own three
 * lists, plus which friends grant the caller `open_time` Visibility.
 *
 * A dedicated function rather than composing `listConnections()` and a
 * separate visibility call one after the other: the profile lookup and the
 * `open_time_visible_owners` RPC are independent of each other once the
 * friends bucket's own ids are known — which happens right after grouping,
 * before profiles are even fetched — so running them via `Promise.all`
 * saves a full sequential round trip on every friends-page load.
 * `listConnections()` itself stays untouched (and un-slowed) for its other
 * caller, `getGroupsPageData`, which has no use for this RPC.
 */
export async function getFriendsPageData(): Promise<FriendsPageData> {
  const session = await verifySession();
  const supabase = await createClient();

  const grouped = await fetchGroupedConnections(session, supabase);
  const buckets = Object.values(grouped);
  const otherUserIds = buckets.flat().map((entry) => entry.otherUserId);
  const friendUserIds = grouped.friends.map((entry) => entry.otherUserId);

  if (otherUserIds.length === 0) {
    return { ...NO_CONNECTIONS, calendarVisibleFriendIds: new Set() };
  }

  const [profilesResult, visibleOwnersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", otherUserIds),
    friendUserIds.length > 0
      ? supabase.rpc("open_time_visible_owners", { owner_users: friendUserIds })
      : Promise.resolve({ data: [] as string[], error: null }),
  ]);

  if (profilesResult.error) {
    readFailed("who those connections are with", profilesResult.error);
  }
  if (visibleOwnersResult.error) {
    readFailed("who you can see the calendar of", visibleOwnersResult.error);
  }

  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );

  return {
    friends: peopleFromProfiles(grouped.friends, profileById),
    received: peopleFromProfiles(grouped.received, profileById),
    sent: peopleFromProfiles(grouped.sent, profileById),
    calendarVisibleFriendIds: new Set(
      (visibleOwnersResult.data ?? []) as string[],
    ),
  };
}

export type UserSearchResult = {
  id: string;
  display_name: string | null;
  /** Shown alongside the name, since two Users can share a display name. */
  username: string | null;
  connection_status: "pending" | "accepted" | null;
};

/**
 * Find Users to connect with.
 *
 * Goes through the `search_users` function rather than querying profiles,
 * because RLS hides the profile of anyone the caller isn't connected to —
 * see ADR 0004.
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  await verifySession();

  const trimmed = query.trim();
  // Matches the function's own floor: asking below it always returns nothing,
  // so there is no point in the round trip.
  if (trimmed.length < 3) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_users", {
    query: trimmed,
  });

  if (error) {
    // Deliberately not an empty list. Returning one would render as "nobody
    // matches that", which is indistinguishable from a working search — a
    // missing `search_users` function looked exactly like an unpopular name.
    // Throwing surfaces it as an error state in the caller's useQuery instead.
    console.error("booking-buddy: search_users failed", error);
    throw new Error("User search failed");
  }

  return (data ?? []) as UserSearchResult[];
}

export async function sendConnectionRequest(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const addresseeId = String(formData.get("addressee_id") ?? "");

  if (!addresseeId) {
    return { error: "Pick someone to send a request to." };
  }

  if (addresseeId === session.userId) {
    return { error: "You can't send yourself a friend request." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("connections")
    .insert({ requester_id: session.userId, addressee_id: addresseeId });

  if (error) {
    // The unique index covers the pair in both directions, so this also fires
    // when the other person has already asked you.
    if (error.code === "23505") {
      return { error: "You already have a request with this person." };
    }
    return { error: "Couldn't send that request. Try again." };
  }

  revalidatePath(FRIENDS_PATH);
  return { ok: true };
}

/**
 * Accept a request. Only the addressee can — the RLS update policy enforces
 * it, so a requester accepting their own request fails at the database rather
 * than relying on this check alone.
 */
export async function acceptConnectionRequest(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const connectionId = String(formData.get("connection_id") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("status", "pending")
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't accept that request." };
  }

  // `bb_first_friend` (#179) — fired after the response only if this is the
  // accepter's first accepted Connection. The requester's own first-friend
  // moment isn't tracked; see the ADR.
  after(() => trackFirstFriend(session.userId));

  revalidatePath(FRIENDS_PATH);
  return { ok: true };
}

/**
 * Decline a request, or remove an existing friend — the same act either way,
 * so one action covers both. Either party may do it.
 */
export async function removeConnection(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const connectionId = String(formData.get("connection_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("id", connectionId);

  if (error) {
    return { error: "Couldn't do that. Try again." };
  }

  revalidatePath(FRIENDS_PATH);
  return { ok: true };
}
