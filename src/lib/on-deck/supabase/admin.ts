import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { readPublicSupabaseEnv, requireSupabaseServiceRoleKey } from "../env.ts";

/**
 * Supabase client with the `service_role` key — bypasses Row Level Security
 * entirely. Scoped to the turn-notification send job (issue #260): it reads
 * every opted-in Player's `on_deck_push_subscriptions` row for a Session,
 * writes the `on_deck_turn_notification_sends` idempotency log, and prunes a
 * subscription the push service reports as gone. No single Player's grant
 * covers reading across a whole roster.
 *
 * Built per call, like `supabase/server.ts`'s `createClient()` — no session to
 * leak, and no reason to hold a service-role client alive as a singleton.
 */
export function createAdminClient() {
  const { url } = readPublicSupabaseEnv();
  const serviceRoleKey = requireSupabaseServiceRoleKey();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
