import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for Match Mixer's Live Mixer pages and Server Actions.
 * Holds only the anon key: a link's token is the credential, checked by the
 * database functions. Created per request, never a module-level singleton.
 */
export async function createClient() {
  const { url, anonKey } = readPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies.
        }
      },
    },
  });
}
