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
 * Unlike `bookings.spec.ts`/`slots.spec.ts` (which only need *any* future
 * date and so can stay fixed for years), the tests here assert the dashboard's
 * *default* Week view — the week containing real "today", per
 * `dashboard-calendar.tsx`'s own live `new Date()` read on mount, not a
 * pinned clock. A fixed date only stays inside that week for a few days
 * before it rolls into the past week (and the `bookings_not_in_the_past`
 * trigger starts rejecting it outright) — `requireTestBookingDate` below
 * recomputes a valid one every run instead.
 */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * Tomorrow — always in the future, and (Saturday aside) always still inside
 * the current calendar week the dashboard defaults to. On a Saturday, no
 * future day is left in that week at all, so the calling test skips rather
 * than asserting something the app was never going to do.
 */
function requireTestBookingDate(): { iso: string; label: string } {
  const now = new Date();
  test.skip(now.getDay() === 6, "no future day is left in the current calendar week on a Saturday");

  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return { iso: isoDate(date), label: MONTH_DAY_YEAR.format(date) };
}

/**
 * Post-#176 (PR #192) the onboarding modal (`OnboardingModal`) opens on the
 * dashboard for anyone with **no Booking and no Slot** — which AMY is, straight
 * out of `npm run seed:users` (the seed creates accounts and friendships only).
 * Its "What do you want to start with?" dialog then sits over the calendar and
 * intercepts every click. These tests are about the calendar, not onboarding
 * (`onboarding.spec.ts` owns that), so write the `localStorage` key
 * `OnboardingModal`'s dismissal snooze uses (`bb-onboarding-snoozed-until`,
 * any future timestamp) before the first paint — the modal reads it in a mount
 * effect, which `addInitScript` (runs before page scripts on every navigation)
 * reliably beats — rather than racing to dismiss the dialog per test.
 */
const ONBOARDING_SNOOZE_KEY = "bb-onboarding-snoozed-until";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, String(Date.now() + 60 * 60 * 1000));
    } catch {
      // Storage disabled — the tests that need the modal gone will surface it.
    }
  }, ONBOARDING_SNOOZE_KEY);

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
  await page.goto("/booking-buddy");

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
  const bookingDate = requireTestBookingDate();
  const place = placeName();
  await addPlace(page, place);
  await logBooking(page, {
    place,
    // formatCourtLabel prepends "Court " for display — the field itself is
    // numbers-only (type="number").
    court: "94",
    date: bookingDate.iso,
    start: "14:00",
    end: "15:00",
  });
  // `logBooking` only clicks — waiting for the logged row is what actually
  // waits out the Server Action's round trip before navigating away.
  await page.getByRole("listitem").filter({ hasText: "Court 94" }).waitFor();

  await page.goto("/booking-buddy");

  // Week view (default) — the block exists in the grid. Scoped with `.first()`:
  // the "Coming up" sidebar (upcoming-bookings.tsx) is server-rendered
  // alongside every view, not just Month, and its own row's accessible name
  // also contains "Court 94" — the calendar grid renders before that sidebar
  // in the DOM, so `.first()` is always the grid's own block, never the
  // sidebar's row.
  const gridChip = page.getByRole("button", { name: /Court 94/ }).first();
  await expect(gridChip).toBeVisible();
  // The sidebar lists it too, soonest-first alongside date/time/duration.
  await expect(page.getByText(bookingDate.label)).toBeVisible();

  // Month view — same Booking, as an inline row rather than a positioned block.
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const monthChip = page.getByRole("button", { name: /Court 94/ }).first();
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
  await expect(page.getByText(bookingDate.label)).toHaveCount(0);

  await removePlace(page, place);
});

test("clicking a Month day switches to Week view centered on that day", async ({ page }) => {
  await page.goto("/booking-buddy");

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
  const bookingDate = requireTestBookingDate();
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy");

  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();

  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByLabel("Court").fill("95");
  await page.getByLabel("Date").fill(bookingDate.iso);
  await page.getByLabel("Start", { exact: true }).selectOption("16:00");
  // End is computed from Start + Duration (issue #57), not its own field.
  await page.getByRole("radio", { name: "1 hour" }).click();
  await page.getByRole("button", { name: "Log booking" }).click();

  // A successful save closes the dialog itself — no manual "Close" needed.
  await expect(page.getByRole("heading", { name: "Log a booking" })).toHaveCount(0);
  await expect(page.getByText(bookingDate.label)).toBeVisible();
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
  const bookingDate = requireTestBookingDate();
  const user = { email: AMY, password: TEST_PASSWORD };
  await deleteAvailabilityWindows(user);

  // Busy declared noon-2pm local (EDT); a Booking then covers 1-2pm of it.
  await insertAvailabilityWindow(user, {
    type: "busy",
    startsAt: `${bookingDate.iso}T16:00:00Z`,
    endsAt: `${bookingDate.iso}T18:00:00Z`,
  });
  // Looking-to-play declared 6-7pm local, with nothing booked over it — should render plainly.
  await insertAvailabilityWindow(user, {
    type: "looking",
    startsAt: `${bookingDate.iso}T22:00:00Z`,
    endsAt: `${bookingDate.iso}T23:00:00Z`,
  });

  const place = placeName();
  await addPlace(page, place);
  await logBooking(page, {
    place,
    court: "97",
    date: bookingDate.iso,
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
  // The unrelated Looking-to-play declaration, nowhere near a Booking, renders untouched.
  await expect(page.locator('[title^="Looking to play: 6:00 PM"]')).toHaveCount(1);

  await removePlace(page, place);
  await deleteAvailabilityWindows(user);
});
