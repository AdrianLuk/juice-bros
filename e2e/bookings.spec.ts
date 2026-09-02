import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import {
  PREFIX,
  addPlace,
  editBooking,
  logBooking,
  placeName,
  removePlace,
  row,
  selectDuration,
} from "./support/places.ts";
import { deleteOrgs } from "./support/db-reset.ts";

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
test.beforeEach(async ({ page, accounts }) => {
  await signIn(page, accounts.amy.email, "/booking-buddy/orgs");
});

/**
 * Sweeps up anything a failed run left behind — straight at Postgres (removing
 * an Org cascades its Bookings away), since under parallel load the
 * click-through sweep raced `revalidatePath`. Each test still removes its own
 * place through the UI as part of what it asserts; this is only the safety net.
 */
test.afterEach(async ({ accounts }) => {
  await deleteOrgs({ email: accounts.amy.email, password: accounts.password }, PREFIX);
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

test("a booking's name and court can be edited, in place on the Bookings list row", async ({
  page,
}) => {
  const place = placeName();
  const originalName = `${PREFIX} Rally ${Date.now()}`;
  const updatedName = `${PREFIX} Updated ${Date.now()}`;

  await addPlace(page, place);
  await logBooking(page, {
    place,
    name: originalName,
    court: "95",
    date: "2026-09-15",
    start: "18:00",
    end: "19:00",
  });

  await editBooking(page, "Court 95", { name: updatedName, court: "96" });

  await expect(row(page, "Court 95")).toHaveCount(0);
  const booking = row(page, "Court 96");
  await expect(booking).toContainText(updatedName);
  await expect(booking).not.toContainText(originalName);
  await expect(booking).toContainText(place);

  await removePlace(page, place);
});

test("a booking's notes can be added, shown in its details modal, and edited", async ({
  page,
}) => {
  const place = placeName();
  const originalNotes = `${PREFIX} bring extra balls`;
  const updatedNotes = `${PREFIX} court has a wobbly net`;

  await addPlace(page, place);
  await logBooking(page, {
    place,
    court: "94",
    date: "2026-09-15",
    start: "18:00",
    end: "19:00",
    notes: originalNotes,
  });

  const booking = row(page, "Court 94");
  // Not shown on the compact list row itself — only in the details modal.
  await expect(booking).not.toContainText(originalNotes);

  await booking.getByRole("button", { name: "View" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText(originalNotes);
  await modal.getByRole("button", { name: "Close" }).click();

  await editBooking(page, "Court 94", { notes: updatedNotes });
  await booking.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("dialog")).toContainText(updatedNotes);
  await expect(page.getByRole("dialog")).not.toContainText(originalNotes);

  await removePlace(page, place);
});

test("a booking's players can be added, edited, and removed via the Edit dialog (issue #101)", async ({
  page,
}) => {
  const place = placeName();
  const playerOne = `${PREFIX} Player One`;
  const playerTwo = `${PREFIX} Player Two`;
  const playerThree = `${PREFIX} Player Three`;

  await addPlace(page, place);
  await logBooking(page, {
    place,
    court: "97",
    date: "2026-09-15",
    start: "18:00",
    end: "19:00",
    players: `${playerOne}, ${playerTwo}`,
  });

  const booking = row(page, "Court 97");
  await expect(booking).toContainText(playerOne);
  await expect(booking).toContainText(playerTwo);

  // Drops playerTwo, keeps playerOne unchanged, and adds a brand-new name.
  await editBooking(page, "Court 97", { players: `${playerOne}, ${playerThree}` });

  await expect(booking).toContainText(playerOne);
  await expect(booking).toContainText(playerThree);
  await expect(booking).not.toContainText(playerTwo);

  await removePlace(page, place);
});

test("a booking that runs past midnight can be logged", async ({ page }) => {
  // Games routinely run 9pm–midnight or 10pm–1am. The End clock reads earlier
  // than the Start, and the form marks it "Next day" rather than refusing it.
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy/bookings");
  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByLabel("Court").fill("91");
  await page.getByLabel("Date").fill("2026-09-15");
  await page.getByLabel("Start").selectOption("22:00");
  await selectDuration(page, "22:00", "01:00");

  await expect(page.getByText("Next day")).toBeVisible();
  await page.getByRole("button", { name: "Log booking" }).click();

  const booking = row(page, "Court 91");
  await expect(booking).toContainText("Sep 15, 2026");
  await expect(booking).toContainText("10:00");
  await expect(booking).toContainText("1:00");

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

test("another User sees none of it", async ({ page, browser, accounts }) => {
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
    await signIn(bens, accounts.ben.email, "/booking-buddy/orgs");
    await expect(row(bens, place)).toHaveCount(0);

    await bens.goto("/booking-buddy/bookings");
    await expect(row(bens, "Court 93")).toHaveCount(0);
  } finally {
    await bensContext.close();
  }

  await removePlace(page, place);
});
