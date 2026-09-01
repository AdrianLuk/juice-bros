import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
} from "./fixture-token.ts";

/**
 * Deletes exactly the Slots a test created. There is no delete-a-slot UI yet
 * (out of scope for issue #8), so cleanup can't go through the app the way
 * removing an Org or a Friend Group does.
 *
 * Acts as the Slot owner (via the shared cached token — `fixture-token.ts`)
 * rather than the service-role key the way `deleteCachedPlaces` does for
 * `place_cache`: `service_role` has no grant on `slots` at all (only
 * `authenticated` does, per the migration), and every Slot a spec creates
 * belongs to its own worker's account, so that account's own "delete only your
 * own slots" RLS policy is sufficient. `responses` cascades away with its Slot.
 */
export async function deleteSlots(
  slotIds: string[],
  owner: { email: string; password: string },
): Promise<void> {
  if (slotIds.length === 0) {
    return;
  }

  const token = await fixtureToken(owner);
  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/slots`);
  url.searchParams.set("id", `in.(${slotIds.join(",")})`);

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(
      `slot cleanup: couldn't delete slots ${slotIds.join(", ")}: ${res.status} ${await res.text()}`,
    );
  }
}
