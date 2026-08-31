"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { ON_DECK_ROOT, safeRedirectTarget } from "../routes.ts";
// Request infrastructure shared with Booking Buddy (turns a path into an
// absolute URL on the current request's host), not domain logic — so it is
// imported rather than reimplemented.
import { absoluteAppUrl } from "@/lib/booking-buddy/request-origin";

export type AuthFormState = { error?: string; sent?: boolean };

async function callbackUrl(next: string): Promise<string> {
  return absoluteAppUrl(
    `/on-deck/auth/callback?next=${encodeURIComponent(next)}`,
  );
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

  // Deliberately the same response whether or not the address has an account.
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

  revalidatePath(ON_DECK_ROOT, "layout");
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
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await callbackUrl(next) },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation on (real deploys) there's no session yet; with it
  // off (local) `signUp` returns a live one and the sign-in page's own
  // "already signed in?" guard forwards to `next` on the route refresh.
  return { sent: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath(ON_DECK_ROOT, "layout");
  redirect(ON_DECK_ROOT);
}
