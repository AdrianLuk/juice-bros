/**
 * Cookie carrying the OAuth `state` value between `connectGmail`'s redirect
 * and the `gmail-callback` route (issue #62) — the callback refuses to
 * proceed unless the value Google echoes back matches what was set here,
 * the standard CSRF defence for an authorization-code flow.
 *
 * Kept out of `actions/email-sync.ts`: a `"use server"` file may only export
 * async functions, and both that module and the callback route need this
 * same constant.
 */
export const GMAIL_OAUTH_STATE_COOKIE = "bb_gmail_oauth_state";
