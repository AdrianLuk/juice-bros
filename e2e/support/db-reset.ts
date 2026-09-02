/**
 * Direct-Postgres teardown for the parallel browser suite.
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
  type FixtureUser,
} from "./fixture-token.ts";

export type { FixtureUser };

async function asUser(
  user: FixtureUser,
  path: string,
  init: RequestInit,
): Promise<void> {
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
