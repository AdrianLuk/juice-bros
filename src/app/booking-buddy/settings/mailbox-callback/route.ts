import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { verifySession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import {
  MAILBOX_OAUTH_STATE_COOKIE,
  parseMailboxOAuthState,
} from "@/lib/booking-buddy/mailbox-oauth";
import { isGmailConnectAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import { readEmailSyncAllowlist, requireMailboxLinkEncryptionKey } from "@/lib/booking-buddy/env";
import { mailAdapterFor } from "@/lib/booking-buddy/mail-adapters";
import { encryptRefreshToken } from "@/lib/booking-buddy/token-encryption";
import { createClient } from "@/lib/booking-buddy/supabase/server";
import { SETTINGS_PATH } from "@/lib/booking-buddy/routes";

/**
 * Where a mailbox provider's consent screen lands after "Connect Gmail" /
 * "Connect Outlook" (spec #280) — a Route Handler rather than a Server Action
 * because it's a redirect target with query params to read, not a form
 * submission. Distinct from `.../auth/callback`: that one is Supabase's own
 * sign-in callback; this one writes a Mailbox Link and never touches Supabase
 * Auth or session cookies.
 *
 * One route for every provider. Which one's consent this is comes off the
 * round-tripped `state` (`"<provider>:<nonce>"` — see `mailbox-oauth.ts`),
 * which is also the CSRF nonce: the cookie set before the redirect has to
 * match the `state` echoed back verbatim.
 */
export async function GET(request: NextRequest) {
  const session = await verifySession();

  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(MAILBOX_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(MAILBOX_OAUTH_STATE_COOKIE);

  const parsedState = parseMailboxOAuthState(state ?? undefined);

  if (!code || !state || !expectedState || state !== expectedState || !parsedState) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=mailbox_connect_failed`, origin));
  }

  const { provider } = parsedState;

  // Authoritative re-check (ADR-0009's addendum): the allowlist is Gmail-only
  // (spec #280). `connectMailbox` already checked it before starting the
  // redirect, but a User removed from the allowlist mid-flow, or a callback URL
  // replayed by hand, must not still be able to complete a Gmail connection.
  // Microsoft has no allowlist — its consumer identity platform has no
  // equivalent of Google's capped Testing mode.
  if (provider === "google") {
    const profile = await getOwnProfile();
    if (!isGmailConnectAllowed(profile.username, session.email, readEmailSyncAllowlist())) {
      return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=email_sync_not_allowed`, origin));
    }
  }

  const adapter = mailAdapterFor(provider);

  // Both providers register this exact redirect URI.
  const redirectUri = `${origin}/booking-buddy/settings/mailbox-callback`;

  const tokenOutcome = await adapter.exchangeCodeForTokens(code, redirectUri);
  if (!tokenOutcome.ok) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=mailbox_connect_failed`, origin));
  }

  // Microsoft's token response already carries the account email (the
  // `id_token` `email` claim); Google's doesn't, so fall back to its own
  // userinfo lookup.
  let accountEmail = tokenOutcome.accountEmail;
  if (!accountEmail) {
    const accountOutcome = await adapter.resolveAccountEmail(tokenOutcome.accessToken);
    if (!accountOutcome.ok) {
      return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=mailbox_connect_failed`, origin));
    }
    accountEmail = accountOutcome.email;
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
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=mailbox_connect_failed`, origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mailbox_links").upsert(
    {
      owner_id: session.userId,
      provider,
      account_email: accountEmail,
      encrypted_refresh_token: encryptedRefreshToken,
      status: "active",
      connected_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  if (error) {
    console.error("booking-buddy: writing Mailbox Link failed", error);
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?error=mailbox_connect_failed`, origin));
  }

  return NextResponse.redirect(new URL(`${SETTINGS_PATH}?mailbox_connected=1`, origin));
}
