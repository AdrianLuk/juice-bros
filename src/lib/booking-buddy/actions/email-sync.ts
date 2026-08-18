"use server";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SETTINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { getOwnProfile } from "./profile.ts";
import { isEmailSyncAllowed } from "../email-sync-allowlist.ts";
import { readEmailSyncAllowlist } from "../env.ts";
import { buildGoogleAuthorizeUrl } from "../gmail-client.ts";
import { GMAIL_OAUTH_STATE_COOKIE } from "../gmail-oauth.ts";
import { absoluteAppUrl } from "../request-origin.ts";

export type { ActionResult } from "./result.ts";

export type MailboxLink = {
  googleAccountEmail: string;
  status: "active" | "expired";
  connectedAt: string;
} | null;

function gmailCallbackUrl(): Promise<string> {
  return absoluteAppUrl("/booking-buddy/settings/gmail-callback");
}

/**
 * Whether the signed-in User is allowed to see/use email sync at all
 * (ADR-0009's addendum) — the optimistic half. `connectGmail` below re-checks
 * this authoritatively.
 *
 * Fetches the profile itself rather than taking a `username` param: the one
 * caller that already has a profile in hand (the Settings page) calls
 * `isEmailSyncAllowed` directly instead of going through here, so this stays
 * the "I don't already have one" convenience path, not a second query on
 * top of one a caller already ran.
 */
export async function isEmailSyncAllowedForCaller(): Promise<boolean> {
  const profile = await getOwnProfile();
  return isEmailSyncAllowed(profile.username, readEmailSyncAllowlist());
}

/** The signed-in User's own Mailbox Link, or `null` if Gmail isn't connected. */
export async function getMailboxLink(): Promise<MailboxLink> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mailbox_links")
    .select("google_account_email, status, connected_at")
    .eq("owner_id", session.userId)
    .maybeSingle();

  if (error) {
    readFailed("your Gmail connection", error);
  }

  if (!data) {
    return null;
  }

  return {
    googleAccountEmail: data.google_account_email,
    status: data.status,
    connectedAt: data.connected_at,
  };
}

/**
 * Starts the Google OAuth redirect. Rejects a non-allowlisted User even if
 * they reach this directly — the Settings page not rendering the button is
 * the optimistic half, this is the authoritative one (ADR-0009's addendum,
 * same shape `verifySession` already established).
 */
export async function connectGmail(): Promise<void> {
  await verifySession();

  const allowed = await isEmailSyncAllowedForCaller();
  if (!allowed) {
    redirect(`${SETTINGS_PATH}?error=email_sync_not_allowed`);
  }

  const state = randomBytes(16).toString("hex");

  // Built before setting the cookie: if the OAuth client isn't configured
  // (a plausible partial-deploy state — see PROGRESS.md's own note that
  // these vars aren't set on Vercel yet), this throws, and the redirect
  // below should report a normal "couldn't connect" rather than a raw 500.
  let authorizeUrl: string;
  try {
    authorizeUrl = buildGoogleAuthorizeUrl(await gmailCallbackUrl(), state);
  } catch (error) {
    console.error("booking-buddy: Gmail OAuth client isn't configured", error);
    redirect(`${SETTINGS_PATH}?error=gmail_connect_failed`);
  }

  (await cookies()).set(GMAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  redirect(authorizeUrl);
}

export async function disconnectGmail(): Promise<ActionResult> {
  const session = await verifySession();
  const supabase = await createClient();

  // Unlike deleteOrg's zero-row check, a missing row here isn't ambiguous:
  // the delete is already scoped to the caller's own owner_id, so "zero
  // rows" only ever means "there was nothing connected" (e.g. a stale
  // double-click), never "you tried to touch someone else's Mailbox Link" —
  // there's no id from user input this could target instead.
  const { error } = await supabase
    .from("mailbox_links")
    .delete()
    .eq("owner_id", session.userId);

  if (error) {
    return { error: "Couldn't disconnect Gmail. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}
