/**
 * The one Organizer list (issue #711). The database decides who is on it
 * (ddd_is_organizer: the list, or a Superadmin); these only ask it.
 * Relative imports only, so `node --test` loads it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function isOrganizer(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("ddd_is_organizer");
  if (error) throw new Error(`Checking the Organizer list failed: ${error.message}`);
  return data === true;
}

/** A fresh, single-use invite token. Refused for anyone off the list. */
export async function createInvite(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("ddd_create_invite");
  if (error) throw new Error(`Making an invite failed: ${error.message}`);
  return data as string;
}

/** Puts the signed-in caller on the list with an invite token. False when it is used, expired or made up. */
export async function joinWithInvite(supabase: SupabaseClient, token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("ddd_join", { p_token: token });
  if (error) throw new Error(`Joining the Organizers failed: ${error.message}`);
  return data === true;
}
