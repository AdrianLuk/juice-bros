import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { pickDate, expectDate } from "./support/date-field.ts";
import {
  PREFIX,
  addPlace,
  logBooking,
  placeName,
  removePlace,
  selectDuration,
} from "./support/places.ts";
import { deleteAvailabilityWindows, insertAvailabilityWindow } from "./support/availability.ts";
import { deleteOrgs } from "./support/db-reset.ts";

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

/** Matches `dayLabel` in `calendar.ts` — the Week-view quick-create `+`'s accessible name reads "Log a booking on <this> at <hour>". */
const WEEKDAY_MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
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
 * dashboard for anyone with **no Booking and no Slot** — which every worker's Amy is, straight
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

test.beforeEach(async ({ page, accounts }) => {
  await page.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, String(Date.now() + 60 * 60 * 1000));
    } catch {
      // Storage disabled — the tests that need the modal gone will surface it.
    }
  }, ONBOARDING_SNOOZE_KEY);

  await signIn(page, accounts.amy.email, "/booking-buddy");
});

/**
 * Sweeps up anything a failed run left behind — same convention as
 * `bookings.spec.ts`'s own `afterEach`. Each test still removes its own
 * fixtures as part of what it asserts; this is only the safety net, and it's
 * what stops one failed run from cascading into every run after it (a
 * leftover `Playwright …`-named Org/Booking collides with the next run's
 * fresh one, since both share a court label this suite asserts against).
 */
test.afterEach(async ({ accounts }) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  await deleteAvailabilityWindows(amy);
  // Straight at Postgres (Org delete cascades its Bookings) — the
  // click-through sweep raced `revalidatePath` under parallel load.
  await deleteOrgs(amy, PREFIX);
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

  // Week view (default) — the block exists in the grid. Scoped to the grid's
  // own `role="group"` region: the "Coming up" sidebar (upcoming-bookings.tsx)
  // is server-rendered alongside every view and post-#355 renders *before* the
  // calendar in the DOM. The week chip names itself by facility + time (no room
  // for the court line at that size), so it's found by the facility name.
  const gridChip = page
    .getByRole("group", { name: "Week calendar" })
    .getByRole("button", { name: place, exact: false });
  await expect(gridChip).toBeVisible();
  // The sidebar lists it too, soonest-first alongside date/time/duration.
  await expect(page.getByText(bookingDate.label)).toBeVisible();

  // Month view — same Booking, as an inline row rather than a positioned block.
  // The month chip has room for the court line, so it names "Court 94".
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const monthChip = page
    .getByRole("group", { name: "Month calendar" })
    .getByRole("button", { name: /Court 94/ });
  await expect(monthChip).toBeVisible();

  // Clicking it opens the detail popover — full details, not navigating away.
  await monthChip.click();
  const popoverDetails = page.locator("dl");
  await expect(popoverDetails.getByText("Court", { exact: true })).toBeVisible();
  await expect(popoverDetails.getByText("94", { exact: true })).toBeVisible();
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

  // A day eight from today — always a different week than the one Week view
  // opens on (which is today's) — kept inside the month the Month grid shows
  // by reaching toward whichever end is further away, so its cell is on
  // screen. The component labels each day cell `Go to the week of
  // <Date#toDateString>`.
  const today = new Date();
  const target = new Date(today);
  target.setDate(today.getDate() < 15 ? today.getDate() + 8 : today.getDate() - 8);
  const weekOfTarget = `Go to the week of ${target.toDateString()}`;

  await page.getByRole("button", { name: weekOfTarget }).click();

  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Week view now spans the target's week: its own day-column header carries
  // the same "Go to the week of <target>" label.
  await expect(page.getByRole("button", { name: weekOfTarget })).toBeVisible();
});

