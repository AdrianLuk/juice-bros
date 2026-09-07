import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { siteConfig } from "@/config/site";
import { readPublicSupabaseEnv } from "@/lib/booking-buddy/env";
import { requiresSession, SIGN_IN_PATH } from "@/lib/booking-buddy/routes";
import {
  ON_DECK_SIGN_IN_PATH,
  requiresOrganizerSession,
} from "@/lib/on-deck/routes";

// The Vercel project answers on both juicebrospickleball.com and
// www.juicebrospickleball.com (both are attached to the domain in Vercel), so
// www serves every page as its own live 200 rather than redirecting. Google
// dutifully crawled it, saw the canonical tag pointing at the apex, and
// reported it as "Alternate page with proper canonical tag" - correct
// behavior, but wasted crawl budget on a duplicate a real redirect avoids
// entirely. Send www to the apex before anything else runs.
const CANONICAL_HOST = new URL(siteConfig.url).host;
const WWW_HOST = `www.${CANONICAL_HOST}`;

// The Supabase refresh/gate below is scoped to Booking Buddy and On Deck's
// own subtrees, matching the old matcher exactly - the marketing/podcast
// pages have no backend and must stay that way (see the matcher comment
// below). Now that the matcher is site-wide (to catch the www redirect on
// every path), this check keeps that scoping in the function body instead.
const SUPABASE_SCOPED_PREFIXES = ["/booking-buddy", "/on-deck/home", "/on-deck/dev"];

function needsSupabaseRefresh(pathname: string) {
  return SUPABASE_SCOPED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Runs before every route. Two jobs, in order: send www to the apex domain,
 * then - for Booking Buddy and On Deck routes only - refresh the Supabase
 * session so tokens can be written back to the response (Server Components
 * cannot set cookies) and bounce signed-out visitors off the auth-gated
 * routes.
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
  if (request.headers.get("host") === WWW_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    url.host = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  if (!needsSupabaseRefresh(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

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
 * Site-wide except static assets, so the www redirect above catches every
 * path. The Supabase refresh/gate stays scoped in the function body via
 * `needsSupabaseRefresh` - the marketing and podcast pages have no backend
 * and must not be pulled onto Supabase.
 *
 * That scope mirrors the old matcher exactly: Booking Buddy's whole subtree
 * (its root path branches on the session and every nested route is gated),
 * and On Deck's Organizer surface plus dev console (issue #351) — both need a
 * fresh Organizer session — but not its `/on-deck` landing page (pure
 * marketing) or the Player/Volunteer surfaces beneath `/on-deck/c` and
 * `/on-deck/session`, which are deliberately open (ADR 0005). The dev console
 * is not in `requiresOrganizerSession`: it 404s without its key rather than
 * redirecting.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
