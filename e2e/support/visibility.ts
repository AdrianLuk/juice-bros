/**
 * Per-friend Visibility, set straight against PostgREST.
 *
 * Since ADR 0021 the resolver's floor is `profiles.default_friend_visibility`,
 * seeded to `calendar` — so "these two are connected and nothing else has
 * happened" now means they see each other's games and availability. A spec
 * whose subject is what someone *can't* see has to say so explicitly rather
 * than lean on the floor, or it silently re-passes (or re-fails) the next time
 * the floor moves.
 *
 * An override is the sharpest way to say it: it wins over the floor and over
 * every Friend Group grant, in both directions, and it is scoped to the one
 * pair rather than to every friend the owner has. Written here as the owner
 * themselves — `visibility_overrides` is owner-only, with no `service_role`
 * grant, the same posture `availability.ts` takes.
 */

import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  fixtureUserId,
  type FixtureUser,
} from "./fixture-token.ts";

/** The four `visibility_level` values (ADR 0007's lattice, ADR 0021's floor). */
export type VisibilityLevel = "none" | "slots" | "open_time" | "calendar";

async function asOwner(
  token: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `visibility: ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return res;
}

/**
 * Pins what `owner` lets `friend` see, whatever the owner's default and groups
 * would otherwise resolve to. The pair must already be accepted Connections —
 * `seed:users` makes the two seeded pairs, and `deleteVisibilityOverrides`
 * (db-reset.ts) is how a spec puts the owner back on their default afterwards.
 */
export async function pinFriendVisibility(
  owner: FixtureUser,
  friend: FixtureUser,
  level: VisibilityLevel,
): Promise<void> {
  const [token, ownerId, friendId] = await Promise.all([
    fixtureToken(owner),
    fixtureUserId(owner),
    fixtureUserId(friend),
  ]);

  // One row covers the pair whichever way round it was asked (the
  // `connections_unique_pair` index is what guarantees that), so both
  // orientations have to be tried.
  const pair =
    `or=(and(requester_id.eq.${ownerId},addressee_id.eq.${friendId}),` +
    `and(requester_id.eq.${friendId},addressee_id.eq.${ownerId}))`;
  const found = await asOwner(
    token,
    `connections?select=id&status=eq.accepted&${pair}`,
    { method: "GET" },
  );
  const rows = (await found.json()) as { id: string }[];
  if (rows.length !== 1) {
    throw new Error(
      `visibility: expected one accepted Connection between ${owner.email} and ${friend.email}, found ${rows.length}`,
    );
  }

  // Upsert on the (owner_id, connection_id) primary key — a spec may pin the
  // same pair more than once across its own tests.
  await asOwner(token, "visibility_overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ owner_id: ownerId, connection_id: rows[0].id, level }),
  });
}
