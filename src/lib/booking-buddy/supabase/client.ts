import { createBrowserClient } from "@supabase/ssr";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for use in Client Components.
 *
 * Only ever holds the anon key, so every query it makes is subject to Row
 * Level Security. Per ADR 0003, RLS is a coarse safety net — the nuanced
 * visibility rules live in Server Actions, so prefer those for anything
 * permission-sensitive rather than querying from the browser.
 */
export function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();

  return createBrowserClient(url, anonKey);
}