test("the quick-add dialog logs a Booking without leaving the dashboard, and closes itself", async ({ page }) => {
  const bookingDate = requireTestBookingDate();
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy");

  await page.getByRole("button", { name: "Log a court" }).click();
  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();

  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByRole("dialog").getByLabel("Court").fill("95");
  await pickDate(page, bookingDate.iso);
  await page.getByLabel("Start", { exact: true }).selectOption("16:00");
  // End is computed from Start + Duration (issue #57), not its own field.
  await page.getByRole("radio", { name: "1 hour" }).click();
  await page.getByRole("button", { name: "Log booking" }).click();

  // A successful save closes the dialog itself — no manual "Close" needed.
  await expect(page.getByRole("heading", { name: "Log a booking" })).toHaveCount(0);
  await expect(page.getByText(bookingDate.label)).toBeVisible();
  // `.first()` is the grid chip: a booking this soon also lands in the
  // server-rendered "Coming up" sidebar, whose row matches /Court NN/ too
  // once it streams in (same reason as the popover test above).
  await expect(page.getByRole("button", { name: /Court 95/ }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/booking-buddy$/);

  await removePlace(page, place);
});

test("the quick-add dialog logs a Booking that runs past midnight", async ({ page }) => {
  const bookingDate = requireTestBookingDate();
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy");

  await page.getByRole("button", { name: "Log a court" }).click();
  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();

  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByRole("dialog").getByLabel("Court").fill("96");
  await pickDate(page, bookingDate.iso);
  await page.getByLabel("Start", { exact: true }).selectOption("22:00");
  await selectDuration(page, "22:00", "01:00");

  // The End clock reads earlier than the Start — the form marks it "Next day"
  // rather than refusing it.
  await expect(page.getByText("Next day")).toBeVisible();
  await page.getByRole("button", { name: "Log booking" }).click();

  // A successful save closes the dialog itself.
  await expect(page.getByRole("heading", { name: "Log a booking" })).toHaveCount(0);
  // `.first()` is the grid chip — see the note in the sibling quick-add test.
  await expect(page.getByRole("button", { name: /Court 96/ }).first()).toBeVisible();

  await removePlace(page, place);
});

test("a Week-view empty-cell + opens the booking dialog prefilled with that day and hour, and the saved chip lands on the grid", async ({
  page,
}) => {
  const bookingDate = requireTestBookingDate();
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy");

  // Week view is the default. Each empty hour row of a non-past day carries a
  // hover-revealed `+` whose accessible name names the day and the hour it
  // would start the booking at.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const plusLabel = `Log a booking on ${WEEKDAY_MONTH_DAY.format(tomorrow)} at 6 PM`;

  await page.getByRole("button", { name: plusLabel }).click();

  // The dialog opens with Date and Start already filled to the clicked cell.
  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();
  await expectDate(page, bookingDate.iso);
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue("18:00");

  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByRole("dialog").getByLabel("Court").fill("98");
  await page.getByRole("radio", { name: "1 hour" }).click();
  await page.getByRole("button", { name: "Log booking" }).click();

  // Saves, closes itself, and the chip is on the grid without a navigation.
  await expect(page.getByRole("heading", { name: "Log a booking" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Court 98/ }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/booking-buddy$/);

  // Re-opening a different cell re-seeds the form — no stale prefill from the
  // first click.
  const plusLabel9am = `Log a booking on ${WEEKDAY_MONTH_DAY.format(tomorrow)} at 9 AM`;
  await page.getByRole("button", { name: plusLabel9am }).click();
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue("09:00");

  await removePlace(page, place);
});

test("a past day in the current week shows no quick-create +", async ({ page }) => {
  const now = new Date();
  test.skip(now.getDay() === 0, "no past day is left in the current calendar week on a Sunday");

  await page.goto("/booking-buddy");

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayPlus = new RegExp(
    `Log a booking on ${WEEKDAY_MONTH_DAY.format(yesterday)} at `,
  );

  // Today still has its `+` rows — proves the grid rendered them at all.
  await expect(
    page.getByRole("button", {
      name: new RegExp(`Log a booking on ${WEEKDAY_MONTH_DAY.format(now)} at `),
    }).first(),
  ).toBeVisible();
  // Yesterday, in the same visible week, has none.
  await expect(page.getByRole("button", { name: yesterdayPlus })).toHaveCount(0);
});

test("a Month-view day-cell + opens the booking dialog prefilled with that date, Start left at the 18:00 default, and the saved chip lands on the grid", async ({
  page,
}) => {
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy");
  await page.getByRole("button", { name: "Month", exact: true }).click();

  // No Saturday skip here (unlike `requireTestBookingDate`): the Month grid
  // always shows tomorrow — it's 6 weeks wide and spills into the next month —
  // so quick-create from it is testable on any weekday.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // The Month `+` mirrors the day number — its accessible name is just the
  // date, with no hour (the form keeps its own 18:00 default).
  const plusLabel = `Log a booking on ${WEEKDAY_MONTH_DAY.format(tomorrow)}`;

  await page.getByRole("button", { name: plusLabel, exact: true }).click();

  await expect(page.getByRole("heading", { name: "Log a booking" })).toBeVisible();
  await expectDate(page, isoDate(tomorrow));
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue("18:00");

  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByRole("dialog").getByLabel("Court").fill("97");
  await page.getByRole("radio", { name: "1 hour" }).click();
  await page.getByRole("button", { name: "Log booking" }).click();

  // Saves, closes itself, and the chip is on the Month grid without a navigation.
  await expect(page.getByRole("heading", { name: "Log a booking" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Court 97/ }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/booking-buddy$/);

  await removePlace(page, place);
});

test("a past day in the current month shows no quick-create +", async ({ page }) => {
  const now = new Date();
  test.skip(
    now.getDate() === 1 && now.getDay() === 0,
    "the month grid starts on today — no past day is visible",
  );

  await page.goto("/booking-buddy");
  await page.getByRole("button", { name: "Month", exact: true }).click();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Today's cell still offers its `+` — proves the grid rendered them at all.
  // A count assertion, not `toBeVisible()`: on a `(hover: hover)` viewport the
  // `+` sits at `opacity: 0` until hover, which Playwright still reports as
  // visible, so only its presence in the DOM is real signal here.
  await expect(
    page.getByRole("button", {
      name: `Log a booking on ${WEEKDAY_MONTH_DAY.format(now)}`,
      exact: true,
    }),
  ).toHaveCount(1);
  // Yesterday, in the same visible month grid, has none.
  await expect(
    page.getByRole("button", {
      name: `Log a booking on ${WEEKDAY_MONTH_DAY.format(yesterday)}`,
      exact: true,
    }),
  ).toHaveCount(0);
});

test("a Booking always renders as busy over an overlapping Availability Window", async ({
  page,
  accounts,
}) => {
  const bookingDate = requireTestBookingDate();
  const user = { email: accounts.amy.email, password: accounts.password };
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
  // `logBooking` only clicks — wait for the logged row before navigating, or
  // the Server Action's round trip races the `goto` and the dashboard renders
  // from before the Booking landed (same as the popover test above).
  await page.getByRole("listitem").filter({ hasText: "Court 97" }).waitFor();

  await page.goto("/booking-buddy");

  // The Booking itself renders (`.first()` is the grid chip — the "Coming up"
  // sidebar row matches /Court 97/ too once it streams in).
  await expect(page.getByRole("button", { name: /Court 97/ }).first()).toBeVisible();
  // Its own span is never also drawn as a Busy Availability block (ADR 0006 — never both).
  await expect(page.locator('[title*="Busy: 1:00 PM"]')).toHaveCount(0);
  // The Busy declaration still surfaces either side of the Booking it doesn't cover.
  await expect(page.locator('[title^="Busy: 12:00 PM"]')).toHaveCount(1);
  // The unrelated Looking-to-play declaration, nowhere near a Booking, renders untouched.
  await expect(page.locator('[title^="Looking to play: 6:00 PM"]')).toHaveCount(1);

  await removePlace(page, place);
  await deleteAvailabilityWindows(user);
});
