import { createBrowserClient } from "@supabase/ssr";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for Mic Drop's Client Components. Used for one thing: the
 * Realtime broadcast that says a Poll changed (issue #670). Reads and Votes go
 * through Server Actions, so the Guest Link token never sits in a
 * browser-side query.
 */
export function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
