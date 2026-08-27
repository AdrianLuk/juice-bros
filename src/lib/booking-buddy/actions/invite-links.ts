"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { absoluteAppUrl } from "../request-origin.ts";
import { BOOKING_BUDDY_ROOT, FRIENDS_PATH, SIGN_IN_PATH, joinPath } from "../routes.ts";
import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE_SECONDS,
  parseInviteToken,
  type InviteRelation,
} from "../invite-links.ts";
import { readFailed, type ActionResult } from "./result.ts";

export type { ActionResult } from "./result.ts";

export type InviteLinkOwner = {
  id: string;
  displayName: string | null;
  username: string | null;
};

/**
 * Resolve who a join link belongs to — name and handle only. Runs the
 * `invite_link_owner` definer function rather than reading `profiles`
 * directly, because the visitor is usually signed out and RLS would hide
 * every profile from them (ADR 0004's shape). `null` for an unknown or
 * rotated-away token, which the join page renders as "this invite isn't
 * valid".
 */
export async function getInviteLinkOwner(
  token: string,
): Promise<InviteLinkOwner | null> {
  const parsed = parseInviteToken(token);
  if (!parsed) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_link_owner", {
    token: parsed,
  });

  if (error) {
    console.error("booking-buddy: reading an invite link owner failed", error);
    throw new Error("Could not read this invite link");
  }

  const row = (
    data as
      | { id: string; display_name: string | null; username: string | null }[]
      | null
  )?.[0];

  return row
    ? { id: row.id, displayName: row.display_name, username: row.username }
    : null;
}

/**
 * How the signed-in caller already relates to `ownerId` — what the join page
 * needs to decide between "send a request" and a friendly no-op line.
 */
export async function getInviteRelation(
  ownerId: string,
): Promise<InviteRelation> {
  const session = await verifySession();
  if (session.userId === ownerId) {
    return "self";
  }

  const supabase = await createClient();
  // Scoped to the one pair — RLS already limits the table to the caller's own
  // Connections, and this narrows it to the row (if any) that involves the
  // owner. `connections_unique_pair` guarantees at most one.
  const { data: row, error } = await supabase
    .from("connections")
    .select("status, requester_id, addressee_id")
    .or(`requester_id.eq.${ownerId},addressee_id.eq.${ownerId}`)
    .maybeSingle();

  if (error) {
    readFailed("your connections", error);
  }

  if (!row) {
    return "none";
  }
  if (row.status === "accepted") {
    return "connected";
  }
  return row.requester_id === session.userId ? "request-sent" : "request-received";
}

/**
 * The signed-in caller's own personal invite link, absolute — or `null` if it
 * can't be read.
 *
 * Deliberately soft, unlike the other reads here: the invite panel is an
 * affordance, not data the User would be misled by its absence. Returning
 * `null` (rather than throwing through the error boundary) keeps the Friends
 * page and dashboard rendering if this code ever ships ahead of its
 * migration, or on a transient read blip.
 */
export async function getOwnInviteUrl(): Promise<string | null> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("invite_token")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !data?.invite_token) {
    console.error("booking-buddy: reading your invite link failed", error);
    return null;
  }

  return absoluteAppUrl(joinPath(data.invite_token));
}

/**
 * Stash the invite token in a short-lived cookie and send the visitor into
 * the normal sign-in flow. `consumeInviteCookie` picks it up on the far side
 * — carried this way rather than in `?next=`, which only accepts gated
 * Booking Buddy paths and would drop a public `/join` target anyway.
 */
export async function startInviteSignIn(formData: FormData): Promise<void> {
  const token = parseInviteToken(String(formData.get("token") ?? ""));

  if (token) {
    (await cookies()).set(INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  redirect(SIGN_IN_PATH);
}

export type RotateInviteResult = ActionResult & { url?: string };

/**
 * Rotate the caller's invite token, killing the old URL. Hands the fresh
 * link straight back so `InviteLinkPanel` can show it without waiting on a
 * revalidated prop.
 *
 * Takes no arguments — `useActionState` calls it with `(prevState, formData)`
 * and both are ignored, since a rotation carries no input.
 */
export async function rotateInviteToken(): Promise<RotateInviteResult> {
  await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rotate_invite_token");

  if (error || typeof data !== "string") {
    console.error("booking-buddy: rotating an invite token failed", error);
    return { error: "Couldn't reset your invite link. Try again." };
  }

  // The panel renders on both surfaces — the Friends page and the onboarding
  // modal on the dashboard — so both server renders need the fresh token.
  revalidatePath(FRIENDS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true, url: await absoluteAppUrl(joinPath(data)) };
}
