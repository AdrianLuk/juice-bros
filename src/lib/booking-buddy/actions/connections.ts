"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { FRIENDS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  groupConnections,
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

export type ConnectionLists = Record<keyof GroupedConnections, ConnectionPerson[]>;

const NO_CONNECTIONS: ConnectionLists = { friends: [], received: [], sent: [] };

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

  const { data: rows, error } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, status, created_at");

  if (error) {
    readFailed("your connections", error);
  }

  const grouped = groupConnections((rows ?? []) as ConnectionRow[], session.userId);
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

  // A *missing* row is different from a failed query and stays tolerated below:
  // RLS can legitimately hide a profile, and an unnamed friend beats a crash.
  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const withPeople = (entries: (typeof buckets)[number]): ConnectionPerson[] =>
    entries.map((entry) => {
      const profile = profileById.get(entry.otherUserId);
      return {
        connectionId: entry.connectionId,
        userId: entry.otherUserId,
        displayName: profile?.display_name ?? null,
        username: profile?.username ?? null,
      };
    });

  return {
    friends: withPeople(grouped.friends),
    received: withPeople(grouped.received),
    sent: withPeople(grouped.sent),
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
  const { data, error } = await supabase.rpc("search_users", { query: trimmed });

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
  await verifySession();
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
