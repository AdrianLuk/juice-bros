import { createBrowserClient } from "@supabase/ssr";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for Team Tally's Client Components. Used for one thing: the
 * Realtime broadcast that says a Team Event changed (issue #623). Reads and
 * writes go through Server Actions, so a Score Link token never has to sit in
 * a browser-side query.
 */
export function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
