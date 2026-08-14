import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readPublicSupabaseEnv } from "@/lib/booking-buddy/env";
import { requiresSession, SIGN_IN_PATH } from "@/lib/booking-buddy/routes";

/**
 * Runs before Booking Buddy routes render.
 *
 * Two jobs: refresh the Supabase session so tokens can be written back to the
 * response (Server Components cannot set cookies), and bounce signed-out
 * visitors to sign-in.
 *
 * This is an *optimistic* check only — Next.js is explicit that the proxy must
 * not be the sole line of defence. The real check is `verifySession` in the
 * Data Access Layer, with coarse RLS beneath it per ADR 0003.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const { url, anonKey } = readPublicSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the token and, via setAll above, persists it onto the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && requiresSession(request.nextUrl.pathname)) {
    const signInUrl = new URL(SIGN_IN_PATH, request.nextUrl.origin);
    // So sign-in can send them back where they were headed.
    signInUrl.searchParams.set("next", request.nextUrl.pathname);

    return NextResponse.redirect(signInUrl);
  }

  return response;
}

/**
 * Scoped to Booking Buddy rather than the whole site: the marketing and
 * podcast pages have no backend and must not be pulled onto Supabase, so
 * there is no session for the proxy to refresh there.
 */
export const config = {
  matcher: ["/booking-buddy/:path*"],
};
