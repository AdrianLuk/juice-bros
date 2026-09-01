import { isMailboxProvider, type MailboxProvider } from "./mailbox-provider.ts";

/**
 * Cookie carrying the OAuth `state` value between `connectMailbox`'s redirect
 * and the mailbox OAuth callback route (issue #62 / #281 / #280) — the callback
 * refuses to proceed unless the value the provider echoes back matches what was
 * set here, the standard CSRF defence for an authorization-code flow.
 *
 * Kept out of `actions/email-sync.ts`: a `"use server"` file may only export
 * async functions, and both that module and the callback route need this same
 * constant and the encode/parse pair below.
 *
 * The wire value changed with the #281 rename (was `bb_gmail_oauth_state`) and
 * its *contents* changed with #280: the value is now `"<provider>:<nonce>"`
 * rather than a bare nonce, so the single unified callback route can read which
 * provider's consent it's completing straight off the round-tripped `state`.
 * An OAuth flow that straddled either deploy fails its state check and bounces
 * to `?error=mailbox_connect_failed` — harmless here because email sync isn't
 * live yet (the OAuth env vars aren't set on Vercel — see PROGRESS.md), so
 * there are no in-flight consents to strand.
 */
export const MAILBOX_OAUTH_STATE_COOKIE = "bb_mailbox_oauth_state";

/**
 * Packs the provider and the CSRF nonce into the one opaque string that rides
 * through the provider's consent screen as `state` and is mirrored in the
 * cookie. `:` is a safe separator — a nonce is hex, a provider id is a fixed
 * lowercase word, neither contains one.
 */
export function encodeMailboxOAuthState(provider: MailboxProvider, nonce: string): string {
  return `${provider}:${nonce}`;
}

/**
 * The inverse — `null` when the value isn't the shape this module wrote (a
 * stale pre-#280 bare nonce, a hand-crafted callback, a truncated cookie), so
 * the callback route treats it exactly like a missing/mismatched state.
 */
export function parseMailboxOAuthState(
  value: string | undefined,
): { provider: MailboxProvider; nonce: string } | null {
  if (!value) {
    return null;
  }

  const separator = value.indexOf(":");
  if (separator === -1) {
    return null;
  }

  const provider = value.slice(0, separator);
  const nonce = value.slice(separator + 1);
  if (!nonce || !isMailboxProvider(provider)) {
    return null;
  }

  return { provider, nonce };
}
