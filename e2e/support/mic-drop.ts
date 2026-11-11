/**
 * Mic Drop fixtures (issue #670): a throwaway allowlisted Host and one Poll
 * with its line-up, built straight through the database's own functions as
 * that Host, so a live-update spec doesn't have to drive the Host's forms.
 * Deleting the Host takes the Poll and its Votes with it.
 *
 * Local Docker stack only, with Supabase's published demo keys, the same as
 * `team-tally.ts`. Names are PPA Tour pros: this repo is public.
 */

const API_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const PASSWORD = "pickleball123";
const ADMIN = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

export type SeededPoll = {
  hostEmail: string;
  hostPassword: string;
  userId: string;
  pollId: string;
  guestToken: string;
};

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
  return res;
}

/** A fresh allowlisted Host with an open Poll holding `lineUp`, in that order. */
export async function seedPoll(name: string, lineUp: string[]): Promise<SeededPoll> {
  const email = `mic-drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const created = await ok(
    await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: ADMIN,
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    }),
    "creating the Host",
  );
  const userId = ((await created.json()) as { id: string }).id;
  await ok(
    await fetch(`${API_URL}/rest/v1/mic_drop_hosts`, {
      method: "POST",
      headers: ADMIN,
      body: JSON.stringify({ user_id: userId }),
    }),
    "allowlisting the Host",
  );

  const session = await ok(
    await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
    "signing the Host in",
  );
  const accessToken = ((await session.json()) as { access_token: string }).access_token;
  const asHost = { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const rpc = async (fn: string, args: Record<string, unknown>) =>
    (
      await ok(
        await fetch(`${API_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: asHost, body: JSON.stringify(args) }),
        fn,
      )
    ).json();

  const poll = (await rpc("mic_drop_create_poll", { p_name: name })) as { id: string; guestToken: string };
  for (const contestant of lineUp) {
    await rpc("mic_drop_add_contestant", { p_poll_id: poll.id, p_name: contestant });
  }
  return { hostEmail: email, hostPassword: PASSWORD, userId, pollId: poll.id, guestToken: poll.guestToken };
}

export async function deleteHost(seeded: SeededPoll): Promise<void> {
  await fetch(`${API_URL}/auth/v1/admin/users/${seeded.userId}`, { method: "DELETE", headers: ADMIN });
}
