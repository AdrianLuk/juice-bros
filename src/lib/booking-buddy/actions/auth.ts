"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { trackSignupOnce } from "../analytics.ts";
import { consumeInviteCookie } from "../invite-connection.ts";
import { BOOKING_BUDDY_ROOT, SIGN_IN_PATH, safeRedirectTarget } from "../routes.ts";
import { absoluteAppUrl } from "../request-origin.ts";

export type AuthFormState = { error?: string; sent?: boolean };

async function callbackUrl(next: string): Promise<string> {
  return absoluteAppUrl(`/booking-buddy/auth/callback?next=${encodeURIComponent(next)}`);
}

/** Emails a one-time sign-in link. Creates the account if it's a new address. */
export async function signInWithMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeRedirectTarget(String(formData.get("next") ?? ""));

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callbackUrl(next) },
  });

  if (error) {
    return { error: error.message };
  }

  // Deliberately the same response whether or not the address has an account,
  // so this can't be used to discover who has signed up.
  return { sent: true };
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectTarget(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Not echoed verbatim: Supabase distinguishes wrong password from unknown
    // address, which would confirm whether an address has an account.
    return { error: "That email and password don't match." };
  }

  // Fires `bb_signup` only on this account's first authenticated session (#179).
  const userId = data.user?.id;
  if (userId) {
    // Before the redirect, not in `after()`: it clears a cookie, which can
    // only happen while the response is still being built.
    await consumeInviteCookie(supabase, userId);
    after(() => trackSignupOnce(userId));
  }

  revalidatePath(BOOKING_BUDDY_ROOT, "layout");
  redirect(next);
}

export async function signUpWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const next = safeRedirectTarget(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to populate the profile.
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: await callbackUrl(next),
    },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation on (real deploys), there's no session yet and the
  // invite cookie is consumed later at the callback route instead. With it
  // off (local), `signUp` returns a live session — create the pending friend
  // request now, so a token-carried signup connects here too (issue #175).
  const userId = data.user?.id;
  if (userId && data.session) {
    await consumeInviteCookie(supabase, userId);
  }

  return { sent: true };
}

/**
 * Called directly from `GoogleSignInButton` (not a `<form action>`) — the ID
 * token comes back from Google Identity Services' own callback, not a form
 * submit. See ADR-0013 for why sign-in went this way instead of
 * `signInWithOAuth`'s redirect (which showed Google's consent screen as
 * Supabase's raw project URL, not this app's own domain).
 *
 * `nonce` is the *raw* value the button generated client-side — Supabase
 * hashes it itself to compare against the ID token's `nonce` claim, so this
 * must not be pre-hashed here (unlike the hashed nonce Google's `initialize`
 * call was given).
 */
export async function signInWithGoogleIdToken(
  idToken: string,
  nonce: string,
  next: string,
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce,
  });

  if (error) {
    redirect(`${SIGN_IN_PATH}?error=google_unavailable`);
  }

  // Fires `bb_signup` only on this account's first authenticated session (#179).
  const userId = data.user?.id;
  if (userId) {
    await consumeInviteCookie(supabase, userId);
    after(() => trackSignupOnce(userId));
  }

  revalidatePath(BOOKING_BUDDY_ROOT, "layout");
  redirect(safeRedirectTarget(next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath(BOOKING_BUDDY_ROOT, "layout");
  redirect(SIGN_IN_PATH);
}
