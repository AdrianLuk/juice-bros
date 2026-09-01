import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "./supabase/server.ts";
import { getSession, type LoadedSession } from "./sessions.ts";

/**
 * On Deck's Volunteer Link (issue #248).
 *
 * A Volunteer holds no account — they open a per-Session URL whose path carries
 * a bearer token. This module is the boundary: `loadVolunteerSession` checks
 * the token against the Session (via the SECURITY DEFINER
 * `on_deck_check_volunteer_token`, since `anon` cannot read `volunteer_token`
 * directly) and only then loads the board. The token stops working the moment
 * the Session closes or its Floor Mode drops volunteers — the check function
 * enforces both.
 *
 * The volunteer surface reuses the same anon Supabase client as the Player
 * surfaces: an open Session and its event log are world-readable (ADR 0006), so
 * rendering the floor needs no elevated access — only *appending* an event
 * does, and that goes through `on_deck_volunteer_append`.
 */

/** A link token has to be at least this long to be worth checking. */
const MIN_TOKEN_LENGTH = 24;

/**
 * The folded Session behind a valid Volunteer Link, or null when the token is
 * wrong, the Session has closed, or its Floor Mode no longer admits volunteers.
 */
export async function loadVolunteerSession(
  sessionId: string,
  token: string,
): Promise<LoadedSession | null> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < MIN_TOKEN_LENGTH) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("on_deck_check_volunteer_token", {
    p_session_id: sessionId,
    p_token: trimmed,
  });

  if (error || data !== true) {
    return null;
  }

  return getSession(supabase, sessionId).catch(() => null);
}

/**
 * The open Session's Volunteer Link token, for the Organizer to view and copy.
 * The caller must pass an authenticated client — RLS scopes `on_deck_sessions`
 * to the owning Organizer, and the column grant withholds `volunteer_token`
 * from `anon`.
 */
export async function getVolunteerToken(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("on_deck_sessions")
    .select("volunteer_token")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`loading the Volunteer Link failed: ${error.message}`);
  }

  return (data as { volunteer_token: string } | null)?.volunteer_token ?? null;
}
