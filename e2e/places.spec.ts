import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { GooglePlacesMock, deleteCachedPlaces } from "./support/google-places-mock.ts";

/**
 * The Google Places journey: search → pick a candidate → cached Org appears.
 * Google itself is never called — see `GOOGLE_PLACES_API_BASE_URL` in
 * playwright.config.ts and the caveat in testing.md about a locally reused
 * dev server not picking up the override.
 *
 * Everything made here is named with a unique suffix and removed at the end,
 * same convention as bookings.spec.ts.
 */
const PREFIX = "PlacesPlaywright";

const uniqueName = (suffix = "") =>
  `${PREFIX} ${Date.now()}${Math.random().toString(36).slice(2, 6)}${suffix}`;

/**
 * Any listitem containing this text — safe only right after a fresh
 * `page.goto()`, where the search box's client state has reset and there's no
 * candidate row left to collide with. `orgRow`/`candidateRow` below are for
 * everywhere else, where both lists can be on screen at once.
 */
function row(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}

/** A "Your places" row — the one that means an Org actually exists. */
function orgRow(page: Page, text: string): Locator {
  return row(page, text).filter({ has: page.getByRole("button", { name: "Remove" }) });
}

/**
 * A search-result row — still on screen after a pick (client state doesn't
 * clear itself), so `row()` alone can't tell "picked" from "not yet picked".
 */
function candidateRow(page: Page, text: string): Locator {
  return row(page, text).filter({ has: page.getByRole("button", { name: "Add this facility" }) });
}

async function search(page: Page, query: string) {
  await page.goto("/booking-buddy/orgs");
  await page.getByLabel("Search for your facility").fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
}

async function removePlace(page: Page, name: string) {
  await page.goto("/booking-buddy/orgs");
  // Scope to the row that actually carries a Remove button — the org row.
  // `/orgs` streams behind its skeleton, and on a slow run a bare
  // `row(page, name)` can resolve before that row's button has rendered.
  const target = orgRow(page, name);
  await expect(target).toBeVisible();
  await target.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Remove facility" }).click();
  await expect(row(page, name)).toHaveCount(0);
}

let mock: GooglePlacesMock;

test.beforeAll(async () => {
  mock = new GooglePlacesMock();
  await mock.start();
});

test.afterAll(async () => {
  // The app has no way to evict a cached Place (ADR 0005), so this is the
  // one piece of cleanup that goes straight at Postgres rather than through
  // the UI — without it, place_cache keeps growing across local runs and the
  // pgTAP suite's row-count assertions on that table stop holding.
  await deleteCachedPlaces(mock.cacheablePlaceIds());
  await mock.stop();
});

test.beforeEach(async ({ page, accounts }) => {
  await signIn(page, accounts.amy.email, "/booking-buddy/orgs");
});

/** Sweeps up anything a failed run left behind, same shape as bookings.spec.ts. */
test.afterEach(async ({ page, accounts }) => {
  await page.goto("/booking-buddy/orgs");

  const strays = row(page, PREFIX);
  for (let left = await strays.count(); left > 0; left--) {
    await strays.first().getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Remove facility" }).click();
    await expect(strays).toHaveCount(left - 1);
  }
});

test("picking a search result caches the Place and creates an Org", async ({ page, accounts }) => {
  const query = uniqueName();
  const placeId = `mock-${query}`;
  const address = "123 Mock Street, Toronto, ON";

  mock.registerSearch(query, [{ placeId, name: query, formattedAddress: address }]);
  mock.registerDetails(placeId, {
    placeId,
    name: query,
    formattedAddress: address,
    latitude: 43.7,
    longitude: -79.4,
  });

  await search(page, query);

  const candidate = candidateRow(page, query);
  await expect(candidate).toBeVisible();
  await expect(candidate).toContainText(address);

  await candidate.getByRole("button", { name: "Add this facility" }).click();

  const added = orgRow(page, query);
  await expect(added).toBeVisible();
  await expect(added).toContainText(address);
  await expect(added).toContainText("Powered by Google");

  await removePlace(page, query);
});

