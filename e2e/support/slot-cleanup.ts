import { createClient } from "@supabase/supabase-js";

/** Local Docker stack only — Supabase's published demo keys, same as scripts/seed-booking-buddy-users.mts. */
const LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/**
 * Deletes exactly the Slots a test created. There is no delete-a-slot UI yet
 * (out of scope for issue #8), so cleanup can't go through the app the way
 * removing an Org or a Friend Group does.
 *
 * Signs in as the Slot owner rather than using the service-role key the way
 * `deleteCachedPlaces` does for `place_cache`: `service_role` has no grant on
 * `slots` at all (only `authenticated` does, per the migration), and every
 * Slot a spec creates belongs to its own worker's account, so that account's
 * own "delete only your own slots" RLS policy is sufficient — no elevated
 * access needed just to clean up after a test. `responses` cascades away with
 * its Slot.
 */
export async function deleteSlots(
  slotIds: string[],
  owner: { email: string; password: string },
): Promise<void> {
  if (slotIds.length === 0) {
    return;
  }

  const supabase = createClient(LOCAL_SUPABASE_API_URL, LOCAL_SUPABASE_ANON_KEY);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: owner.email,
    password: owner.password,
  });
  if (signInError) {
    throw new Error(`slot cleanup: couldn't sign in as ${owner.email}: ${signInError.message}`);
  }

  const { error } = await supabase.from("slots").delete().in("id", slotIds);
  if (error) {
    throw new Error(`slot cleanup: couldn't delete slots ${slotIds.join(", ")}: ${error.message}`);
  }
}
