import "server-only";

import {
  readGmailApiBaseUrl,
  requireGoogleOAuthClientId,
  requireGoogleOAuthClientSecret,
} from "./env.ts";

/**
 * Thin HTTP wrappers around Google's OAuth flow for issue #62's Mailbox Link
 * — the authorize redirect, the code-for-tokens exchange, and the userinfo
 * lookup used to show which Google account got connected. No `googleapis`
 * npm dependency, same posture `google-places-client.ts` established for
 * Places.
 *
 * Deliberately not unit tested: it's glue over real network calls (and, for
 * the authorize step, a real browser redirect), which is what Playwright's
 * mocked Gmail server (`e2e/support/gmail-mock.ts`) exists to exercise
 * instead, per the seam note in PROGRESS.md.
 */

const FETCH_TIMEOUT_MS = 8000;

const DEFAULT_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

// The mock collapses Google's three real hosts onto one local server, so
// each real default gets its own path there instead of its own host.
function authorizeUrl(): string {
  const base = readGmailApiBaseUrl();
  return base ? `${base}/authorize` : DEFAULT_AUTHORIZE_URL;
}

function tokenUrl(): string {
  const base = readGmailApiBaseUrl();
  return base ? `${base}/token` : DEFAULT_TOKEN_URL;
}

function userinfoUrl(): string {
  const base = readGmailApiBaseUrl();
  return base ? `${base}/userinfo` : DEFAULT_USERINFO_URL;
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Where "Connect Gmail" sends the browser. `prompt=consent` forces Google to
 * hand back a `refresh_token` even on a repeat authorization — without it, a
 * second consent for the same account/scope pair can come back with no
 * refresh token at all, which is useless for a feature that syncs later,
 * unattended.
 */
export function buildGoogleAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireGoogleOAuthClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `${GMAIL_READONLY_SCOPE} ${USERINFO_EMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${authorizeUrl()}?${params.toString()}`;
}

export type TokenExchangeOutcome =
  | { ok: true; refreshToken: string; accessToken: string }
  | { ok: false; reason: "unreachable" };

/**
 * The authorization-code exchange the OAuth callback route runs once Google
 * redirects back with a `code`. `refresh_token` is only ever present when
 * Google actually grants one (see `prompt=consent` above); treating its
 * absence as `"unreachable"` is deliberate — a token response with no
 * refresh token is unusable for this feature either way.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TokenExchangeOutcome> {
  try {
    const response = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireGoogleOAuthClientId(),
        client_secret: requireGoogleOAuthClientSecret(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "booking-buddy: Gmail token exchange failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    const refreshToken =
      typeof json === "object" && json !== null && "refresh_token" in json
        ? (json as { refresh_token?: unknown }).refresh_token
        : undefined;
    const accessToken =
      typeof json === "object" && json !== null && "access_token" in json
        ? (json as { access_token?: unknown }).access_token
        : undefined;

    if (typeof refreshToken !== "string" || typeof accessToken !== "string") {
      console.error("booking-buddy: Gmail token exchange returned no refresh_token");
      return { ok: false, reason: "unreachable" };
    }

    return { ok: true, refreshToken, accessToken };
  } catch (error) {
    console.error("booking-buddy: Gmail token exchange unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}

export type GoogleAccountOutcome = { ok: true; email: string } | { ok: false; reason: "unreachable" };

/** Which Google account just got connected, shown back in Settings. */
export async function fetchGoogleAccountEmail(accessToken: string): Promise<GoogleAccountOutcome> {
  try {
    const response = await fetch(userinfoUrl(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "booking-buddy: Gmail userinfo lookup failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    const email =
      typeof json === "object" && json !== null && "email" in json
        ? (json as { email?: unknown }).email
        : undefined;

    if (typeof email !== "string" || !email) {
      console.error("booking-buddy: Gmail userinfo lookup returned no email");
      return { ok: false, reason: "unreachable" };
    }

    return { ok: true, email };
  } catch (error) {
    console.error("booking-buddy: Gmail userinfo lookup unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}
