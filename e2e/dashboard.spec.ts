import { expect, test } from "@playwright/test";

import { AMY, TEST_PASSWORD, signIn } from "./support/sign-in.ts";
import { PREFIX, addPlace, logBooking, placeName, removePlace, row } from "./support/places.ts";
import { deleteAvailabilityWindows, insertAvailabilityWindow } from "./support/availability.ts";

/**
 * The dashboard calendar (issue #23) — Month/Week/Agenda toggling, a
 * Booking's popover + confirm-before-remove, click-a-day-to-Week, the
 * quick-add dialog/sheet, and Availability rendering with ADR 0006's "Booking
 * always wins" precedence proven in the browser, not just the resolver
 * (that half is availability.test.ts's).
 *
 * Every Booking here lands on 2026-08-20 (a Thursday inside the default
 * Week/Month range for this app's pinned "today", 2026-08-16) — the same
 * fixed-near-future-date convention `bookings.spec.ts`/`slots.spec.ts`
 * already use, rather than computing dates off a live clock.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy");
});

/**
 * Sweeps up anything a failed run left behind — same convention as
 * `bookings.spec.ts`'s own `afterEach`. Each test still removes its own
 * fixtures as part of what it asserts; this is only the safety net, and it's
 * what stops one failed run from cascading into every run after it (a
 * leftover `Playwright …`-named Org/Booking collides with the next run's
 * fresh one, since both share a court label this suite asserts against).
 */
test.afterEach(async ({ page }) => {
  await deleteAvailabilityWindows({ email: AMY, password: TEST_PASSWORD });

  await page.goto("/booking-buddy/orgs");
  const strays = row(page, PREFIX);
  for (let left = await strays.count(); left > 0; left--) {
    await strays.first().getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Remove facility" }).click();
    await expect(strays).toHaveCount(left - 1);
  }
});

