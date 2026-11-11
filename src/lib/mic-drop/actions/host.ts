"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { addContestant, createPoll } from "../polls.ts";
import { MIC_DROP_ROOT, pollPath } from "../routes.ts";
import { createClient } from "../supabase/server.ts";

/**
 * The Host's sign-in and writes. The database checks the allowlist and who
 * owns the Poll; these only carry the words to it and the refusal back.
 */

export type FormState = { problem?: string; name?: string };

/**
 * Called by `GoogleSignInButton` with the ID token Google returned. `nonce`
 * is the raw value: Supabase hashes it itself. Only Mic Drop's front door
 * signs in, so there is nowhere else to send the Host afterwards.
 */
export async function signInWithGoogleIdToken(
  idToken: string,
  nonce: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce,
  });
  if (error) redirect(`${MIC_DROP_ROOT}?error=google_unavailable`);
  revalidatePath(MIC_DROP_ROOT, "layout");
  redirect(MIC_DROP_ROOT);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath(MIC_DROP_ROOT, "layout");
  redirect(MIC_DROP_ROOT);
}

/** Creates a Poll and opens it, ready for its line-up. */
export async function startPoll(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "");
  const outcome = await createPoll(await createClient(), name);
  if (!outcome.ok) return { problem: outcome.problem, name };
  revalidatePath(MIC_DROP_ROOT);
  redirect(pollPath(outcome.value.id));
}

/** Adds a Contestant to the end of the line-up. */
export async function addToLineUp(
  pollId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "");
  const outcome = await addContestant(await createClient(), pollId, name);
  if (!outcome.ok) return { problem: outcome.problem, name };
  revalidatePath(pollPath(pollId));
  return {};
}
