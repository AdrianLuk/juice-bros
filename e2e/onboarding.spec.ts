import { expect, test, type Locator, type Page } from "@playwright/test";

import { signUp } from "./support/sign-in.ts";
import { GooglePlacesMock, deleteCachedPlaces } from "./support/google-places-mock.ts";

/**
 * The Onboarding modal (issue #103) — shown on the dashboard whenever the
 * signed-in User has zero Orgs. Every test here signs up a brand-new,
 * throwaway account (`signUp`) rather than reusing one of the fixed seeded
 * accounts: a fresh signup naturally starts at zero Facilities, with no risk
 * of another suite's Facility-count drift against a shared fixture
 * (places.spec.ts/dashboard.spec.ts/bookings.spec.ts all add and remove Orgs
 * against the seeded accounts, sometimes mid-test).
 */

const PREFIX = "OnboardingPlaywright";

const uniqueEmail = () =>
  `onboarding-playwright-${Date.now()}${Math.random().toString(36).slice(2, 8)}@example.com`;

const uniqueName = (suffix = "") =>
  `${PREFIX} ${Date.now()}${Math.random().toString(36).slice(2, 6)}${suffix}`;

function modal(page: Page): Locator {
  return page.getByRole("dialog");
}

function modalHeading(page: Page) {
  return page.getByRole("heading", { name: "Add your first facility" });
}

/**
 * A row in the modal's own "Added so far" list — distinguished from a still-
 * on-screen search-candidate row (also a `listitem`, same text) by the
 * absence of its "Add this facility" button, same disambiguation
 * `places.spec.ts`'s `orgRow`/`candidateRow` use for the same reason.
 */
function addedRow(page: Page, text: string): Locator {
  return modal(page)
    .getByRole("listitem")
    .filter({ hasText: text })
    .filter({ hasNot: page.getByRole("button", { name: "Add this facility" }) });
}

async function addByHand(page: Page, name: string) {
  // The disclosure is a plain HTML <details>, not React state — clicking its
  // summary a second time (adding a second Facility in one sitting) would
  // toggle it shut again, so only open it if it isn't already.
  const facilityName = page.getByLabel("Facility name");
  if (!(await facilityName.isVisible())) {
    await page.getByText("Can't find your facility?").click();
  }
  await facilityName.fill(name);
  await page.getByRole("button", { name: "Add facility" }).click();
  await expect(addedRow(page, name)).toBeVisible();
}

let mock: GooglePlacesMock;

test.beforeAll(async () => {
  mock = new GooglePlacesMock();
  await mock.start();
});

test.afterAll(async () => {
  // Same reasoning as places.spec.ts's own afterAll: the app has no way to
  // evict a cached Place (ADR 0005), so anything this suite caches has to be
  // cleaned up directly or pgTAP's row-count assertions on place_cache drift.
  await deleteCachedPlaces(mock.cacheablePlaceIds());
  await mock.stop();
});

test("the modal appears on the dashboard for a zero-Facility User", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();
});

test("adding a Facility by hand appends it to the modal's own list, and Done closes the modal", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();

  await addByHand(page, uniqueName());

  await modal(page).getByRole("button", { name: "Done" }).click();
  await expect(modalHeading(page)).toHaveCount(0);
});

test("adding a Facility via the search flow appends it identically", async ({ page }) => {
  const query = uniqueName();
  const placeId = `mock-${query}`;
  const address = "123 Onboarding Street, Toronto, ON";

  mock.registerSearch(query, [{ placeId, name: query, formattedAddress: address }]);
  mock.registerDetails(placeId, {
    placeId,
    name: query,
    formattedAddress: address,
    latitude: 43.7,
    longitude: -79.4,
  });

  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();

  await page.getByLabel("Search for your facility").fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Add this facility" }).click();

  await expect(addedRow(page, query)).toBeVisible();
});

test("more than one Facility can be added in the same sitting before Done", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();

  const first = uniqueName("-a");
  const second = uniqueName("-b");

  await addByHand(page, first);
  await addByHand(page, second);

  await expect(addedRow(page, first)).toBeVisible();
  await expect(addedRow(page, second)).toBeVisible();

  await modal(page).getByRole("button", { name: "Done" }).click();
  await expect(modalHeading(page)).toHaveCount(0);
});

test("Gender can be set from the modal, and it sticks the same way Settings' does", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();

  await modal(page).getByRole("radio", { name: "Female" }).click();
  await modal(page).getByRole("button", { name: "Save gender" }).click();
  await expect(modal(page).getByRole("status")).toContainText("Saved");

  // Not just the optimistic form state — it survives a fresh read, exactly
  // like the Settings gender form's own equivalent assertion.
  await page.reload();
  await expect(modal(page).getByRole("radio", { name: "Female" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("finishing with zero Facilities added is allowed, via the same explicit Done", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();

  await modal(page).getByRole("button", { name: "Done" }).click();
  await expect(modalHeading(page)).toHaveCount(0);
});

test("dismissing with zero Facilities added still shows the modal on the next dashboard load", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();

  await modal(page).getByRole("button", { name: "Done" }).click();
  await expect(modalHeading(page)).toHaveCount(0);

  await page.reload();
  await expect(modalHeading(page)).toBeVisible();
});

test("once a Facility exists, the modal no longer appears on a later dashboard load", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(modalHeading(page)).toBeVisible();

  await addByHand(page, uniqueName());
  await modal(page).getByRole("button", { name: "Done" }).click();

  await page.reload();
  await expect(modalHeading(page)).toHaveCount(0);

  // The Log-a-Booking fallback is untouched by this feature — sanity-check
  // that the dashboard's quick-add no longer shows the "add a place first"
  // message either, now that a Facility actually exists.
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByText("add a place you play first")).toHaveCount(0);
});