test("the calendar defaults to Week view, and Month/Agenda toggle without navigating away", async ({
  page,
}) => {
  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A Month grid has weekday column headers a Week/Agenda view doesn't.
  await expect(page.getByText("Sun", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(page.getByRole("button", { name: "Agenda", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect(page).toHaveURL(/\/booking-buddy$/);
});

test("a Booking renders on the calendar and in the sidebar, and its popover can remove it", async ({
  page,
}) => {
  const place = placeName();
  await addPlace(page, place);
  await logBooking(page, {
    place,
    // formatCourtLabel prepends "Court " for display — the field itself is
    // numbers-only (type="number").
    court: "94",
    date: "2026-08-20",
    start: "14:00",
    end: "15:00",
  });
  // `logBooking` only clicks — waiting for the logged row is what actually
  // waits out the Server Action's round trip before navigating away.
  await page.getByRole("listitem").filter({ hasText: "Court 94" }).waitFor();

  await page.goto("/booking-buddy");

  // Week view (default) — the block exists in the grid.
  await expect(page.getByRole("button", { name: /Court 94/ })).toBeVisible();
  // The sidebar lists it too, soonest-first alongside date/time/duration.
  await expect(page.getByText("Aug 20, 2026")).toBeVisible();

  // Month view — same Booking, as an inline row rather than a positioned block.
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const monthChip = page.getByRole("button", { name: /Court 94/ });
  await expect(monthChip).toBeVisible();

  // Clicking it opens the detail popover — full details, not navigating away.
  // Scoped to the popover's own <dl>: "Court 94" also labels the chip
  // trigger itself, which stays on screen (and matches /Court 94/)
  // once the popover opens, so an unscoped locator would be ambiguous.
  await monthChip.click();
  const popoverDetails = page.locator("dl");
  await expect(popoverDetails.getByText("Court")).toBeVisible();
  await expect(popoverDetails.getByText("94")).toBeVisible();
  await expect(popoverDetails.getByText("Doubles")).toBeVisible();
  await expect(page).toHaveURL(/\/booking-buddy$/);

  // Confirm-before-remove — same convention as Orgs/Bookings elsewhere.
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("heading", { name: "Remove this booking?" })).toBeVisible();
  await page.getByRole("button", { name: "Remove booking" }).click();

  await expect(page.getByRole("button", { name: /Court 94/ })).toHaveCount(0);
  await expect(page.getByText("Aug 20, 2026")).toHaveCount(0);

  await removePlace(page, place);
});

test("clicking a Month day switches to Week view centered on that day", async ({ page }) => {
  await page.getByRole("button", { name: "Month", exact: true }).click();

  // Aug 27 falls in the week after the one Week view opens on by default
  // (Aug 16-22) — a real switch, not a same-range no-op.
  await page.getByRole("button", { name: "Go to the week of Thu Aug 27 2026" }).click();

  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Aug 23 – 29, 2026")).toBeVisible();
});

test("the quick-add dialog logs a Booking without leaving the dashboard, and closes itself", async ({ page }) => {
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy");

  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();

  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByLabel("Court").fill("95");
  await page.getByLabel("Date").fill("2026-08-20");
  await page.getByLabel("Start", { exact: true }).selectOption("16:00");
  // End is computed from Start + Duration (issue #57), not its own field.
  await page.getByRole("radio", { name: "1 hour" }).click();
  await page.getByRole("button", { name: "Log booking" }).click();

  // A successful save closes the dialog itself — no manual "Close" needed.
  await expect(page.getByRole("heading", { name: "Log a booking" })).toHaveCount(0);
  await expect(page.getByText("Aug 20, 2026")).toBeVisible();
  await expect(page.getByRole("button", { name: /Court 95/ })).toBeVisible();
  await expect(page).toHaveURL(/\/booking-buddy$/);

  await removePlace(page, place);
});

test("a quick-add duration that would run past midnight is refused before it's ever submitted", async ({
  page,
}) => {
  // End is computed (Start + Duration, issue #57), so "end before start"
  // isn't reachable through the UI anymore — this is the current equivalent
  // invalid case, refused live rather than via a round trip that reopens
  // the dialog.
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy");

  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();

  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByLabel("Court").fill("96");
  await page.getByLabel("Date").fill("2026-08-20");
  await page.getByLabel("Start", { exact: true }).selectOption("22:00");
  await page.getByRole("radio", { name: "Custom" }).click();
  await page.getByLabel("Custom duration in hours").fill("3");

  // Refused live, before any submit — the dialog was never asked to close,
  // and every field the User entered is still there, not wiped back to blank.
  await expect(
    page.getByRole("alert").filter({ hasText: "past midnight" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Log booking" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();
  await expect(page.getByLabel("Court")).toHaveValue("96");
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue("22:00");

  await removePlace(page, place);
});

test("a Booking always renders as busy over an overlapping Availability Window", async ({
  page,
}) => {
  const user = { email: AMY, password: TEST_PASSWORD };
  await deleteAvailabilityWindows(user);

  // Busy declared noon-2pm local (EDT); a Booking then covers 1-2pm of it.
  await insertAvailabilityWindow(user, {
    type: "busy",
    startsAt: "2026-08-20T16:00:00Z",
    endsAt: "2026-08-20T18:00:00Z",
  });
  // Open declared 6-7pm local, with nothing booked over it — should render plainly.
  await insertAvailabilityWindow(user, {
    type: "open",
    startsAt: "2026-08-20T22:00:00Z",
    endsAt: "2026-08-20T23:00:00Z",
  });

  const place = placeName();
  await addPlace(page, place);
  await logBooking(page, {
    place,
    court: "97",
    date: "2026-08-20",
    start: "13:00",
    end: "14:00",
  });

  await page.goto("/booking-buddy");

  // The Booking itself renders.
  await expect(page.getByRole("button", { name: /Court 97/ })).toBeVisible();
  // Its own span is never also drawn as a Busy Availability block (ADR 0006 — never both).
  await expect(page.locator('[title*="Busy: 1:00 PM"]')).toHaveCount(0);
  // The Busy declaration still surfaces either side of the Booking it doesn't cover.
  await expect(page.locator('[title^="Busy: 12:00 PM"]')).toHaveCount(1);
  // The unrelated Open declaration, nowhere near a Booking, renders untouched.
  await expect(page.locator('[title^="Open: 6:00 PM"]')).toHaveCount(1);

  await removePlace(page, place);
  await deleteAvailabilityWindows(user);
});
