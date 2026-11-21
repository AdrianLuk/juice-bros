import { createBrowserClient } from "@supabase/ssr";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for DDD's Client Components. Used for one thing: the
 * Realtime broadcast that says a DDD changed (#715). Reads and writes go
 * through Server Actions, so a Score Link token never sits in a browser query.
 */
export function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
