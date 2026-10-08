import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for Team Tally's Server Components, Server Actions and Route
 * Handlers. Holds only the anon key, so every query runs under RLS as the
 * signed-in Organizer. Created per request, never a module-level singleton.
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
          // Server Components cannot write cookies. The proxy refreshes tokens
          // before rendering and sets them on the response instead.
        }
      },
    },
  });
}
