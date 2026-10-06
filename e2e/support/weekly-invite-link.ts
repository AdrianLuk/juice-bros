/** Local Docker stack only: Supabase's published demo keys, same as connection-request-link.ts. */
const LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const HEADERS = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readToken(slotId: string, userId: string): Promise<string | null> {
  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/weekly_invite_links`);
  url.searchParams.set("slot_id", `eq.${slotId}`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("select", "token");
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`reading weekly_invite_links failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as { token: string }[];
  return rows[0]?.token ?? null;
}

/**
 * The answer token the Weekly Invite sender minted for this Regular and game
 * (issue #580). The sender runs in the posting action's `after()`, so this
 * polls briefly. `weekly_invite_links` is service_role-only, so a test reads
 * it with the demo service-role key, like `connectionRequestToken`.
 */
export async function weeklyInviteToken(slotId: string, userId: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const token = await readToken(slotId, userId);
    if (token) return token;
    await sleep(250);
  }
  throw new Error(`no weekly_invite_links row for slot ${slotId} and user ${userId}`);
}

/** A User's answer to a game, read past RLS (they may lack Visibility of it). */
export async function responseOf(slotId: string, userId: string): Promise<string | null> {
  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/responses`);
  url.searchParams.set("slot_id", `eq.${slotId}`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("select", "answer");
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`reading responses failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as { answer: string }[];
  return rows[0]?.answer ?? null;
}

/**
 * Mints a Regular's answer token directly, as the sender would, for a spec
 * that posts its game straight at PostgREST rather than through the form.
 * The database still refuses anyone who isn't one of the game's Regulars.
 */
export async function mintWeeklyInviteLink(slotId: string, userId: string): Promise<string> {
  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/weekly_invite_links`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ slot_id: slotId, user_id: userId }),
  });
  if (!res.ok) {
    throw new Error(`minting a weekly invite link failed: ${res.status} ${await res.text()}`);
  }
  const [row] = (await res.json()) as { token: string }[];
  return row.token;
}
