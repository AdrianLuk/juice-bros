/** Local Docker stack only — Supabase's published demo keys, same as guest-rsvp-log.ts. */
const LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/** Headers a Player's phone would send — no account, the anon key only. */
function anonHeaders(): Record<string, string> {
  return {
    apikey: LOCAL_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${LOCAL_SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

function serviceRoleHeaders(): Record<string, string> {
  return {
    apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function userIdForEmail(email: string): Promise<string> {
  const url = new URL(`${LOCAL_SUPABASE_API_URL}/auth/v1/admin/users`);
  const res = await fetch(url, { headers: serviceRoleHeaders() });
  if (!res.ok) {
    throw new Error(`listing users failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { users: { id: string; email: string }[] };
  const user = body.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(`no auth user for ${email} — sign up first`);
  }
  return user.id;
}

/**
 * On Deck Clubs are seeded by hand (self-serve creation is out of scope, #238)
 * — there is no app path that writes `on_deck_clubs`, and RLS gives even the
 * owner no insert. So the e2e fixture writes it straight against PostgREST
 * with the service-role key, the same posture `guest-rsvp-log.ts` takes for a
 * `service_role`-only table.
 *
 * Idempotent on the owner (the one-Club-per-owner unique index): clears any
 * existing Club for the account first, so a re-run starts clean.
 */
export async function seedClubForOrganizer(
  email: string,
  club: {
    name: string;
    venueName: string;
    courtCount?: number;
    groupCap?: number;
    floorMode?: "volunteer-run" | "self-serve" | "hybrid";
  },
): Promise<string> {
  const ownerId = await userIdForEmail(email);
  await deleteClubForOrganizer(email);

  const row = {
    owner_id: ownerId,
    name: club.name,
    venue_name: club.venueName,
    court_count: club.courtCount ?? 8,
    group_cap: club.groupCap ?? 4,
    floor_mode: club.floorMode ?? "hybrid",
  };

  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/on_deck_clubs`, {
    method: "POST",
    headers: { ...serviceRoleHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`seeding a Club failed: ${res.status} ${await res.text()}`);
  }
  const [created] = (await res.json()) as { id: string }[];
  return created.id;
}

/**
 * Seeds an open Session for a Club straight against PostgREST, plus its
 * `SESSION_STARTED` event so `reduceSession` opens it. On Deck has no
 * seed-a-session app path (the Organizer taps Start), and the Volunteer Link
 * journey (#248) needs a running Session it did not open itself. Returns the
 * Session id and its Volunteer Link token.
 */
export async function seedOpenSession(
  email: string,
  clubId: string,
  session: {
    venueName?: string;
    courtCount?: number;
    groupCap?: number;
    floorMode?: "volunteer-run" | "self-serve" | "hybrid";
  } = {},
): Promise<{ sessionId: string; volunteerToken: string }> {
  const ownerId = await userIdForEmail(email);
  const venueName = session.venueName ?? "Ramsden Park";
  const courtCount = session.courtCount ?? 8;
  const groupCap = session.groupCap ?? 4;
  const floorMode = session.floorMode ?? "hybrid";

  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/on_deck_sessions`, {
    method: "POST",
    headers: { ...serviceRoleHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      club_id: clubId,
      venue_name: venueName,
      court_count: courtCount,
      group_cap: groupCap,
      floor_mode: floorMode,
    }),
  });
  if (!res.ok) {
    throw new Error(`seeding a Session failed: ${res.status} ${await res.text()}`);
  }
  const [created] = (await res.json()) as {
    id: string;
    volunteer_token: string;
  }[];

  const eventRes = await fetch(
    `${LOCAL_SUPABASE_API_URL}/rest/v1/on_deck_session_events`,
    {
      method: "POST",
      headers: serviceRoleHeaders(),
      body: JSON.stringify({
        session_id: created.id,
        type: "SESSION_STARTED",
        operator_kind: "organizer",
        operator_user_id: ownerId,
        payload: { venueName, courtCount, groupCap, floorMode },
      }),
    },
  );
  if (!eventRes.ok) {
    throw new Error(
      `seeding SESSION_STARTED failed: ${eventRes.status} ${await eventRes.text()}`,
    );
  }

  return { sessionId: created.id, volunteerToken: created.volunteer_token };
}

/**
 * Drives the `anon`-callable RPCs a Player's phone would hit — used to stand
 * up a roster and a Queue for the rotation-loop journey (#243) without
 * spinning up a browser context per Player.
 */
export async function joinPlayerViaRpc(
  sessionId: string,
  token: string,
  firstName: string,
  lastInitial: string,
  skillLevel = "intermediate",
): Promise<void> {
  const res = await fetch(
    `${LOCAL_SUPABASE_API_URL}/rest/v1/rpc/on_deck_join_session`,
    {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({
        p_session_id: sessionId,
        p_token: token,
        p_first_name: firstName,
        p_last_initial: lastInitial,
        p_skill_level: skillLevel,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`join RPC failed: ${res.status} ${await res.text()}`);
  }
}

export async function queuePlayerViaRpc(
  sessionId: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    `${LOCAL_SUPABASE_API_URL}/rest/v1/rpc/on_deck_queue_player`,
    {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({ p_session_id: sessionId, p_token: token }),
    },
  );
  if (!res.ok) {
    throw new Error(`queue RPC failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Drives `on_deck_form_group` the way a Player's phone would (issue #251) —
 * `actorToken` picks `memberTokens` (which must include the actor). The server
 * mints the group id, so this passes one too.
 */
export async function formGroupViaRpc(
  sessionId: string,
  actorToken: string,
  memberTokens: string[],
): Promise<void> {
  const res = await fetch(
    `${LOCAL_SUPABASE_API_URL}/rest/v1/rpc/on_deck_form_group`,
    {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({
        p_session_id: sessionId,
        p_actor_token: actorToken,
        p_group_id: `group-${crypto.randomUUID()}`,
        p_member_tokens: memberTokens,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`form-group RPC failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Fires "Court N done" through the Volunteer append RPC (issue #248) — the way
 * the volunteer floor screen does — so a spec can drive a turnover without
 * signing in an Organizer or opening the floor UI. Sends only `{ court }`;
 * unlike the real `finishCourt` action there is no stale-board guard, which a
 * scripted spec doesn't need.
 */
export async function finishCourtViaRpc(
  sessionId: string,
  volunteerToken: string,
  court: number,
): Promise<void> {
  const res = await fetch(
    `${LOCAL_SUPABASE_API_URL}/rest/v1/rpc/on_deck_volunteer_append`,
    {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({
        p_session_id: sessionId,
        p_token: volunteerToken,
        p_type: "COURT_FINISHED",
        p_payload: { court },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `court-finish RPC failed: ${res.status} ${await res.text()}`,
    );
  }
}

/** Pauses a queued Player (reason `set-aside`) via the anon RPC. */
export async function pausePlayerViaRpc(
  sessionId: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    `${LOCAL_SUPABASE_API_URL}/rest/v1/rpc/on_deck_pause_player`,
    {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({ p_session_id: sessionId, p_token: token }),
    },
  );
  if (!res.ok) {
    throw new Error(`pause RPC failed: ${res.status} ${await res.text()}`);
  }
}

/** Tears down the Club and everything cascading off it (Sessions, events). */
export async function deleteClubForOrganizer(email: string): Promise<void> {
  const ownerId = await userIdForEmail(email);

  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/on_deck_clubs`);
  url.searchParams.set("owner_id", `eq.${ownerId}`);

  const res = await fetch(url, { method: "DELETE", headers: serviceRoleHeaders() });
  if (!res.ok) {
    throw new Error(`deleting the Club failed: ${res.status} ${await res.text()}`);
  }
}
