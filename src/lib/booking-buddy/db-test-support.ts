/**
 * Booking Buddy's `npm run test:db` seeding: Connections, Orgs and dates. The
 * shared harness (throwaway signed-in Users, a service-role client) is
 * `../db-test-support.ts`, re-exported here so Booking Buddy's tests keep one
 * import.
 */

import { randomUUID } from "node:crypto";

import type { TestUser } from "../db-test-support.ts";

export { createTestUser, deleteTestUser, type TestUser } from "../db-test-support.ts";

/** Makes `a` and `b` accepted Connections, as the two Users themselves (only the addressee may accept). */
export async function connect(a: TestUser, b: TestUser): Promise<void> {
  const { data: request, error: requestError } = await a.supabase
    .from("connections")
    .insert({ requester_id: a.userId, addressee_id: b.userId })
    .select("id")
    .single();
  if (requestError || !request) {
    throw new Error(`Sending a Connection request failed: ${requestError?.message}`);
  }

  const { error: acceptError } = await b.supabase
    .from("connections")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", request.id);
  if (acceptError) {
    throw new Error(`Accepting a Connection request failed: ${acceptError.message}`);
  }
}

/** A hand-named Org owned by `user`, in `timeZone`. Returns its id. */
export async function createOrg(user: TestUser, timeZone = "America/Toronto"): Promise<string> {
  const { data, error } = await user.supabase
    .from("orgs")
    .insert({ owner_id: user.userId, name: `Test Club ${randomUUID().slice(0, 8)}`, time_zone: timeZone })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Creating a test Org failed: ${error?.message}`);
  }
  return data.id;
}

/** `YYYY-MM-DD`, `days` after today in UTC: far enough out that no zone reads it as past. */
export function dateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
