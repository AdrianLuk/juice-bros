/** Local Docker stack only — Supabase's published demo keys, same as guest-rsvp-log.ts. */
const LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function serviceRoleHeaders(): Record<string, string> {
  return {
    apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { headers: serviceRoleHeaders() });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Wipe every `connections` row between the two Users — accepted or pending,
 * either direction — direct against Postgres. A reliable reset for the
 * friend-request specs, which each need the pair to start as strangers and
 * can't lean on the seed script (it doesn't connect these two).
 */
export async function clearConnectionBetween(
  usernameA: string,
  usernameB: string,
): Promise<void> {
  const [a, b] = await Promise.all([
    userIdByUsername(usernameA),
    userIdByUsername(usernameB),
  ]);

  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/connections`);
  url.searchParams.set(
    "or",
    `(and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a}))`,
  );

  const res = await fetch(url, {
    method: "DELETE",
    headers: serviceRoleHeaders(),
  });
  if (!res.ok) {
    throw new Error(`clearing connections failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Wipe every `connections` row this User is on either side of — direct against
 * Postgres. For the invite-link specs, where the inviter (`amyace2`) has to
 * start from no connections at all and the invitees are fresh throwaway
 * signups with handles a `clearConnectionBetween` can't name ahead of time.
 *
 * `amyace2` holds none of the seed script's friendships, so clearing all of
 * its rows never touches fixture data — don't point this at `amyace` /
 * `benbackhand` / `benbackhand2`, which do.
 */
export async function clearAllConnectionsFor(username: string): Promise<void> {
  const id = await userIdByUsername(username);

  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/connections`);
  url.searchParams.set("or", `(requester_id.eq.${id},addressee_id.eq.${id})`);

  const res = await fetch(url, { method: "DELETE", headers: serviceRoleHeaders() });
  if (!res.ok) {
    throw new Error(`clearing connections failed: ${res.status} ${await res.text()}`);
  }
}

async function userIdByUsername(username: string): Promise<string> {
  const rows = await get<{ id: string }[]>("profiles", {
    username: `eq.${username}`,
    select: "id",
  });
  if (rows.length === 0) {
    throw new Error(`no profile for username ${username}`);
  }
  return rows[0].id;
}

/**
 * The single-use Accept/Decline token for the pending friend request from
 * `requesterUsername` to `addresseeUsername` (issue #228).
 *
 * `connection_request_links` is `service_role`-only — the whole point is that
 * nobody reaches it through a session — so a test reads it direct against
 * PostgREST with the demo service-role key, the same posture
 * `slotLinkIdForToken` already established.
 */
export async function connectionRequestToken(
  requesterUsername: string,
  addresseeUsername: string,
): Promise<string> {
  const [requesterId, addresseeId] = await Promise.all([
    userIdByUsername(requesterUsername),
    userIdByUsername(addresseeUsername),
  ]);

  const rows = await get<{ token: string }[]>("connection_request_links", {
    select: "token,connections!inner(requester_id,addressee_id)",
    "connections.requester_id": `eq.${requesterId}`,
    "connections.addressee_id": `eq.${addresseeId}`,
  });

  if (rows.length === 0) {
    throw new Error(
      `no connection_request_links row for ${requesterUsername} -> ${addresseeUsername}`,
    );
  }
  return rows[0].token;
}
