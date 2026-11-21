"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { joinWithInvite } from "../organizers.ts";
import { DDD_ROOT, inviteTokenOf, invitePath, safeRedirectTarget } from "../routes.ts";
import { createClient } from "../supabase/server.ts";

/**
 * Called by `GoogleSignInButton` with the ID token Google returned. `nonce`
 * is the raw value: Supabase hashes it itself. Signing in from an invite link
 * also joins the Organizer list, so opening it and signing in is the whole
 * invite.
 */
export async function signInWithGoogleIdToken(idToken: string, nonce: string, next: string): Promise<void> {
  const target = safeRedirectTarget(next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce });
  if (error) redirect(`${target.split(/[?#]/, 1)[0]}?error=google_unavailable`);

  const token = inviteTokenOf(target);
  revalidatePath(DDD_ROOT, "layout");
  if (token) redirect((await joinWithInvite(supabase, token)) ? DDD_ROOT : `${invitePath(token)}?error=used`);
  redirect(target);
}

/** For someone already signed in who opens an invite link. */
export async function joinAction(token: string): Promise<void> {
  const joined = await joinWithInvite(await createClient(), token);
  revalidatePath(DDD_ROOT, "layout");
  redirect(joined ? DDD_ROOT : `${invitePath(token)}?error=used`);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath(DDD_ROOT, "layout");
  redirect(DDD_ROOT);
}
