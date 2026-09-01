import "server-only";

import {
  readMicrosoftApiBaseUrl,
  requireMicrosoftOAuthClientId,
  requireMicrosoftOAuthClientSecret,
} from "../env.ts";
import type {
  AccountEmailOutcome,
  MailAdapter,
  MailSearchCriteria,
  MailboxMessageOutcome,
  MailboxSearchOutcome,
  RefreshOutcome,
  TokenExchangeOutcome,
} from "../mail-adapter.ts";
import { buildGraphMessagesUrl, collectGraphMessageIds } from "./graph-query.ts";

/**
 * The Microsoft `MailAdapter` — the OAuth half of spec #280's Outlook /
 * Hotmail Mailbox Link. Thin HTTP wrappers around the Microsoft identity
 * platform's `consumers` endpoints (personal Microsoft accounts only:
 * outlook.com, hotmail.com, live.com, msn.com — work/school accounts are out
 * of scope), no `@azure/msal-*` dependency, same posture the Google adapter
 * holds for Gmail.
 *
 * What ships here (issue #283 — "Microsoft connect"):
 *
 * - `buildAuthorizeUrl` — the consent redirect, `offline_access Mail.Read
 *   openid email` scopes (read-only mailbox access, matching Gmail's
 *   `gmail.readonly`).
 * - `exchangeCodeForTokens` — the one-time auth-code exchange. Unlike Google,
 *   the connected account's address comes back *in this response*: the
 *   `id_token`'s `email` claim. The adapter decodes it here and returns it as
 *   `accountEmail`, so the callback route never needs a Graph `/me` call or a
 *   directory-read scope.
 * - `refreshAccessToken` — the refresh exchange. Microsoft **rotates** the
 *   refresh token on every call and the old one stops working, so this always
 *   returns the new one in `RefreshOutcome.refreshToken` for the shared
 *   token-lifecycle helper to persist.
 * - `searchMailbox` / `fetchMessage` (issue #284 — "Microsoft sync") — the
 *   Graph `/me/messages` list + get. Search formats its `$filter` and follows
 *   `@odata.nextLink` via `graph-query.ts` (unit tested there); it sends no
 *   `$orderby` (Graph defaults to newest-first, and combining `$orderby` with
 *   this `$filter` is rejected as "too complex"). Fetch requests the stored
 *   HTML body directly (`Prefer: outlook.body-content-type="html"`).
 *   A Graph `429` is a transient `unreachable` with no automatic retry —
 *   there's only one non-`ok` reason for these methods and the User's retry
 *   is the "Sync from Email" button.
 *
 * `resolveAccountEmail` still isn't needed — the connected account's address
 * comes back from `exchangeCodeForTokens` in the `id_token`, so the callback
 * route never calls it.
 *
 * Deliberately not unit tested: it's glue over real network calls, exercised
 * instead by Playwright's mocked Microsoft host (`e2e/support/microsoft-mock.ts`),
 * the same seam split the Google adapter documents.
 */

const FETCH_TIMEOUT_MS = 8000;

const DEFAULT_AUTHORITY = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const DEFAULT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

const OAUTH_SCOPE = "offline_access Mail.Read openid email";

// The mock collapses Microsoft's identity host onto one local server, so each
// real endpoint gets its own path there instead of the real path.
function authorizeUrl(): string {
  const base = readMicrosoftApiBaseUrl();
  return base ? `${base}/authorize` : `${DEFAULT_AUTHORITY}/authorize`;
}

function tokenUrl(): string {
  const base = readMicrosoftApiBaseUrl();
  return base ? `${base}/token` : `${DEFAULT_AUTHORITY}/token`;
}

// Graph lives on its own host in production; the e2e mock collapses it onto
// the same local server as the identity endpoints, under a `/v1.0` prefix
// that matches the real version segment.
function graphBaseUrl(): string {
  const base = readMicrosoftApiBaseUrl();
  return base ? `${base}/v1.0` : DEFAULT_GRAPH_BASE_URL;
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * The `email` address inside a token response's `id_token`, or `undefined` if
 * it isn't there. The `id_token` came straight back from Microsoft's own token
 * endpoint over TLS in this same server-to-server call, so its claims are
 * trusted without re-verifying the signature — the same trust already extended
 * to the `access_token` in the same response body. `preferred_username` is the
 * fallback: for a personal Microsoft account it's the account's email address.
 */
function accountEmailFromIdToken(idToken: unknown): string | undefined {
  if (typeof idToken !== "string") {
    return undefined;
  }

  const payloadSegment = idToken.split(".")[1];
  if (!payloadSegment) {
    return undefined;
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }

  if (typeof claims !== "object" || claims === null) {
    return undefined;
  }

  const record = claims as { email?: unknown; preferred_username?: unknown };
  if (typeof record.email === "string" && record.email.includes("@")) {
    return record.email;
  }
  if (typeof record.preferred_username === "string" && record.preferred_username.includes("@")) {
    return record.preferred_username;
  }
  return undefined;
}

/** Where "Connect Outlook" sends the browser. */
function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireMicrosoftOAuthClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: OAUTH_SCOPE,
    state,
  });

  return `${authorizeUrl()}?${params.toString()}`;
}

