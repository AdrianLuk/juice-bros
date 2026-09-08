import { expect, test, type Locator, type Page } from "@playwright/test";

import { signUp } from "./support/sign-in.ts";
import { pickDate } from "./support/date-field.ts";

/**
 * The intent-branched Onboarding modal (issue #176, reshaping #103) — shown on
 * the dashboard while the signed-in User has no Booking and no Slot. Every
 * test signs up a brand-new throwaway account (`signUp`): a fresh signup
 * naturally starts with nothing, and localStorage (the dismissal snooze) is
 * per-context, so tests don't leak the snooze into each other.
 *
 * The track branch leads with a CourtReserve calendar feed and offers
 * hand-logging beneath it (issue #471); both paths are covered here. What a
 * connected feed then *pulls in* is `calendar-feed.spec.ts`'s job, against the
 * local ICS mock — including the `?sync=1` arrival this branch hands off to.
 *
 * The Google-Places search path into "add a facility" is not re-tested here —
 * `places.spec.ts` covers search → pick → Org end to end, and the branch-A
 * "adding a facility swaps the panel" test below already covers the one
 * onboarding-specific concern (that the modal advances past the facility step).
 * Keeping the Places mock out of this file also keeps it free of `place_cache`
 * cleanup and the reused-dev-server caveat that mock carries.
 */

const uniqueEmail = () =>
  `onboarding-playwright-${Date.now()}${Math.random().toString(36).slice(2, 8)}@example.com`;

const uniqueName = (suffix = "") =>
  `OnboardingPlaywright ${Date.now()}${Math.random().toString(36).slice(2, 6)}${suffix}`;

function modal(page: Page): Locator {
  return page.getByRole("dialog");
}

function intentHeading(page: Page) {
  return page.getByRole("heading", { name: "What do you want to start with?" });
}

async function chooseTrack(page: Page) {
  await page.getByRole("button", { name: "Track my court bookings" }).click();
}

async function chooseCoordinate(page: Page) {
  await page.getByRole("button", { name: "Get my group on a time" }).click();
}

/** Adds a Facility the hand-typed way, from the "track" branch's first step. */
async function addFacilityByHand(page: Page, name: string) {
  await page.getByLabel("Facility name").fill(name);
  await page.getByRole("button", { name: "Add facility" }).click();
}

/**
 * Leaves the calendar-feed step for the hand-typed booking form. The feed
 * leads the track branch now (issue #471), so every test that wants the
 * booking form has to say so.
 */
async function logByHand(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Bring your bookings over" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log a booking by hand" }).click();
}

/**
 * A well-formed CourtReserve URL. `setCalendarFeedUrl` validates the host and
 * scheme without fetching anything, so the feed step can be driven end to end
 * with no ICS mock — and without this suite racing `calendar-feed.spec.ts` for
 * the mock's fixed port. Whether a feed actually *fetches* is that spec's job.
 */
const FEED_URL = "https://app.courtreserve.com/Online/Calendar/Feed/onboarding-token";

test("a fresh account lands on the intent choice, not a form", async ({ page }) => {
  await signUp(page, uniqueEmail());

  await expect(intentHeading(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Track my court bookings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Get my group on a time" }),
  ).toBeVisible();
  // No data-entry form until an intent is picked.
  await expect(page.getByLabel("Facility name")).toHaveCount(0);
  await expect(page.getByLabel("Search for your facility")).toHaveCount(0);
});

test("choosing an intent reveals the persistent friend-search footer", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await chooseCoordinate(page);

  await expect(page.getByText("Add the people you play with")).toBeVisible();
  await expect(modal(page).getByRole("heading", { name: "Find a friend" })).toBeVisible();
});

test("track branch: adding a Facility swaps the panel to the calendar feed", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await chooseTrack(page);

  // Search and hand-typed both on screen, equal weight — no disclosure.
  await expect(page.getByRole("heading", { name: "Add where you play" })).toBeVisible();
  await expect(page.getByLabel("Search for your facility")).toBeVisible();
  await expect(page.getByLabel("Facility name")).toBeVisible();

  const facility = uniqueName();
  await addFacilityByHand(page, facility);

  // The feed leads (issue #471), named for the facility just added, with
  // hand-logging offered rather than hidden.
  await expect(
    page.getByRole("heading", { name: "Bring your bookings over" }),
  ).toBeVisible();
  await expect(modal(page)).toContainText(facility);
  await expect(page.getByLabel("Calendar feed link")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect feed" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Log a booking by hand" }),
  ).toBeVisible();
});

test("track branch: the two import paths each offer the other", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await chooseTrack(page);
  await addFacilityByHand(page, uniqueName());

  await logByHand(page);
  await expect(
    page.getByRole("heading", { name: "Log your first booking" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Paste your calendar feed instead" }).click();
  await expect(page.getByLabel("Calendar feed link")).toBeVisible();
});

test("track branch: connecting a feed hands off to the Bookings review", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await chooseTrack(page);
  const facility = uniqueName();
  await addFacilityByHand(page, facility);

  await page.getByLabel("Calendar feed link").fill(FEED_URL);
  await page.getByRole("button", { name: "Connect feed" }).click();

  await expect(
    page.getByRole("heading", { name: "Your feed is saved" }),
  ).toBeVisible();
  await expect(modal(page)).toContainText(facility);

  // The handoff lands on the sync already running, not on another button.
  await expect(
    page.getByRole("link", { name: "See what's on your feed" }),
  ).toHaveAttribute("href", "/booking-buddy/bookings?sync=1#sync");

  // Still no Booking — the feed's reservations are a review, not the result
  // (issue #464) — so the modal is still owed on the next load, one step on.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What do you want to start with?" }),
  ).toBeVisible();
  await chooseTrack(page);
  await expect(
    page.getByRole("heading", { name: "Your feed is saved" }),
  ).toBeVisible();
});

