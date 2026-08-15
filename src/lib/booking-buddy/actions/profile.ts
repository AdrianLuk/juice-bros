"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SETTINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { parseUsername, usernameWriteMessage } from "../username.ts";

export type { ActionResult } from "./result.ts";

export type Profile = {
  displayName: string | null;
  username: string | null;
};

/** The signed-in User's own profile. RLS scopes it to them. */
export async function getOwnProfile(): Promise<Profile> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", session.userId)
    .maybeSingle();

  if (error) {
    readFailed("your profile", error);
  }

  return {
    displayName: data?.display_name ?? null,
    username: data?.username ?? null,
  };
}

/**
 * Change the caller's Username.
 *
 * Uniqueness is left to the database's index rather than checked with a select
 * first: two people claiming the same handle in the gap between a check and an
 * insert is exactly the race the index exists to lose. So the write goes ahead
 * and a 23505 comes back as "that one's taken".
 */
export async function updateUsername(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseUsername(String(formData.get("username") ?? ""));
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ username: parsed.username })
    .eq("id", session.userId)
    .select("username");

  if (error) {
    return { error: usernameWriteMessage(error) };
  }

  // Zero rows means RLS matched nothing — reporting success would be a lie.
  if (!data?.length) {
    return { error: "Couldn't save that. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}
