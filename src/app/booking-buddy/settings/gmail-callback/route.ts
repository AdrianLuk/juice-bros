import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { verifySession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { GMAIL_OAUTH_STATE_COOKIE } from "@/lib/booking-buddy/gmail-oauth";
import { isEmailSyncAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import { readEmailSyncAllowlist, requireMailboxLinkEncryptionKey } from "@/lib/booking-buddy/env";
import { exchangeCodeForTokens, fetchGoogleAccountEmail } from "@/lib/booking-buddy/gmail-client";
import { encryptRefreshToken } from "@/lib/booking-buddy/token-encryption";
import { createClient } from "@/lib/booking-buddy/supabase/server";
import { SETTINGS_PATH } from "@/lib/booking-buddy/routes";

/**
 * Where Google's Gmail consent screen lands after "Connect Gmail" (issue
 * #62) — a Route Handler rather than a Server Action because it's a redirect
 * target with query params to read, not a form submission. Distinct from
 * `.../auth/callback`: that one is Supabase's own sign-in callback, this one
 * writes a Mailbox Link and never touches Supabase Auth or session cookies.
 */
export async function GET(request: NextRequest) {
  const session = await verifySession();

  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GMAIL_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GMAIL_OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=gmail_connect_failed`, origin));
  }

  // Authoritative re-check (ADR-0009's addendum): connectGmail already
  // checked this before starting the redirect, but a User removed from the
  // allowlist mid-flow, or a callback URL replayed by hand, must not still
  // be able to complete a connection.
  const profile = await getOwnProfile();
  if (!isEmailSyncAllowed(profile.username, session.email, readEmailSyncAllowlist())) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=email_sync_not_allowed`, origin));
  }

  const redirectUri = `${origin}/booking-buddy/settings/gmail-callback`;

  const tokenOutcome = await exchangeCodeForTokens(code, redirectUri);
  if (!tokenOutcome.ok) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=gmail_connect_failed`, origin));
  }

  const accountOutcome = await fetchGoogleAccountEmail(tokenOutcome.accessToken);
  if (!accountOutcome.ok) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=gmail_connect_failed`, origin));
  }

  // `requireMailboxLinkEncryptionKey` throws if unset — a plausible
  // partial-deploy state (see PROGRESS.md's own note that this isn't set on
  // Vercel yet). Caught here so a misconfigured key reports the same
  // "couldn't connect" redirect every other failure in this route uses,
  // instead of an uncaught 500.
  let encryptedRefreshToken: string;
  try {
    encryptedRefreshToken = encryptRefreshToken(
      tokenOutcome.refreshToken,
      requireMailboxLinkEncryptionKey(),
    );
  } catch (error) {
    console.error("booking-buddy: Mailbox Link encryption key missing or invalid", error);
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=gmail_connect_failed`, origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mailbox_links").upsert(
    {
      owner_id: session.userId,
      google_account_email: accountOutcome.email,
      encrypted_refresh_token: encryptedRefreshToken,
      status: "active",
      connected_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  if (error) {
    console.error("booking-buddy: writing Mailbox Link failed", error);
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=gmail_connect_failed`, origin));
  }

  return NextResponse.redirect(new URL(`${SETTINGS_PATH}?gmail_connected=1`, origin));
}
