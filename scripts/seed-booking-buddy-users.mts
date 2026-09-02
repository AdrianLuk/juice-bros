/**
 * Creates the local Booking Buddy test accounts. Run against the local
 * Supabase stack only:
 *
 *   npm run seed:users
 *
 * Idempotent — re-run it after `supabase db reset` (which wipes auth.users)
 * or any time you're not sure the accounts are there.
 *
 * Goes through the Auth admin API rather than `supabase/seed.sql`, because
 * inserting into `auth.users` by hand means hand-rolling password hashes and
 * identity rows that GoTrue owns. The admin API is the supported door, and it
 * fires the same signup trigger real users do — so these accounts get their
 * profile and Username the normal way, rather than a fixture that drifts from
 * how signup actually behaves.
 *
 * Accounts and passwords are documented in
 * booking-buddy/docs/local-test-accounts.md.
 */

import {
  LEGACY_ACCOUNTS,
  TEST_PASSWORD,
  TEST_WORKER_COUNT,
  workerAccountSet,
} from "../e2e/support/account-sets.ts";

/** Local Docker stack only. These are Supabase's published demo keys. */
const API_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export { TEST_PASSWORD };

/**
 * Order matters. Usernames are derived from the display name at signup, so the
 * first "Amy Ace" takes `amyace` and the second falls through to `amyace2` —
 * which is what keeps each email's local part equal to that account's Username
 * across a reset. Reorder these and the numbering swaps.
 */
const TEST_ACCOUNTS = LEGACY_ACCOUNTS;

if (!API_URL.includes("127.0.0.1")) {
  console.error("Refusing to run: this script is for the local stack only.");
  process.exit(1);
}

async function createUser({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
}): Promise<"created" | "exists"> {
  const response = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      // Skips the confirmation email — there is no inbox to click through.
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });

  if (response.ok) {
    return "created";
  }

  const body = await response.text();
  if (response.status === 422 && body.includes("already been registered")) {
    return "exists";
  }

  throw new Error(`Creating ${email} failed (${response.status}): ${body}`);
}

/**
 * Forces one account's Username to an exact value, as the User themselves —
 * `profiles` has an "editable by their owner" UPDATE policy and no
 * service-role grant, the same "made as the Users themselves" reasoning
 * `connect` already follows.
 *
 * Only the per-worker accounts need this: their display names collide (two
 * "Amy Ace"s per set), so the signup trigger's own numbering would hand out
 * `amyace9`-style Usernames that shift with creation order. Idempotent — a
 * re-run just re-sets the same string (and skips the write when it already
 * matches, so the unique index doesn't trip on the row's own value).
 */
async function forceUsername(email: string, username: string): Promise<void> {
  const token = await accessToken(email);
  const id = await userId(token);

  const [current] = (await asUser(
    token,
    `profiles?id=eq.${id}&select=username`,
  )) as { username: string }[];
  if (current?.username === username) return;

  await asUser(token, `profiles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
}

/**
 * The friendships the browser tests take as given.
 *
 * `e2e/friends.spec.ts` asserts that Amy and Ben are already friends, and
 * `e2e/friend-groups.spec.ts` can only group someone it is already connected
 * to — so without these, a fresh `supabase db reset` leaves five browser tests
 * failing for reasons that have nothing to do with the code under test.
 *
 * `amyace2` and `benbackhand2` are deliberately left strangers: the two-sided
 * request journey needs a pair who aren't connected yet.
 */
const SEEDED_FRIENDSHIPS = [
  { requester: "amyace@example.com", addressee: "benbackhand@example.com" },
  { requester: "amyace@example.com", addressee: "benbackhand2@example.com" },
];

/**
 * Made as the Users themselves rather than with the service-role key, because
 * `connections` is granted to `authenticated` and to nobody else. Seeding it
 * any other way would mean widening a grant in production to make a local
 * fixture convenient — and this way the fixture goes through the same policies
 * the app does.
 */
async function accessToken(email: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Signing in as ${email} failed: ${await response.text()}`);
  }

  return (await response.json()).access_token as string;
}

