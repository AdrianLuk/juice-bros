import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/on-deck/supabase/server";
import {
  ON_DECK_SIGN_IN_PATH,
  safeRedirectTarget,
} from "@/lib/on-deck/routes";

/**
 * Where On Deck's magic-link sign-ins land.
 *
 * Supabase sends the Organizer back here with a one-time `code`, which is
 * exchanged for a session. The exchange writes cookies, which a Route Handler
 * is allowed to do (a Server Component is not).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // `next` is attacker-controllable, so it is sanitised rather than trusted.
  const next = safeRedirectTarget(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL(`${ON_DECK_SIGN_IN_PATH}?error=missing_code`, origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Most often an expired or already-used link.
    return NextResponse.redirect(
      new URL(`${ON_DECK_SIGN_IN_PATH}?error=link_invalid`, origin),
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
