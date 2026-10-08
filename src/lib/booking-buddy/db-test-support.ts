/**
 * The `npm run test:db` harness (issue #608): a real Supabase client signed in
 * as a real User on the local stack, so a module that takes a
 * `SupabaseClient` is tested against the actual schema, triggers and RLS
 * rather than a mock of them.
 *
 * Each test file makes its own throwaway Users and deletes them when it is
 * done. A seeded account (`npm run seed:users`) can't be used: its rows could
 * never be cleaned up, because `processed_messages` is insert-only to every
 * role the app has, and the only thing that removes a User's rows from it is
 * the `on delete cascade` from `auth.users`. Deleting the User is that
 * cleanup, and it takes every other table's rows with it.
 *
 * Local only, like `test:rls` and `test:e2e`: needs Docker and `supabase
 * start`, and nothing else. Never part of `npm test`.
 */

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Local Docker stack only. These are Supabase's published demo keys, the same ones `scripts/seed-booking-buddy-users.mts` uses. */
const API_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const PASSWORD = "pickleball123";

export type TestUser = {
  userId: string;
  /** Signed in as this User: every query runs under their RLS, as a Server Action's would. */
  supabase: SupabaseClient;
};

function adminHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * A `service_role` client, for seeding what no app role may write (an On Deck
 * Club has no INSERT grant for `authenticated`). Never for the code under test.
 */
export function serviceRoleClient(): SupabaseClient {
  return createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A fresh User with this display name, signed in. Delete it with `deleteTestUser`. */
export async function createTestUser(displayName: string): Promise<TestUser> {
  const email = `db-test-${randomUUID()}@example.com`;

  const response = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  }).catch((error: unknown) => {
    throw new Error(
      `Couldn't reach local Supabase at ${API_URL}. Is it running? (npx supabase start)`,
      { cause: error },
    );
  });

  if (!response.ok) {
    throw new Error(`Creating a test User failed (${response.status}): ${await response.text()}`);
  }

  const supabase = createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) {
    throw new Error(`Signing in as the test User failed: ${error?.message}`);
  }

  return { userId: data.user.id, supabase };
}

/** Deletes the User and, by cascade, every row they own. */
export async function deleteTestUser(user: TestUser): Promise<void> {
  await user.supabase.auth.signOut();
  const response = await fetch(`${API_URL}/auth/v1/admin/users/${user.userId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Deleting the test User failed (${response.status}): ${await response.text()}`);
  }
}

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
