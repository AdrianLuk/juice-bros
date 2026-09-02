import { createBrowserClient } from "@supabase/ssr";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for On Deck's Client Components.
 *
 * Holds only the anon key, so every query and every Realtime channel it opens
 * is subject to Row Level Security. On Deck uses it for one thing: the
 * Realtime subscription to `on_deck_session_events` inserts (issue #252), which
 * nudges the live surfaces to re-fetch within ~1s instead of waiting out the
 * poll. Reads and writes still go through Server Actions — a device token is a
 * Player's whole identity (ADR 0001) and must never reach the browser.
 *
 * On Deck reads its own env rather than Booking Buddy's helper, the same
 * deliberate duplication as `supabase/server.ts` — the two contexts share the
 * Supabase project and nothing else (CONTEXT-MAP.md).
 */
export function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();

  return createBrowserClient(url, anonKey);
}
