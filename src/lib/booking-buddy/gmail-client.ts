import "server-only";

import {
  readGmailApiBaseUrl,
  requireGoogleOAuthClientId,
  requireGoogleOAuthClientSecret,
} from "./env.ts";

/**
 * Thin HTTP wrappers around Google's OAuth flow and the Gmail API for issue
 * #62's Mailbox Link and issue #64's "Sync from Email" — the authorize
 * redirect, the code-for-tokens exchange, the refresh-token exchange the
 * sync flow runs on every click (a Mailbox Link never keeps a live access
 * token around — see ADR-0009), the userinfo lookup used to show which
 * Google account got connected, and the message search/fetch the sync flow
 * reads CourtReserve mail through. No `googleapis` npm dependency, same
 * posture `google-places-client.ts` established for Places.
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
const DEFAULT_GMAIL_API_URL = "https://www.googleapis.com/gmail/v1";

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

function gmailApiUrl(): string {
  const base = readGmailApiBaseUrl();
  return base ? `${base}/gmail/v1` : DEFAULT_GMAIL_API_URL;
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

export type RefreshOutcome =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "invalid_grant" }
  | { ok: false; reason: "unreachable" };

/**
 * Trades a stored refresh token for a fresh access token — run on every
 * "Sync from Email" click (issue #64), since a Mailbox Link never keeps a
 * live access token around between syncs. `invalid_grant` is Google's own
 * error code for a dead/revoked refresh token, most commonly ADR-0009's own
 * 7-day Testing-mode expiry — distinguished from a generic `unreachable` so
 * the caller can tell "reconnect Gmail" apart from "Google had a bad
 * minute," which `TokenExchangeOutcome` above has no need to (a fresh
 * `authorization_code` exchange is never itself an expired-token situation).
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const response = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: requireGoogleOAuthClientId(),
        client_secret: requireGoogleOAuthClientSecret(),
        grant_type: "refresh_token",
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await safeText(response);
      if (body.includes("invalid_grant")) {
        return { ok: false, reason: "invalid_grant" };
      }
      console.error("booking-buddy: Gmail token refresh failed", response.status, body);
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    const accessToken =
      typeof json === "object" && json !== null && "access_token" in json
        ? (json as { access_token?: unknown }).access_token
        : undefined;

    if (typeof accessToken !== "string") {
      console.error("booking-buddy: Gmail token refresh returned no access_token");
      return { ok: false, reason: "unreachable" };
    }

    return { ok: true, accessToken };
  } catch (error) {
    console.error("booking-buddy: Gmail token refresh unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}

export type SearchOutcome =
  | { ok: true; messageIds: string[] }
  | { ok: false; reason: "unreachable" };

/**
 * `users.messages.list` scoped by `query` (built by
 * `buildCourtReserveSearchQuery`) — ids only; each one still needs its own
 * `fetchGmailMessage` call for the actual subject/body. Not paginated: the
 * query is already bounded to a fixed 90-day window
 * (`COURTRESERVE_SEARCH_WINDOW_DAYS`), which one page comfortably covers for
 * a hobby-app inbox — worth revisiting only if a real sync ever needs it.
 */
export async function searchGmailMessages(accessToken: string, query: string): Promise<SearchOutcome> {
  try {
    const url = new URL(`${gmailApiUrl()}/users/me/messages`);
    url.searchParams.set("q", query);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "booking-buddy: Gmail message search failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    const messages =
      typeof json === "object" && json !== null && "messages" in json
        ? (json as { messages?: unknown }).messages
        : undefined;

    if (!Array.isArray(messages)) {
      // No `messages` key at all is Gmail's normal shape for zero results,
      // not a failure.
      return { ok: true, messageIds: [] };
    }

    const messageIds = messages
      .map((entry) => (typeof entry === "object" && entry !== null ? (entry as { id?: unknown }).id : undefined))
      .filter((id): id is string => typeof id === "string");

    return { ok: true, messageIds };
  } catch (error) {
    console.error("booking-buddy: Gmail message search unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

/** Depth-first search for the HTML part of a (possibly multipart) message payload. */
function findHtmlPart(part: GmailMessagePart | undefined): string | null {
  if (!part) {
    return null;
  }

  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }

  for (const child of part.parts ?? []) {
    const found = findHtmlPart(child);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

export type FetchMessageOutcome =
  | { ok: true; email: { subject: string; html: string } }
  | { ok: false; reason: "unreachable" };

/**
 * `users.messages.get` for one message id, reduced to what
 * `parseCourtReserveEmail` needs: the Subject header and the HTML body (a
 * real CourtReserve email is multipart, so this walks `payload.parts` for
 * the `text/html` one rather than assuming it's the top-level body). No
 * `text/html` part found (a stray plain-text-only message matching the
 * sender search) comes back as an empty body rather than a failure —
 * `parseCourtReserveEmail` already treats that as `unparseable`, the same
 * "never throws" posture it holds for every other malformed-body case.
 */
export async function fetchGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<FetchMessageOutcome> {
  try {
    const url = new URL(`${gmailApiUrl()}/users/me/messages/${encodeURIComponent(messageId)}`);
    url.searchParams.set("format", "full");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "booking-buddy: fetching a Gmail message failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json = (await response.json()) as {
      payload?: { headers?: { name?: string; value?: string }[] } & GmailMessagePart;
    };

    const subject =
      json.payload?.headers?.find((header) => header.name?.toLowerCase() === "subject")?.value ?? "";
    const html = findHtmlPart(json.payload) ?? "";

    return { ok: true, email: { subject, html } };
  } catch (error) {
    console.error("booking-buddy: fetching a Gmail message unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}
