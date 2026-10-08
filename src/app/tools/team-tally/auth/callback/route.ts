import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/team-tally/supabase/server";
import { TEAM_TALLY_SIGN_IN_PATH, safeRedirectTarget } from "@/lib/team-tally/routes";

/**
 * Where Team Tally's emailed sign-in links land: the one-time `code` is
 * exchanged for a session (a Route Handler may write the cookies), then the
 * Organizer goes on to where they were headed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // `next` is off the URL, so it is sanitised rather than trusted.
  const next = safeRedirectTarget(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(`${TEAM_TALLY_SIGN_IN_PATH}?error=missing_code`, origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`${TEAM_TALLY_SIGN_IN_PATH}?error=link_invalid`, origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
