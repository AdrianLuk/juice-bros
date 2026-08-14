"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";

const FRIENDS_PATH = "/booking-buddy/friends";

export type ActionResult = { error?: string; ok?: boolean };

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
    return [];
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
