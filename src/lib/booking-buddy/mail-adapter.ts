import "server-only";

/**
 * The one interface everything provider-specific about a Mailbox Link goes
 * through (spec #280): the OAuth half (authorize URL, code exchange, refresh)
 * plus the mailbox half (resolve the connected account, search, fetch one
 * message). A Google implementation exists today (`mail-adapters/google.ts`,
 * refactored out of the old `gmail-client.ts` with no behaviour change); a
 * Microsoft one is added in #280's later slices. Implementations are plain
 * function-object modules selected by the `Record` literal in
 * `mail-adapters/index.ts` — no class hierarchy, no dynamic registry.
 *
 * Every method that does I/O returns a discriminated result rather than
 * throwing, matching the posture the Gmail client already held: a caller
 * distinguishes "reconnect" (`invalid_grant`) from "the provider had a bad
 * minute" (`unreachable`) without a try/catch.
 */

/**
 * Provider-neutral mailbox-search criteria. Each adapter formats its own
 * query dialect from this (Gmail `q` syntax, Microsoft Graph `$filter`) —
 * the caller never sees a provider-specific query string. Built by
 * `buildCourtReserveSearchCriteria`.
 */
export type MailSearchCriteria = {
  sender: string;
  after: Date;
};

export type TokenExchangeOutcome =
  | { ok: true; refreshToken: string; accessToken: string }
  | { ok: false; reason: "unreachable" };

/**
 * `refreshToken` is the optional *rotated* refresh token — Microsoft returns
 * a new one on every exchange and the old one stops working, so the shared
 * token-lifecycle helper must persist it; Google never rotates and leaves it
 * unset.
 */
export type RefreshOutcome =
  | { ok: true; accessToken: string; refreshToken?: string }
  | { ok: false; reason: "invalid_grant" }
  | { ok: false; reason: "unreachable" };

export type AccountEmailOutcome =
  | { ok: true; email: string }
  | { ok: false; reason: "unreachable" };

export type MailboxSearchOutcome =
  | { ok: true; messageIds: string[] }
  | { ok: false; reason: "unreachable" };

export type MailboxMessageOutcome =
  | { ok: true; email: { subject: string; html: string; receivedAt: number } }
  | { ok: false; reason: "unreachable" };

export type MailAdapter = {
  /**
   * Where "Connect <provider>" sends the browser. May throw if the provider's
   * OAuth client isn't configured — callers already catch that and redirect
   * to the connect-failure page rather than 500.
   */
  buildAuthorizeUrl(redirectUri: string, state: string): string;
  /** The authorization-code exchange the OAuth callback route runs once. */
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenExchangeOutcome>;
  /** Trades a stored refresh token for a fresh access token, run on every sync. */
  refreshAccessToken(refreshToken: string): Promise<RefreshOutcome>;
  /** Which account just got connected, shown back in Settings. */
  resolveAccountEmail(accessToken: string): Promise<AccountEmailOutcome>;
  /** Mailbox message-id search scoped by `criteria` — ids only. */
  searchMailbox(accessToken: string, criteria: MailSearchCriteria): Promise<MailboxSearchOutcome>;
  /** One message reduced to what `parseCourtReserveEmail` needs. */
  fetchMessage(accessToken: string, messageId: string): Promise<MailboxMessageOutcome>;
};
