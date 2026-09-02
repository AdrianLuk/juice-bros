import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  fixtureUserId,
} from "./fixture-token.ts";

/**
 * Availability Windows have a create/delete UI now (the "Availability" page,
 * issue #197, and the dashboard quick-add), but the calendar-rendering tests
 * in `dashboard.spec.ts` need windows at *precise* UTC instants relative to a
 * Booking — something the day/hour-granularity form can't express — so those
 * still seed straight against PostgREST here, the same posture
 * `guest-rsvp-log.ts` takes for a table the app's own UI doesn't otherwise
 * reach directly. Unlike `guest_rsvp_log`, though, `availability_windows` has
 * no `service_role` grant at all (owner-only, per its migration) — so this
 * signs in as the real User first and writes with *their* token, not the
 * service-role key.
 */
async function sessionFor(email: string, password: string): Promise<{ accessToken: string; userId: string }> {
  const user = { email, password };
  const [accessToken, userId] = await Promise.all([fixtureToken(user), fixtureUserId(user)]);
  return { accessToken, userId };
}

/** `owner_id` has no column default (unlike RLS, which only checks whatever is written) — every insert has to name it explicitly, the same way `createBooking` does. */
export async function insertAvailabilityWindow(
  user: { email: string; password: string },
  window: { type: "looking" | "busy"; startsAt: string; endsAt: string },
): Promise<void> {
  const { accessToken, userId } = await sessionFor(user.email, user.password);

  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/availability_windows`, {
    method: "POST",
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      owner_id: userId,
      type: window.type,
      starts_at: window.startsAt,
      ends_at: window.endsAt,
    }),
  });
  if (!res.ok) {
    throw new Error(`inserting an availability window failed: ${res.status} ${await res.text()}`);
  }
}

/** Sweeps every Availability Window the given User owns — the safety-net cleanup for specs that seed them, faster than clicking each one away. */
export async function deleteAvailabilityWindows(user: {
  email: string;
  password: string;
}): Promise<void> {
  const { accessToken } = await sessionFor(user.email, user.password);

  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/availability_windows`);
  // PostgREST requires an explicit filter on delete — "owner_id not null" is
  // true of every row, and RLS already scopes this to the signed-in User's
  // own regardless.
  url.searchParams.set("owner_id", "not.is.null");

  const res = await fetch(url, {
    method: "DELETE",
    headers: { apikey: LOCAL_SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`clearing availability windows failed: ${res.status} ${await res.text()}`);
  }
}
