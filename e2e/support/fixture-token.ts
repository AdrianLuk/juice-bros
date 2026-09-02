/**
 * A cached password-grant access token per fixture account, shared by every
 * direct-Postgres helper (`db-reset.ts`, `availability.ts`, `slot-cleanup.ts`).
 *
 * Without the cache, each `afterEach` minted a fresh token, and under parallel
 * load that flood of `POST /auth/v1/token` calls pushed local GoTrue into
 * `500 "Database error querying schema"` (its connection pool is small). One
 * grant per account per worker, reused for the ~30 min a token stays valid,
 * keeps the whole run to a dozen or so — and the grant itself retries through
 * a transient 5xx.
 */

const LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export type FixtureUser = { email: string; password: string };

const cache = new Map<string, { token: string; at: number }>();
const TTL_MS = 30 * 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fixtureToken(user: FixtureUser): Promise<string> {
  const hit = cache.get(user.email);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.token;

  let lastBody = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(250 * attempt);
    const res = await fetch(`${LOCAL_SUPABASE_API_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: LOCAL_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (res.ok) {
      const token = ((await res.json()) as { access_token: string }).access_token;
      cache.set(user.email, { token, at: Date.now() });
      return token;
    }
    lastBody = await res.text();
    // 4xx (bad credentials) won't get better by retrying.
    if (res.status < 500) break;
  }
  throw new Error(`fixture-token: signing in ${user.email} failed: ${lastBody}`);
}

/** The account's user id, read from the `sub` claim of its cached token — no extra GoTrue round trip. */
export async function fixtureUserId(user: FixtureUser): Promise<string> {
  const token = await fixtureToken(user);
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
  ) as { sub: string };
  return payload.sub;
}

export { LOCAL_SUPABASE_API_URL, LOCAL_SUPABASE_ANON_KEY };
