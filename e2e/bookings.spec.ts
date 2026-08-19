import { expect, test } from "@playwright/test";

import { AMY, BEN, signIn } from "./support/sign-in.ts";
import {
  PREFIX,
  addPlace,
  logBooking,
  placeName,
  removePlace,
  row,
} from "./support/places.ts";

/**
 * The Org → Booking journey, clicked rather than asserted against the database.
 *
 * Everything these tests make is named with a unique suffix and removed at the
 * end. Removing an Org cascades its Bookings away, so sweeping the places is
 * enough to sweep the bookings too.
 *
 * Only hand-named Orgs appear here — the Google-backed path (search, pick,
 * cache) is e2e/places.spec.ts. `addPlace` opens the "Can't find your facility?"
 * disclosure first: the hand-typed form lives inside it now.
 *
 * A Booking's clock comes from its Org (issue #20), and every hand-named Org
 * defaults to `America/Toronto` — there's no zone field in this form for now
 * (see `DEFAULT_HAND_NAMED_TIME_ZONE` in `orgs.ts`). The property that a
 * Booking renders on its *Org's* clock rather than the viewer's is proven
 * where a non-default zone is actually reachable: `places.spec.ts`'s
 * coordinate-derivation test.
 */
test.beforeEach(async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy/orgs");
});

/**
 * Sweeps up anything a failed run left behind. Each test still removes its own
 * place as part of what it asserts; this is only the safety net.
 */
test.afterEach(async ({ page }) => {
  await page.goto("/booking-buddy/orgs");

  const strays = row(page, PREFIX);

  for (let left = await strays.count(); left > 0; left--) {
    await strays.first().getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Remove facility" }).click();
    await expect(strays).toHaveCount(left - 1);
  }
});

test("a place can be added, booked at, and removed again", async ({ page }) => {
  const place = placeName();

  await addPlace(page, place);

  await logBooking(page, {
    place,
    // formatCourtLabel prepends "Court " for display — the field itself is
    // now numbers-only (type="number"), so the row still reads "Court 3".
    court: "3",
    date: "2026-09-15",
    start: "18:00",
    end: "19:00",
  });

  const booking = row(page, "Court 3");
  await expect(booking).toContainText(place);
  await expect(booking).toContainText("Sep 15, 2026");
  await expect(booking).toContainText("6:00");
  await expect(booking).toContainText("7:00");

  // Removing the place takes the booking with it — the cascade is in the
  // schema, and this is the only place it gets clicked.
  await removePlace(page, place);
  await page.goto("/booking-buddy/bookings");
  await expect(row(page, "Court 3")).toHaveCount(0);
});

test("a booking's name renders on the Bookings list row", async ({ page }) => {
  const place = placeName();
  const name = `${PREFIX} Rally ${Date.now()}`;

  await addPlace(page, place);
  await logBooking(page, {
    place,
    name,
    court: "5",
    date: "2026-09-15",
    start: "18:00",
    end: "19:00",
  });

  const booking = row(page, "Court 5");
  await expect(booking).toContainText(name);
  await expect(booking).toContainText(place);

  await removePlace(page, place);
});

test("a duration that would run past midnight is refused before it's ever submitted", async ({
  page,
}) => {
  // The form's own End field is computed (Start + Duration, issue #57), so
  // "end before start" isn't a state the UI can construct anymore — this is
  // the current equivalent invalid case, and Log booking disables itself
  // rather than letting an overflowing submission reach the server at all.
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy/bookings");
  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByLabel("Court").fill("91");
  await page.getByLabel("Date").fill("2026-09-15");
  await page.getByLabel("Start").selectOption("22:00");
  await page.getByRole("radio", { name: "Custom" }).click();
  await page.getByLabel("Custom duration in hours").fill("3");

  await expect(
    page.getByRole("alert").filter({ hasText: "past midnight" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Log booking" })).toBeDisabled();
  await expect(row(page, "Court 91")).toHaveCount(0);

  await removePlace(page, place);
});

test("a booking cannot be logged for a date that's already passed", async ({ page }) => {
  const place = placeName();
  await addPlace(page, place);

  await logBooking(page, {
    place,
    court: "92",
    date: "2020-01-01",
    start: "18:00",
    end: "19:00",
  });

  await expect(
    page.getByRole("alert").filter({ hasText: "already passed" }),
  ).toBeVisible();
  await expect(row(page, "Court 92")).toHaveCount(0);

  await removePlace(page, place);
});

test("the same place cannot be added twice", async ({ page }) => {
  const place = placeName();

  await addPlace(page, place);

  // Case-insensitively: "rally point" is not a second facility.
  await page.getByLabel("Facility name").fill(place.toUpperCase());
  await page.getByRole("button", { name: "Add facility" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "already added" }),
  ).toBeVisible();

  await removePlace(page, place);
});

test("a place's booking window can be set, and it survives a reload", async ({
  page,
}) => {
  const place = placeName();
  await addPlace(page, place);

  const placeRow = row(page, place);
  // "Days before" is a preset <select> now, not a free-typed number.
  await placeRow.getByLabel("Days before").selectOption("3");
  await placeRow.getByLabel("Time the window opens").selectOption("06:00");
  await placeRow.getByRole("button", { name: "Save" }).click();
  await expect(placeRow).toContainText("Opens 3 days before, at 6:00 AM");

  await page.reload();
  const reloadedRow = row(page, place);
  await expect(reloadedRow.getByLabel("Days before")).toHaveValue("3");
  await expect(reloadedRow.getByLabel("Time the window opens")).toHaveValue("06:00");

  await removePlace(page, place);
});

test("another User sees none of it", async ({ page, browser }) => {
  const place = placeName();

  await addPlace(page, place);
  await logBooking(page, {
    place,
    court: "93",
    date: "2026-09-15",
    start: "18:00",
    end: "19:00",
  });
  await expect(row(page, "Court 93")).toBeVisible();

  // Ben is an accepted Connection of Amy's, and that grants him nothing here: a
  // Booking reaches a friend only through a Slot it has been attached to. RLS
  // is what enforces it — this only proves the app never routes around it.
  const bensContext = await browser.newContext();
  const bens = await bensContext.newPage();

  try {
    await signIn(bens, BEN, "/booking-buddy/orgs");
    await expect(row(bens, place)).toHaveCount(0);

    await bens.goto("/booking-buddy/bookings");
    await expect(row(bens, "Court 93")).toHaveCount(0);
  } finally {
    await bensContext.close();
  }

  await removePlace(page, place);
});
