import "server-only";

import { after } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { INVITE_COOKIE, parseInviteToken } from "./invite-links.ts";
import { notifyNewConnectionRequest } from "./connection-request-notify.ts";

/**
 * Turning a held invite token into a pending friend request, shared by the
 * two paths that do it: the signed-in visitor who opens a join link and taps
 * "connect", and `consumeInviteCookie` running right after a signup that
 * came through one.
 *
 * Always a *pending* request back to the token's owner — a link never
 * creates an accepted Connection silently (CONTEXT.md, issue #175). Reuses
 * the same `connections` insert the Friends page uses, so its duplicate-pair
 * guard (`connections_unique_pair`) still applies: opening a link you're
 * already connected through, or have a pending request with, is a no-op, not
 * a second row.
 */
export type InviteConnectionOutcome =
  | "requested"
  | "already-linked"
  | "self"
  | "invalid-token"
  | "failed";

export async function createInviteConnection(
  supabase: SupabaseClient,
  requesterId: string,
  token: string,
): Promise<InviteConnectionOutcome> {
  const { data, error: ownerError } = await supabase.rpc("invite_link_owner", {
    token,
  });

  if (ownerError) {
    console.error("booking-buddy: resolving an invite link owner failed", ownerError);
    return "failed";
  }

  const ownerId = (data as { id: string }[] | null)?.[0]?.id;
  if (!ownerId) {
    return "invalid-token";
  }
  if (ownerId === requesterId) {
    return "self";
  }

  const { data: created, error } = await supabase
    .from("connections")
    .insert({ requester_id: requesterId, addressee_id: ownerId })
    .select("id")
    .single();

  if (!error) {
    // Email the link owner so they can accept from their inbox (#228) — the
    // same notification the Friends-page request path sends. Best-effort,
    // after the response.
    after(() => notifyNewConnectionRequest(created.id));
    return "requested";
  }

  // `connections_unique_pair` covers the pair in both directions, so a 23505
  // here means they already have a request or an accepted Connection — the
  // friendly no-op the ticket calls for, not a failure.
  if (error.code === "23505") {
    return "already-linked";
  }

  console.error("booking-buddy: auto-creating an invite friend request failed", error);
  return "failed";
}

/**
 * Read the invite cookie set when a signed-out visitor opened a join link,
 * clear it, and — if it carried a real token — create the pending friend
 * request back to its owner for the User who just authenticated.
 *
 * Called from every first authenticated entry point (the auth callback route
 * and the password / Google / sign-up actions), so the token survives a
 * magic-link or OAuth round trip. Best-effort: a signup must never fail
 * because the friend request couldn't be created.
 */
export async function consumeInviteCookie(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(INVITE_COOKIE)?.value;

  if (raw === undefined) {
    return;
  }

  // Clear it whatever happens — it's single-use, and a stale token shouldn't
  // outlive this sign-in.
  jar.delete(INVITE_COOKIE);

  const token = parseInviteToken(raw);
  if (!token) {
    return;
  }

  await createInviteConnection(supabase, userId, token);
}
