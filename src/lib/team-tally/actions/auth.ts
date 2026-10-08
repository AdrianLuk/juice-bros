"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { TEAM_TALLY_ROOT, TEAM_TALLY_SIGN_IN_PATH, safeRedirectTarget } from "../routes.ts";
// Request infrastructure (a path to an absolute URL on the current host), not
// domain logic, so it is imported rather than copied, as On Deck does.
import { absoluteAppUrl } from "@/lib/booking-buddy/request-origin";

/**
 * Team Tally's sign-in, the same three ways On Deck offers (an emailed link, a
 * password, Google) against the one Supabase project the site shares. Copied
 * rather than imported from On Deck: the contexts share sign-in and nothing
 * else, and each lands the Organizer back in its own app.
 */

export type AuthFormState = { error?: string; sent?: boolean };

async function callbackUrl(next: string): Promise<string> {
  return absoluteAppUrl(`${TEAM_TALLY_ROOT}/auth/callback?next=${encodeURIComponent(next)}`);
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

  // The same answer whether or not the address has an account.
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Not echoed: Supabase tells a wrong password from an unknown address.
    return { error: "That email and password don't match." };
  }

  revalidatePath(TEAM_TALLY_ROOT, "layout");
  redirect(next);
}

export async function signUpWithPassword(
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await callbackUrl(next) },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation off (local), signUp returns a live session.
  if (data.session) {
    revalidatePath(TEAM_TALLY_ROOT, "layout");
    redirect(next);
  }

  return { sent: true };
}

/**
 * Called by `GoogleSignInButton` with the ID token Google Identity Services
 * returned. `nonce` is the raw value: Supabase hashes it itself.
 */
export async function signInWithGoogleIdToken(
  idToken: string,
  nonce: string,
  next: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce,
  });

  if (error) {
    redirect(`${TEAM_TALLY_SIGN_IN_PATH}?error=google_unavailable`);
  }

  revalidatePath(TEAM_TALLY_ROOT, "layout");
  redirect(safeRedirectTarget(next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath(TEAM_TALLY_ROOT, "layout");
  redirect(TEAM_TALLY_ROOT);
}
