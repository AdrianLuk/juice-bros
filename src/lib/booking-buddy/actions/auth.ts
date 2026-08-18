"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Not echoed verbatim: Supabase distinguishes wrong password from unknown
    // address, which would confirm whether an address has an account.
    return { error: "That email and password don't match." };
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
  const { error } = await supabase.auth.signUp({
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

  return { sent: true };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeRedirectTarget(String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });

  if (error || !data.url) {
    redirect(`${SIGN_IN_PATH}?error=google_unavailable`);
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath(BOOKING_BUDDY_ROOT, "layout");
  redirect(SIGN_IN_PATH);
}
