import { createBrowserClient } from "@supabase/ssr";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for Match Mixer's Client Components. Used for one thing:
 * the Realtime broadcast that says a Live Mixer changed (#688). Reads and
 * writes go through Server Actions, so a link's token never sits in a
 * browser-side query.
 */
export function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
