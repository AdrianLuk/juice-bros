/**
 * Direct-Postgres teardown for the parallel browser suite, plus the one piece
 * of setup that answers it (`pinFriendVisibility`).
 *
 * Under `workers > 1` the single Next server's Server-Action round trips
 * balloon, and `afterEach` cleanup that clicks through the UI (create a group,
 * delete it; sweep facilities; toggle a setting back) races
 * `revalidatePath` and sometimes leaves the row behind — which then poisons
 * the next test in that worker's file. Everything here resets the same state
 * straight against PostgREST instead, as the User themselves (these tables are
 * owner-only, no `service_role` grant), the same posture `availability.ts`
 * already takes.
 */

import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  fixtureUserId,
  type FixtureUser,
} from "./fixture-token.ts";

export type { FixtureUser };

async function asUser(
  user: FixtureUser,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const token = await fixtureToken(user);
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
    throw new Error(`db-reset: ${init.method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

/**
 * Deletes the caller's Friend Groups — by default only the `Playwright`-named
 * ones every spec creates, so a stray real group (there shouldn't be any on a
 * seeded account) is left alone. Member rows and the Visibility the group
 * granted cascade away with it.
 */
export async function deleteFriendGroups(
  user: FixtureUser,
  namePrefix = "Playwright",
): Promise<void> {
  await asUser(user, `friend_groups?name=like.${encodeURIComponent(`${namePrefix}%`)}`, {
    method: "DELETE",
  });
}

/** Deletes every per-friend Visibility pin the caller has set. */
export async function deleteVisibilityOverrides(user: FixtureUser): Promise<void> {
  // RLS scopes this to the caller's own rows; the filter is only PostgREST's
  // "delete needs a where" requirement.
  await asUser(user, "visibility_overrides?owner_id=not.is.null", { method: "DELETE" });
}

/**
 * Pins what `owner` lets `friend` see, whatever their default and Friend Groups
 * would otherwise resolve to. The inverse of `deleteVisibilityOverrides`, which
 * is how a spec puts the owner back on their default afterwards.
 *
 * Since ADR 0021 the resolver's floor is `profiles.default_friend_visibility`,
 * seeded to `calendar`, so "these two are connected and nothing else has
 * happened" already means they see each other's games and availability. A spec
 * whose subject is what someone *can't* see has to say so, and an override is
 * the sharpest way: it wins over the floor and over every Group grant, and it
 * is scoped to the one pair rather than to every friend the owner has.
 *
 * The four levels are `visibility_level`'s own, mirrored from
 * `src/lib/booking-buddy/visibility.ts` rather than imported — nothing under
 * `e2e/` reaches into `src/`, and this suite drives the app from outside it.
 */
export async function pinFriendVisibility(
  owner: FixtureUser,
  friend: FixtureUser,
  level: "none" | "slots" | "open_time" | "calendar",
): Promise<void> {
  const [ownerId, friendId] = await Promise.all([
    fixtureUserId(owner),
    fixtureUserId(friend),
  ]);

  // One row covers the pair whichever way round it was asked (what the
  // `connections_unique_pair` index guarantees), so both orientations are
  // tried.
  const pair =
    `or=(and(requester_id.eq.${ownerId},addressee_id.eq.${friendId}),` +
    `and(requester_id.eq.${friendId},addressee_id.eq.${ownerId}))`;
  const found = await asUser(owner, `connections?select=id&status=eq.accepted&${pair}`, {
    method: "GET",
  });
  const rows = (await found.json()) as { id: string }[];
  if (rows.length !== 1) {
    throw new Error(
      `db-reset: expected one accepted Connection between ${owner.email} and ${friend.email}, found ${rows.length}`,
    );
  }

  // Upsert on the (owner_id, connection_id) primary key, so pinning the same
  // pair twice in a run is not an error.
  await asUser(owner, "visibility_overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ owner_id: ownerId, connection_id: rows[0].id, level }),
  });
}

/** Sweeps every Facility the caller owns — the safety net for specs that add them. */
export async function deleteOrgs(user: FixtureUser, namePrefix = "Playwright"): Promise<void> {
  await asUser(user, `orgs?name=like.${encodeURIComponent(`${namePrefix}%`)}`, {
    method: "DELETE",
  });
}

/** Puts every e-mail notification toggle back to its default (on). */
export async function resetNotificationPreferences(user: FixtureUser): Promise<void> {
  await asUser(user, "notification_preferences?user_id=not.is.null", {
    method: "PATCH",
    body: JSON.stringify({
      email_enabled: true,
      booking_window_email_enabled: true,
      connection_request_email_enabled: true,
      connection_accepted_email_enabled: true,
    }),
  });
}

/** Puts the caller's `default_friend_visibility` back to the seeded `calendar` (ADR 0021). */
export async function resetDefaultFriendVisibility(user: FixtureUser): Promise<void> {
  await asUser(user, "profiles?id=not.is.null", {
    method: "PATCH",
    body: JSON.stringify({ default_friend_visibility: "calendar" }),
  });
}

/** Removes the caller's Mailbox Link, so the next test's connect step starts from nothing. */
export async function disconnectMailbox(user: FixtureUser): Promise<void> {
  await asUser(user, "mailbox_links?owner_id=not.is.null", { method: "DELETE" });
}

/**
 * Puts the caller's own profile back to its seeded state — Username to `handle`
 * and Gender unset. settings.spec flips both and has to restore them, and the
 * click-through restore raced the streamed Settings route under load.
 */
export async function resetProfile(user: FixtureUser, handle: string): Promise<void> {
  await asUser(user, "profiles?id=not.is.null", {
    method: "PATCH",
    body: JSON.stringify({ username: handle, gender: null }),
  });
}