test("track branch: the handoff step still offers hand-logging", async ({ page }) => {
  // Saving a feed creates no Booking, so without this a User whose feed
  // carries nothing upcoming would meet the handoff on every dashboard visit
  // with no way to finish onboarding.
  await signUp(page, uniqueEmail());
  await chooseTrack(page);
  await addFacilityByHand(page, uniqueName());

  await page.getByLabel("Calendar feed link").fill(FEED_URL);
  await page.getByRole("button", { name: "Connect feed" }).click();
  await expect(
    page.getByRole("heading", { name: "Your feed is saved" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Log a booking by hand" }).click();
  await expect(
    page.getByRole("heading", { name: "Log your first booking" }),
  ).toBeVisible();
  // The feed is already saved, so the hand step doesn't offer it back.
  await expect(
    page.getByRole("button", { name: "Paste your calendar feed instead" }),
  ).toHaveCount(0);
});

test("track branch: a bad feed URL is rejected inline and the step stays put", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await chooseTrack(page);
  await addFacilityByHand(page, uniqueName());

  await page.getByLabel("Calendar feed link").fill("https://example.com/feed.ics");
  await page.getByRole("button", { name: "Connect feed" }).click();

  await expect(modal(page).getByRole("alert")).toContainText(/CourtReserve/i);
  await expect(page.getByLabel("Calendar feed link")).toBeVisible();
});

test("track branch: logging a booking confirms, and the modal stays gone after", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await chooseTrack(page);
  await addFacilityByHand(page, uniqueName());
  await logByHand(page);

  await expect(
    page.getByRole("heading", { name: "Log your first booking" }),
  ).toBeVisible();

  // Facility is preselected (first Org is auto-default). Just a future date.
  await pickDate(page, "2030-06-03");
  await page.getByRole("button", { name: "Log booking" }).click();

  await expect(
    page.getByRole("heading", { name: "It's on your calendar" }),
  ).toBeVisible();
  await modal(page).getByRole("button", { name: "Done" }).click();
  await expect(modal(page)).toHaveCount(0);

  await page.reload();
  await expect(modal(page)).toHaveCount(0);
});

test("coordinate branch: the slot form is prefilled to next Monday 8pm", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await chooseCoordinate(page);

  await expect(page.getByRole("heading", { name: "Post a time" })).toBeVisible();

  // The Date field posts through a hidden `input[name="date"]` — the visible
  // control is a calendar-popover trigger now (issue #364), not a text input.
  const value = await page.locator('input[name="date"]').inputValue();
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // Whatever "next Monday" resolves to, it's a Monday and it's in the future.
  const parsed = new Date(`${value}T00:00:00`);
  expect(parsed.getDay()).toBe(1);
  expect(parsed.getTime()).toBeGreaterThan(Date.now());

  await expect(page.getByLabel("Start")).toHaveValue("20:00");
});

test("coordinate branch: posting a slot moves to the share step, and the modal stays gone", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await chooseCoordinate(page);

  await expect(page.getByRole("heading", { name: "Post a time" })).toBeVisible();
  await page.getByRole("button", { name: "Post game" }).click();

  await expect(
    page.getByRole("heading", { name: "Send it to your group" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create invite link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View your game" })).toBeVisible();

  await page.reload();
  await expect(modal(page)).toHaveCount(0);
});

test("Gender lives in the coordinate branch only, collapsed", async ({ page }) => {
  await signUp(page, uniqueEmail());

  // Not in the track branch at all.
  await chooseTrack(page);
  await expect(
    page.getByText("Show men's / women's / mixed sign-up counts"),
  ).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Female" })).toHaveCount(0);

  await page.reload();
  await expect(intentHeading(page)).toBeVisible();
  await chooseCoordinate(page);

  // Present in the coordinate branch, but collapsed — the radios are in the
  // DOM (native <details>) yet not visible until the disclosure is opened.
  const disclosure = page.locator("summary", {
    hasText: "Show men's / women's / mixed sign-up counts",
  });
  await expect(disclosure).toBeVisible();
  await expect(page.getByRole("radio", { name: "Female" })).toBeHidden();

  // Toggle it open via the keyboard — the modal is tall enough that a hit-
  // tested click on an element at the scroll boundary is flaky, and this is
  // native <details> behaviour, not app logic under test.
  await disclosure.focus();
  await disclosure.press("Enter");
  await expect(page.getByRole("radio", { name: "Female" })).toBeVisible();
});

test("dismissing snoozes it — it doesn't reappear on the next load", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(intentHeading(page)).toBeVisible();

  await modal(page).getByRole("button", { name: "Close" }).click();
  await expect(modal(page)).toHaveCount(0);

  await page.reload();
  await expect(modal(page)).toHaveCount(0);

  // Clearing the snooze brings it back — proving it was the snooze suppressing it.
  await page.evaluate(() => window.localStorage.removeItem("bb-onboarding-snoozed-until"));
  await page.reload();
  await expect(intentHeading(page)).toBeVisible();
});
