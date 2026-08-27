import { after, NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/booking-buddy/supabase/server";
import { trackSignupOnce } from "@/lib/booking-buddy/analytics";
import { consumeInviteCookie } from "@/lib/booking-buddy/invite-connection";
import { safeRedirectTarget, SIGN_IN_PATH } from "@/lib/booking-buddy/routes";

/**
 * Where magic-link and OAuth sign-ins land.
 *
 * Supabase sends the User back here with a one-time `code`, which is exchanged
 * for a session. The exchange writes cookies, which a Route Handler is allowed
 * to do (a Server Component is not).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // `next` is attacker-controllable, so it is sanitised rather than trusted.
  const next = safeRedirectTarget(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL(`${SIGN_IN_PATH}?error=missing_code`, origin),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Most often an expired or already-used link.
    return NextResponse.redirect(
      new URL(`${SIGN_IN_PATH}?error=link_invalid`, origin),
    );
  }

  // Magic-link and OAuth sign-ins both land here; `trackSignupOnce` fires
  // `bb_signup` only on the first authenticated session per account (#179).
  const userId = data.user?.id;
  if (userId) {
    // A join link that was opened signed-out routes through here after
    // sign-in/sign-up; turn the stashed token into a pending friend request
    // (issue #175). Inline, not in `after()` — it clears the invite cookie.
    await consumeInviteCookie(supabase, userId);
    after(() => trackSignupOnce(userId));
  }

  return NextResponse.redirect(new URL(next, origin));
}
