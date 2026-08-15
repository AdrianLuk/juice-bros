import { expect, test, type Locator, type Page } from "@playwright/test";

import { AMY, BEN, signIn } from "./support/sign-in.ts";

/**
 * The Org → Booking journey, clicked rather than asserted against the database.
 *
 * Everything these tests make is named with a unique suffix and removed at the
 * end. Removing an Org cascades its Bookings away, so sweeping the places is
 * enough to sweep the bookings too.
 *
 * Only hand-named Orgs appear here — the Google-backed path (search, pick,
 * cache) is e2e/places.spec.ts. `addPlace` opens the "Can't find your club?"
 * disclosure first: the hand-typed form lives inside it now.
 */
const PREFIX = "Playwright";

const placeName = (suffix = "") =>
  `${PREFIX} ${Date.now()}${Math.random().toString(36).slice(2, 6)}${suffix}`;

/** A row in either list — both pages render `<ul><li>`. */
function row(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}

async function addPlace(page: Page, name: string) {
  await page.goto("/booking-buddy/orgs");
  await page.getByText("Can't find your club?").click();
  await page.getByLabel("Place name").fill(name);
  await page.getByRole("button", { name: "Add place" }).click();
  await expect(row(page, name)).toBeVisible();
}

async function removePlace(page: Page, name: string) {
  await page.goto("/booking-buddy/orgs");
  await row(page, name).getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Remove place" }).click();
  await expect(row(page, name)).toHaveCount(0);
}

async function logBooking(
  page: Page,
  booking: {
    place: string;
    court: string;
    date: string;
    start: string;
    end: string;
    zone: string;
  },
) {
  await page.goto("/booking-buddy/bookings");
  await page.getByLabel("Where").selectOption({ label: booking.place });
  await page.getByLabel("Court").fill(booking.court);
  await page.getByLabel("Date").fill(booking.date);
  await page.getByLabel("Time zone").selectOption(booking.zone);
  await page.getByLabel("Start").fill(booking.start);
  await page.getByLabel("End").fill(booking.end);
  await page.getByRole("button", { name: "Log booking" }).click();
}

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
    await page.getByRole("button", { name: "Remove place" }).click();
    await expect(strays).toHaveCount(left - 1);
  }
});

test("a place can be added, booked at, and removed again", async ({ page }) => {
  const place = placeName();

  await addPlace(page, place);

  await logBooking(page, {
    place,
    court: "Court 3",
    date: "2026-09-15",
    start: "18:00",
    end: "19:30",
    zone: "America/Toronto",
  });

  const booking = row(page, "Court 3");
  await expect(booking).toContainText(place);
  await expect(booking).toContainText("Sep 15, 2026");
  await expect(booking).toContainText("6:00");
  await expect(booking).toContainText("7:30");

  // Removing the place takes the booking with it — the cascade is in the
  // schema, and this is the only place it gets clicked.
  await removePlace(page, place);
  await page.goto("/booking-buddy/bookings");
  await expect(row(page, "Court 3")).toHaveCount(0);
});

test("a booking is shown on the clock it was entered on", async ({ page }) => {
  const place = placeName();
  await addPlace(page, place);

  // A zone the machine running this is very unlikely to be in. Six o'clock
  // typed in Tokyo has to read back as six o'clock — that round trip is the
  // entire reason `bookings.time_zone` exists, and getting it wrong is
  // invisible until somebody shows up hours late.
  await logBooking(page, {
    place,
    court: "Tokyo court",
    date: "2026-09-15",
    start: "18:00",
    end: "20:00",
    zone: "Asia/Tokyo",
  });

  const booking = row(page, "Tokyo court");
  await expect(booking).toContainText("Sep 15, 2026");
  await expect(booking).toContainText("6:00");
  await expect(booking).toContainText("8:00");

  await removePlace(page, place);
});

test("a booking cannot end before it starts", async ({ page }) => {
  const place = placeName();
  await addPlace(page, place);

  await logBooking(page, {
    place,
    court: "Backwards court",
    date: "2026-09-15",
    start: "19:30",
    end: "18:00",
    zone: "America/Toronto",
  });

  await expect(
    page.getByRole("alert").filter({ hasText: "after the start time" }),
  ).toBeVisible();
  await expect(row(page, "Backwards court")).toHaveCount(0);

  await removePlace(page, place);
});

test("the same place cannot be added twice", async ({ page }) => {
  const place = placeName();

  await addPlace(page, place);

  // Case-insensitively: "rally point" is not a second club.
  await page.getByLabel("Place name").fill(place.toUpperCase());
  await page.getByRole("button", { name: "Add place" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "already added" }),
  ).toBeVisible();

  await removePlace(page, place);
});

test("another User sees none of it", async ({ page, browser }) => {
  const place = placeName();

  await addPlace(page, place);
  await logBooking(page, {
    place,
    court: "Private court",
    date: "2026-09-15",
    start: "18:00",
    end: "19:30",
    zone: "America/Toronto",
  });
  await expect(row(page, "Private court")).toBeVisible();

  // Ben is an accepted Connection of Amy's, and that grants him nothing here: a
  // Booking reaches a friend only through a Slot it has been attached to. RLS
  // is what enforces it — this only proves the app never routes around it.
  const bensContext = await browser.newContext();
  const bens = await bensContext.newPage();

  try {
    await signIn(bens, BEN, "/booking-buddy/orgs");
    await expect(row(bens, place)).toHaveCount(0);

    await bens.goto("/booking-buddy/bookings");
    await expect(row(bens, "Private court")).toHaveCount(0);
  } finally {
    await bensContext.close();
  }

  await removePlace(page, place);
});