function readStringField(json: unknown, field: string): string | undefined {
  if (typeof json === "object" && json !== null && field in json) {
    const value = (json as Record<string, unknown>)[field];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/**
 * The authorization-code exchange the OAuth callback route runs once Microsoft
 * redirects back with a `code`. A response with no `access_token`/`refresh_token`
 * is unusable for a feature that syncs later unattended, so its absence is
 * reported as `"unreachable"` — the same call the Google adapter makes.
 */
async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TokenExchangeOutcome> {
  try {
    const response = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireMicrosoftOAuthClientId(),
        client_secret: requireMicrosoftOAuthClientSecret(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: OAUTH_SCOPE,
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "booking-buddy: Microsoft token exchange failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    const accessToken = readStringField(json, "access_token");
    const refreshToken = readStringField(json, "refresh_token");

    if (!accessToken || !refreshToken) {
      console.error("booking-buddy: Microsoft token exchange returned no refresh_token");
      return { ok: false, reason: "unreachable" };
    }

    return {
      ok: true,
      accessToken,
      refreshToken,
      accountEmail: accountEmailFromIdToken(readStringField(json, "id_token")),
    };
  } catch (error) {
    console.error("booking-buddy: Microsoft token exchange unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}

/**
 * Trades a stored refresh token for a fresh access token, run on every "Sync
 * from Email" click. Microsoft rotates the refresh token on every exchange —
 * the returned one replaces the stored one, and the shared token-lifecycle
 * helper persists it. `invalid_grant` is Microsoft's own code for a
 * dead/revoked refresh token, distinguished from a generic `unreachable` so
 * the caller can tell "reconnect Outlook" apart from "Microsoft had a bad
 * minute."
 */
async function refreshAccessToken(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const response = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: requireMicrosoftOAuthClientId(),
        client_secret: requireMicrosoftOAuthClientSecret(),
        grant_type: "refresh_token",
        scope: OAUTH_SCOPE,
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await safeText(response);
      if (body.includes("invalid_grant")) {
        return { ok: false, reason: "invalid_grant" };
      }
      console.error("booking-buddy: Microsoft token refresh failed", response.status, body);
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    const accessToken = readStringField(json, "access_token");
    if (!accessToken) {
      console.error("booking-buddy: Microsoft token refresh returned no access_token");
      return { ok: false, reason: "unreachable" };
    }

    return { ok: true, accessToken, refreshToken: readStringField(json, "refresh_token") };
  } catch (error) {
    console.error("booking-buddy: Microsoft token refresh unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}

/**
 * Not used for Microsoft — the connected account's email comes back from
 * `exchangeCodeForTokens` in the `id_token`, so the callback route never calls
 * this. Kept honouring the no-throw contract for the odd `provider =
 * 'microsoft'` row that somehow lacks a cached email.
 */
async function resolveAccountEmail(): Promise<AccountEmailOutcome> {
  return { ok: false, reason: "unreachable" };
}

/**
 * `GET /me/messages` scoped by the neutral criteria (formatted to Graph's
 * `$filter` / `$select` / `$top` by `graph-query.ts`) — ids only, in Graph's
 * default newest-first order, following `@odata.nextLink` up to a small fixed
 * page cap. Each id still needs its own `fetchMessage` call for subject/body.
 *
 * Any non-`ok` response on any page (a `429`, a `5xx`, a network error) ends
 * the search as `unreachable` with no retry — a partial list would let a
 * sync settle messages it never actually saw.
 */
async function searchMailbox(
  accessToken: string,
  criteria: MailSearchCriteria,
): Promise<MailboxSearchOutcome> {
  const firstUrl = buildGraphMessagesUrl(graphBaseUrl(), criteria);

  const collected = await collectGraphMessageIds(firstUrl, async (url) => {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        console.error(
          "booking-buddy: Graph message search failed",
          response.status,
          await safeText(response),
        );
        return null;
      }

      return (await response.json()) as unknown;
    } catch (error) {
      console.error("booking-buddy: Graph message search unreachable", error);
      return null;
    }
  });

  if (!collected.ok) {
    return { ok: false, reason: "unreachable" };
  }

  return { ok: true, messageIds: collected.ids };
}

type GraphMessage = {
  subject?: unknown;
  receivedDateTime?: unknown;
  body?: { contentType?: unknown; content?: unknown };
};

/**
 * `GET /me/messages/{id}` for one message, reduced to what
 * `parseCourtReserveEmail` needs: the subject and the HTML body. The `Prefer:
 * outlook.body-content-type="html"` header asks Graph to return the stored
 * HTML rather than a text conversion; CourtReserve's own mail is HTML, so
 * Graph hands it back directly with no round trip through its text renderer.
 *
 * `receivedAt` is Graph's `receivedDateTime` (an ISO-8601 instant) parsed to
 * epoch milliseconds — the chronological order a confirm/cancel chain
 * arrived in, which `reconcileCourtReserveEvents` keys on. A
 * missing/unparseable value falls back to 0 (oldest possible) rather than
 * "now", same as the Gmail adapter, so a timestamp-less message can't
 * masquerade as the most recent event in its chain.
 */
async function fetchMessage(
  accessToken: string,
  messageId: string,
): Promise<MailboxMessageOutcome> {
  try {
    const url = new URL(`${graphBaseUrl()}/me/messages/${encodeURIComponent(messageId)}`);
    url.searchParams.set("$select", "subject,receivedDateTime,body");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="html"',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "booking-buddy: fetching a Graph message failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json = (await response.json()) as GraphMessage;
    const subject = typeof json.subject === "string" ? json.subject : "";
    const html =
      typeof json.body?.content === "string" ? json.body.content : "";
    const receivedAt =
      typeof json.receivedDateTime === "string" ? Date.parse(json.receivedDateTime) : NaN;

    return {
      ok: true,
      email: { subject, html, receivedAt: Number.isFinite(receivedAt) ? receivedAt : 0 },
    };
  } catch (error) {
    console.error("booking-buddy: fetching a Graph message unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}

export const microsoftMailAdapter: MailAdapter = {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  resolveAccountEmail,
  searchMailbox,
  fetchMessage,
};
