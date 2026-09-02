import "server-only";

import { createClient } from "./supabase/server.ts";
import { getSession, type LoadedSession } from "./sessions.ts";

/**
 * On Deck's courtside Kiosk (issue #259).
 *
 * The Kiosk holds no account and no token — it is a URL carrying only the
 * Session id, the same as the read-only Display. This module is the boundary:
 * `loadKioskSession` checks that the Session is open and its Floor Mode allows
 * the Kiosk (`self-serve` / `hybrid`) via the SECURITY DEFINER
 * `on_deck_check_kiosk_access`, and only then loads the board. Under
 * `volunteer-run` the Kiosk URL is inert.
 *
 * Like the volunteer surface, this reuses the anon Supabase client: an open
 * Session and its log are world-readable (ADR 0006), so rendering the board
 * needs no elevated access — only *appending* an event does, and that goes
 * through `on_deck_kiosk_append`.
 */
export async function loadKioskSession(
  sessionId: string,
): Promise<LoadedSession | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("on_deck_check_kiosk_access", {
    p_session_id: sessionId,
  });

  if (error || data !== true) {
    return null;
  }

  return getSession(supabase, sessionId).catch(() => null);
}
