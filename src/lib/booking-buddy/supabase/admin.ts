import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseEnv, requireSupabaseServiceRoleKey } from "../env.ts";

/**
 * Supabase client with the `service_role` key — bypasses Row Level Security
 * entirely. Scoped to `place_cache` writes (ADR 0005): the cache is
 * server-written and read-only to Users, so filling and refreshing it is the
 * one thing in Booking Buddy this key is for.
 *
 * Built per call, like `supabase/server.ts`'s `createClient()`, though the
 * reason differs: there's no session to leak here, but there's also no reason
 * to hold a service-role client alive as a module-level singleton.
 */
export function createAdminClient() {
  const { url } = readPublicSupabaseEnv();
  const serviceRoleKey = requireSupabaseServiceRoleKey();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