async function asUser(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${await response.text()}`);
  }

  return response.status === 204 ? null : await response.json();
}

async function userId(token: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return (await response.json()).id as string;
}

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};

/**
 * Deletes both sides' own `visibility_overrides` row for one Connection, each
 * as themselves — the same "made as the Users themselves" reasoning `connect`
 * already follows, since this table is `authenticated`-only too.
 *
 * Accepting a Connection auto-grants `calendar` on both sides now (issue #76,
 * `connections_seed_visibility_on_accept`) — real behavior for an actual new
 * friendship, and covered where it belongs, in pgTAP (`connections.test.sql`).
 * But the two friendships this script seeds predate that trigger by design:
 * several browser specs (issue #83) were written expecting these specific
 * pairs to sit at the visibility lattice's bottom — no group, no override —
 * so a friend explicitly granted nothing stays exactly that. Clearing this
 * every run, not just the run that first accepts, keeps a re-run idempotent
 * regardless of which state a prior interrupted run left behind.
 */
async function clearVisibilityOverrides(
  requesterToken: string,
  addresseeToken: string,
  requesterId: string,
  addresseeId: string,
  connectionId: string,
): Promise<void> {
  await Promise.all([
    asUser(
      requesterToken,
      `visibility_overrides?owner_id=eq.${requesterId}&connection_id=eq.${connectionId}`,
      { method: "DELETE" },
    ),
    asUser(
      addresseeToken,
      `visibility_overrides?owner_id=eq.${addresseeId}&connection_id=eq.${connectionId}`,
      { method: "DELETE" },
    ),
  ]);
}

async function connect(requester: string, addressee: string): Promise<string> {
  const [requesterToken, addresseeToken] = await Promise.all([
    accessToken(requester),
    accessToken(addressee),
  ]);
  const [requesterId, addresseeId] = await Promise.all([
    userId(requesterToken),
    userId(addresseeToken),
  ]);

  // RLS already limits this to the requester's own Connections, so the pair is
  // found by filtering rather than by a query the policy would narrow anyway.
  const existing = ((await asUser(
    requesterToken,
    "connections?select=id,requester_id,addressee_id,status",
  )) as ConnectionRow[]).find(
    (row) =>
      (row.requester_id === requesterId && row.addressee_id === addresseeId) ||
      (row.requester_id === addresseeId && row.addressee_id === requesterId),
  );

  if (existing?.status === "accepted") {
    await clearVisibilityOverrides(requesterToken, addresseeToken, requesterId, addresseeId, existing.id);
    return "already friends";
  }

  const pending =
    existing ??
    ((await asUser(requesterToken, "connections", {
      method: "POST",
      body: JSON.stringify({
        requester_id: requesterId,
        addressee_id: addresseeId,
      }),
    })) as ConnectionRow[])[0];

  // Only the addressee may accept — the RLS update policy says so, which is
  // why this switches tokens rather than carrying on as the requester. Which
  // token that is depends on the row: a pending request found above may run in
  // either direction, and accepting as the wrong party is filtered to zero rows
  // by the policy rather than refused, so it would look like it worked.
  const accepterToken =
    pending.addressee_id === addresseeId ? addresseeToken : requesterToken;

  const accepted = (await asUser(accepterToken, `connections?id=eq.${pending.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "accepted",
      responded_at: new Date().toISOString(),
    }),
  })) as ConnectionRow[];

  // `Prefer: return=representation` means a write RLS filtered away comes back
  // as an empty array with a 200, so the response being ok proves nothing. This
  // script exists to stop the browser suite failing for reasons unrelated to
  // the code under test; announcing a friendship it did not make would be
  // exactly that failure wearing a disguise.
  if (accepted.length === 0) {
    throw new Error(
      `Accepting ${requester} ↔ ${addressee} changed no rows — the connection is still pending.`,
    );
  }

  await clearVisibilityOverrides(requesterToken, addresseeToken, requesterId, addresseeId, pending.id);

  return "connected";
}

let created = 0;

for (const account of TEST_ACCOUNTS) {
  const result = await createUser(account);
  if (result === "created") created += 1;
  console.log(`${result === "created" ? "created" : "already there"}  ${account.email}`);
}

console.log(
  `\n${created} created, ${TEST_ACCOUNTS.length - created} already existed. Password for all: ${TEST_PASSWORD}`,
);

console.log("");

for (const { requester, addressee } of SEEDED_FRIENDSHIPS) {
  const result = await connect(requester, addressee);
  console.log(`${result}  ${requester} ↔ ${addressee}`);
}

// Per-worker copies — same four accounts, same two friendships, one set per
// Playwright worker so `workers > 1` doesn't have two of them writing the
// same rows.
console.log(`\nWorker sets (E2E_WORKER_COUNT=${TEST_WORKER_COUNT}):`);
for (let index = 0; index < TEST_WORKER_COUNT; index++) {
  const set = workerAccountSet(index);
  for (const account of [set.amy, set.ben, set.amy2, set.ben2]) {
    const result = await createUser(account);
    if (result === "created") created += 1;
    await forceUsername(account.email, account.username);
  }
  await connect(set.amy.email, set.ben.email);
  await connect(set.amy.email, set.ben2.email);
  console.log(
    `  w${index}: @${set.amy.username} ↔ @${set.ben.username}, @${set.amy.username} ↔ @${set.ben2.username} ` +
      `(@${set.amy2.username} ↔ @${set.ben2.username} left strangers)`,
  );
}
