/**
 * Dink Dine & Drink fixtures (issue #711): throwaway accounts, one on the
 * Organizer list and one not, built through Supabase's admin API. Deleting an
 * account takes it off the list. A DDD outlives the Organizer who made it
 * (every Organizer runs every DDD), so `cleanUp` deletes the DDDs a spec made
 * first, as that Organizer.
 *
 * Local Docker stack only, with Supabase's published demo keys, the same as
 * `mic-drop.ts`.
 */

const API_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const PASSWORD = "pickleball123";
const ADMIN = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

export type DddAccount = { email: string; userId: string };

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
  return res;
}

/** A fresh confirmed account; on the Organizer list when `organizer` is true. */
export async function seedAccount(organizer: boolean): Promise<DddAccount> {
  const email = `ddd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const created = await ok(
    await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: ADMIN,
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    }),
    "creating the account",
  );
  const userId = ((await created.json()) as { id: string }).id;
  if (organizer) {
    await ok(
      await fetch(`${API_URL}/rest/v1/ddd_organizers`, {
        method: "POST",
        headers: ADMIN,
        body: JSON.stringify({ user_id: userId }),
      }),
      "putting the account on the Organizer list",
    );
  }
  return { email, userId };
}

/** Deletes every DDD and Venue named in `names`, as `organizer`, then the accounts. */
export async function cleanUp(organizer: DddAccount, names: string[], accounts: DddAccount[]): Promise<void> {
  const session = await ok(
    await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: organizer.email, password: PASSWORD }),
    }),
    "signing the Organizer in",
  );
  const token = ((await session.json()) as { access_token: string }).access_token;
  const asOrganizer = { apikey: ANON_KEY, Authorization: `Bearer ${token}` };
  const list = `(${names.map((name) => `"${name}"`).join(",")})`;
  for (const table of ["ddd_events", "ddd_venues"]) {
    await fetch(`${API_URL}/rest/v1/${table}?name=in.${encodeURIComponent(list)}`, { method: "DELETE", headers: asOrganizer });
  }
  for (const account of accounts) {
    await fetch(`${API_URL}/auth/v1/admin/users/${account.userId}`, { method: "DELETE", headers: ADMIN });
  }
}