test("a place already cached is not re-fetched on a second pick", async ({ page, accounts }) => {
  const query = uniqueName();
  const placeId = `mock-${query}`;
  const address = "456 Mock Avenue, Toronto, ON";
  const place = { placeId, name: query, formattedAddress: address };

  mock.registerSearch(query, [place]);
  mock.registerDetails(placeId, { ...place, latitude: 43.7, longitude: -79.4 });

  // First pick: Details gets called once, and the Org is created.
  await search(page, query);
  await candidateRow(page, query).getByRole("button", { name: "Add this facility" }).click();
  await expect(orgRow(page, query)).toBeVisible();
  expect(mock.detailsRequestCount(placeId)).toBe(1);

  // Removing the Org doesn't evict the cached Place (ADR 0005) — searching
  // and picking the same place_id again should find it fresh and skip
  // Details entirely.
  await removePlace(page, query);

  await search(page, query);
  await candidateRow(page, query).getByRole("button", { name: "Add this facility" }).click();
  await expect(orgRow(page, query)).toBeVisible();
  expect(mock.detailsRequestCount(placeId)).toBe(1);

  await removePlace(page, query);
});

test("Google being unreachable reports it honestly, and the hand-typed fallback still works", async ({
  page,
  accounts,
}) => {
  const query = uniqueName();
  mock.registerSearch(query, "unavailable");

  await search(page, query);

  await expect(
    page.locator("form").getByRole("alert").filter({ hasText: "reach Google" }),
  ).toBeVisible();

  // The disclosure holding the hand-typed path is always in the DOM — no
  // JavaScript needed to reach it, per the acceptance criterion.
  const handTyped = uniqueName("-hand-typed");
  await page.getByText("Can't find your facility?").click();
  await page.getByLabel("Facility name").fill(handTyped);
  await page.getByRole("button", { name: "Add facility" }).click();
  await expect(row(page, handTyped)).toBeVisible();

  await removePlace(page, handTyped);
});

test("a picked place's time zone is derived from its coordinates, no question asked", async ({
  page,
  accounts,
}) => {
  const query = uniqueName();
  const placeId = `mock-${query}`;

  // Vancouver, not Toronto — picked specifically to differ from every other
  // spec's default zone and from most CI runners' local zone, so a passing
  // assertion actually proves the derivation ran rather than coincidentally
  // matching the environment (issue #20).
  mock.registerSearch(query, [
    { placeId, name: query, formattedAddress: "800 Robson St, Vancouver, BC" },
  ]);
  mock.registerDetails(placeId, {
    placeId,
    name: query,
    formattedAddress: "800 Robson St, Vancouver, BC",
    latitude: 49.2827,
    longitude: -123.1207,
  });

  await search(page, query);
  await candidateRow(page, query).getByRole("button", { name: "Add this facility" }).click();
  await expect(orgRow(page, query)).toBeVisible();

  // No time-zone field anywhere in this flow — `pickPlace` derived it
  // server-side. Logging a booking against this Org is the only way to
  // observe the result, since the Orgs list doesn't render a zone.
  await page.goto("/booking-buddy/bookings");
  await page.getByLabel("Facility").selectOption({ label: query });
  // formatCourtLabel prepends "Court " for display — the field itself is
  // numbers-only (type="number"), so the row still reads "Court 98".
  await page.getByLabel("Court").fill("98");
  await page.getByLabel("Date").fill("2026-09-15");
  await page.getByLabel("Start").selectOption("18:00");
  // End is computed from Start + Duration (issue #57), not its own field.
  await page.getByRole("radio", { name: "1 hour" }).click();
  await page.getByRole("button", { name: "Log booking" }).click();

  const booking = row(page, "Court 98");
  await expect(booking).toContainText("6:00");
  await expect(booking).toContainText("7:00");

  await removePlace(page, query);
});

test("a place_id that stops resolving is refused rather than creating a broken Org", async ({
  page,
  accounts,
}) => {
  const query = uniqueName();
  const placeId = `mock-dead-${query}`;

  mock.registerSearch(query, [
    { placeId, name: query, formattedAddress: "789 Mock Road, Toronto, ON" },
  ]);
  mock.registerDetails(placeId, "not_found");

  await search(page, query);
  await candidateRow(page, query).getByRole("button", { name: "Add this facility" }).click();

  await expect(
    page.locator("form").getByRole("alert").filter({ hasText: "isn't listed by Google" }),
  ).toBeVisible();

  // No Org was created for it.
  await page.goto("/booking-buddy/orgs");
  await expect(row(page, query)).toHaveCount(0);
});
