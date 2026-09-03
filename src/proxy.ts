import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readPublicSupabaseEnv } from "@/lib/booking-buddy/env";
import { requiresSession, SIGN_IN_PATH } from "@/lib/booking-buddy/routes";
import {
  ON_DECK_SIGN_IN_PATH,
  requiresOrganizerSession,
} from "@/lib/on-deck/routes";

/**
 * Runs before Booking Buddy and On Deck routes render.
 *
 * Two jobs: refresh the Supabase session so tokens can be written back to the
 * response (Server Components cannot set cookies), and bounce signed-out
 * visitors off the auth-gated routes.
 *
 * This is an *optimistic* check only — Next.js is explicit that the proxy must
 * not be the sole line of defence. The real check is `verifySession` /
 * `verifyOrganizer` in each app's Data Access Layer, with coarse RLS beneath
 * it per ADR 0003.
 *
 * Both apps share the one Supabase project, so one refreshed session covers
 * them both; only the sign-in destination differs. On Deck gates far less —
 * just the Organizer surface; Players and Volunteers have no account (ADR
 * 0005) and everything they touch stays open.
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

  if (user) {
    return response;
  }

  const { pathname, origin } = request.nextUrl;

  const signInPath = requiresSession(pathname)
    ? SIGN_IN_PATH
    : requiresOrganizerSession(pathname)
      ? ON_DECK_SIGN_IN_PATH
      : null;

  if (signInPath) {
    const signInUrl = new URL(signInPath, origin);
    // So sign-in can send them back where they were headed.
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

/**
 * Scoped to the auth-gated routes rather than the whole site: the marketing
 * and podcast pages have no backend and must not be pulled onto Supabase.
 *
 * Booking Buddy matches its whole subtree (its root path branches on the
 * session and every nested route is gated). On Deck matches the Organizer
 * surface and the dev console (issue #351) — both need a fresh Organizer
 * session — but not its `/on-deck` landing page (pure marketing) or the
 * Player/Volunteer surfaces beneath `/on-deck/c` and `/on-deck/session`, which
 * are deliberately open (ADR 0005). The dev console is not in
 * `requiresOrganizerSession`: it 404s without its key rather than redirecting.
 */
export const config = {
  matcher: [
    "/booking-buddy/:path*",
    "/on-deck/home/:path*",
    "/on-deck/dev/:path*",
  ],
};
