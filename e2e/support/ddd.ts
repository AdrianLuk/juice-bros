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

import { torontoDate } from "./dates.ts";

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
    await ok(
      await fetch(`${API_URL}/rest/v1/${table}?name=in.${encodeURIComponent(list)}`, { method: "DELETE", headers: asOrganizer }),
      `deleting the spec's ${table}`,
    );
  }
  for (const account of accounts) {
    await fetch(`${API_URL}/auth/v1/admin/users/${account.userId}`, { method: "DELETE", headers: ADMIN });
  }
}

/** Creates a DDD as `organizer` through the database function the form calls, and returns its id. */
export async function createEvent(organizer: DddAccount, name: string): Promise<string> {
  const session = await ok(
    await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: organizer.email, password: PASSWORD }),
    }),
    "signing the Organizer in",
  );
  const token = ((await session.json()) as { access_token: string }).access_token;
  const res = await ok(
    await fetch(`${API_URL}/rest/v1/rpc/ddd_save_event`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_event_id: null,
        p_name: name,
        p_event_date: torontoDate(7),
        p_play_venue: "Rec Hall",
        p_dine_venue: "Noodle Bar",
        p_courts: ["1", "2", "3", "4"],
      }),
    }),
    "creating the DDD",
  );
  return (await res.json()) as string;
}

/**
 * Gives every Team of a DDD a full Lineup, as `organizer`, straight through
 * the REST API: men and women picked in roster order, doubling up when a
 * Team is short of one gender.
 */
export async function seedLineups(organizer: DddAccount, eventId: string): Promise<void> {
  const session = await ok(
    await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: organizer.email, password: PASSWORD }),
    }),
    "signing the Organizer in",
  );
  const token = ((await session.json()) as { access_token: string }).access_token;
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const teams = (await (
    await ok(
      await fetch(`${API_URL}/rest/v1/ddd_teams?event_id=eq.${eventId}&select=id,ddd_players(id,gender,position)&order=position`, { headers }),
      "reading the Teams",
    )
  ).json()) as { id: string; ddd_players: { id: string; gender: "M" | "F"; position: number }[] }[];
  const rows = teams.flatMap((team) => {
    const sorted = [...team.ddd_players].sort((a, b) => a.position - b.position);
    const men = sorted.filter((p) => p.gender === "M").map((p) => p.id);
    const women = sorted.filter((p) => p.gender === "F").map((p) => p.id);
    const pairs = {
      mens: [men[0], men[1]],
      womens: [women[0], women[1]],
      mixed1: [men[2] ?? men[0], women[0]],
      mixed2: [men[3] ?? men[1], women[1]],
    };
    return Object.entries(pairs).map(([game, [a, b]]) => ({ team_id: team.id, game, player_a: a, player_b: b }));
  });
  await ok(
    await fetch(`${API_URL}/rest/v1/ddd_lineup_pairs`, { method: "POST", headers, body: JSON.stringify(rows) }),
    "saving the Lineups",
  );
}
