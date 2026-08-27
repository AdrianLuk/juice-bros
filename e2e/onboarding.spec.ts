import { expect, test, type Locator, type Page } from "@playwright/test";

import { signUp } from "./support/sign-in.ts";

/**
 * The intent-branched Onboarding modal (issue #176, reshaping #103) — shown on
 * the dashboard while the signed-in User has no Booking and no Slot. Every
 * test signs up a brand-new throwaway account (`signUp`): a fresh signup
 * naturally starts with nothing, and localStorage (the dismissal snooze) is
 * per-context, so tests don't leak the snooze into each other.
 *
 * The Google-Places search path into "add a facility" is not re-tested here —
 * `places.spec.ts` covers search → pick → Org end to end, and the branch-A
 * "adding a facility swaps the panel" test below already covers the one
 * onboarding-specific concern (that the modal advances to the booking step).
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

test("track branch: adding a Facility swaps the panel to the booking form", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await chooseTrack(page);

  // Search and hand-typed both on screen, equal weight — no disclosure.
  await expect(page.getByRole("heading", { name: "Add where you play" })).toBeVisible();
  await expect(page.getByLabel("Search for your facility")).toBeVisible();
  await expect(page.getByLabel("Facility name")).toBeVisible();

  await addFacilityByHand(page, uniqueName());

  await expect(
    page.getByRole("heading", { name: "Log your first booking" }),
  ).toBeVisible();
});

test("track branch: logging a booking confirms, and the modal stays gone after", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await chooseTrack(page);
  await addFacilityByHand(page, uniqueName());

  await expect(
    page.getByRole("heading", { name: "Log your first booking" }),
  ).toBeVisible();

  // Facility is preselected (first Org is auto-default). Just a future date.
  await page.getByLabel("Date").fill("2030-06-03");
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

  const date = page.getByLabel("Date");
  const value = await date.inputValue();
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
