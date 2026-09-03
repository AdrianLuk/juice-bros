import { expect, type Page } from "@playwright/test";

import {
  LOCAL_SUPABASE_API_URL,
  LOCAL_SUPABASE_ANON_KEY,
  fixtureToken,
  fixtureUserId,
  type FixtureUser,
} from "./fixture-token.ts";

/**
 * Direct-Postgres seeding / teardown for `calendar-feed.spec.ts`, plus a few
 * page helpers for the Calendar Feed UI (issue #295).
 *
 * A Facility is seeded straight through PostgREST (as the User — `orgs` is
 * owner-only, no `service_role` grant, same posture as `db-reset.ts`) because
 * it's only the fixture the feed field and the sync section hang off, not the
 * thing under test. Everything the ticket actually covers — pasting the URL,
 * "Sync facilities", confirm / dismiss, clearing — goes through the real UI.
 */

const ORGS_PATH = "/booking-buddy/orgs";
const BOOKINGS_PATH = "/booking-buddy/bookings";

/** The `/orgs` list row for a Facility, scoped to one that has finished streaming (its Remove button is present). */
function facilityRow(page: Page, name: string) {
  return page
    .getByRole("listitem")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: "Remove", exact: true }) });
}

/**
 * Pastes a calendar-feed URL into a Facility's field on `/orgs`, saves, and
 * waits for the "configured" state so a following navigation doesn't race the
 * Server Action. Pass `expectError: true` for an invalid URL — it returns as
 * soon as the click lands so the caller can assert the inline error.
 */
export async function setFeedUrlViaForm(
  page: Page,
  facility: string,
  feedUrl: string,
  { expectError = false }: { expectError?: boolean } = {},
) {
  await page.goto(ORGS_PATH);
  const row = facilityRow(page, facility);
  await expect(row).toBeVisible();
  await row.getByLabel("Import from a calendar feed").fill(feedUrl);
  await row.getByRole("button", { name: "Add feed" }).click();
  if (!expectError) {
    await expect(row.getByText("A feed is configured for this facility.")).toBeVisible();
  }
}

/** Clicks "Remove feed" on a Facility's row and waits for the field to come back. */
export async function clearFeedUrlViaForm(page: Page, facility: string) {
  await page.goto(ORGS_PATH);
  const row = facilityRow(page, facility);
  await row.getByRole("button", { name: "Remove feed" }).click();
  await expect(row.getByLabel("Import from a calendar feed")).toBeVisible();
}

/** Clicks "Sync bookings" in the unified sync section on the Bookings page (issue #336). */
export async function syncFacilities(page: Page) {
  await page.goto(BOOKINGS_PATH);
  await page.getByRole("button", { name: "Sync bookings" }).click();
}

/**
 * The unified "Sync bookings" section. The Bookings page nests its content in
 * an outer `<section>`, so filter to the *innermost* match — the one whose
 * heading is a direct child — or list items get double-counted (issue #336).
 */
export function feedSection(page: Page) {
  return page.locator("section:has(> h2)").filter({
    has: page.getByRole("heading", { name: "Sync bookings" }),
  });
}

async function restAsUser<T>(
  user: FixtureUser,
  path: string,
  init: RequestInit & { returnRepresentation?: boolean } = {},
): Promise<T> {
  const token = await fixtureToken(user);
  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.returnRepresentation ? { Prefer: "return=representation" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`calendar-feed seed: ${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/** Creates a hand-named Facility and returns its id. */
export async function seedFacility(
  user: FixtureUser,
  name: string,
  timeZone = "America/Toronto",
): Promise<string> {
  const ownerId = await fixtureUserId(user);
  const rows = await restAsUser<{ id: string }[]>(user, "orgs", {
    method: "POST",
    returnRepresentation: true,
    body: JSON.stringify({ owner_id: ownerId, name, time_zone: timeZone, google_place_id: null }),
  });
  return rows[0].id;
}

/** The caller's Org id for an exact display name — for specs that create the Org through the UI. */
export async function orgIdByName(user: FixtureUser, name: string): Promise<string> {
  const rows = await restAsUser<{ id: string }[]>(
    user,
    `orgs?name=eq.${encodeURIComponent(name)}&select=id`,
    {},
  );
  if (!rows.length) {
    throw new Error(`calendar-feed seed: no Org named "${name}"`);
  }
  return rows[0].id;
}

/** Every Booking the caller holds for one Org, court label + start instant. */
export async function bookingsForOrg(
  user: FixtureUser,
  orgId: string,
): Promise<{ id: string; court_label: string | null; starts_at: string }[]> {
  return restAsUser(user, `bookings?org_id=eq.${orgId}&select=id,court_label,starts_at&order=starts_at`, {});
}

/** Every `org_feed_events` row for one Org. */
export async function feedEventsForOrg(
  user: FixtureUser,
  orgId: string,
): Promise<{ uid: string; status: string; booking_id: string | null; sequence: number }[]> {
  return restAsUser(
    user,
    `org_feed_events?org_id=eq.${orgId}&select=uid,status,booking_id,sequence&order=uid`,
    {},
  );
}

/** Sweeps every Facility the caller owns whose name starts with `prefix` (their feed events + bookings cascade). */
export async function deleteFacilities(user: FixtureUser, prefix: string): Promise<void> {
  await restAsUser(user, `orgs?name=like.${encodeURIComponent(`${prefix}%`)}`, { method: "DELETE" });
}
