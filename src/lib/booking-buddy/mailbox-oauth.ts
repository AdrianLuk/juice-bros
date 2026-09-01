/**
 * Cookie carrying the OAuth `state` value between `connectMailbox`'s redirect
 * and the mailbox OAuth callback route (issue #62 / #281) — the callback
 * refuses to proceed unless the value the provider echoes back matches what
 * was set here, the standard CSRF defence for an authorization-code flow.
 *
 * Kept out of `actions/email-sync.ts`: a `"use server"` file may only export
 * async functions, and both that module and the callback route need this
 * same constant.
 *
 * The wire value changed with the #281 rename (was `bb_gmail_oauth_state`). An
 * OAuth flow that straddled that deploy would fail its state check and bounce
 * to `?error=mailbox_connect_failed` — harmless here because email sync isn't
 * live yet (the OAuth env vars aren't set on Vercel — see PROGRESS.md), so
 * there are no in-flight consents to strand.
 */
export const MAILBOX_OAUTH_STATE_COOKIE = "bb_mailbox_oauth_state";
