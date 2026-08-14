import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readPublicSupabaseEnv } from "../env.ts";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Must be created per request — never hoisted to a module-level singleton, or
 * one visitor's session would leak into another's render.
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
          // Server Components cannot write cookies. Refreshed tokens are
          // persisted by the proxy instead, which runs before rendering and
          // can set them on the response.
        }
      },
    },
  });
}
