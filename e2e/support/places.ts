import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Clicking a hand-named Org into existence, and a Booking under it.
 *
 * Shared by bookings.spec.ts (where these journeys are the subject) and
 * slots.spec.ts (where a Booking is only the fixture an attach needs). The
 * Google-backed path is places.spec.ts's and deliberately isn't here.
 */

/** Everything these helpers create is named with this prefix, so strays are sweepable. */
export const PREFIX = "Playwright";

export const placeName = (suffix = "") =>
  `${PREFIX} ${Date.now()}${Math.random().toString(36).slice(2, 6)}${suffix}`;

/** A row in any of these lists — every page renders `<ul><li>`. */
export function row(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}

/** Opens the "Can't find your club?" disclosure first — the hand-typed form lives inside it. */
export async function addPlace(page: Page, name: string) {
  await page.goto("/booking-buddy/orgs");
  await page.getByText("Can't find your club?").click();
  await page.getByLabel("Place name").fill(name);
  await page.getByRole("button", { name: "Add place" }).click();
  await expect(row(page, name)).toBeVisible();
}

/** Removing a place cascades its Bookings away, which is what makes it enough cleanup. */
export async function removePlace(page: Page, name: string) {
  await page.goto("/booking-buddy/orgs");
  await row(page, name).getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Remove place" }).click();
  await expect(row(page, name)).toHaveCount(0);
}

export async function logBooking(
  page: Page,
  booking: {
    place: string;
    court: string;
    date: string;
    start: string;
    end: string;
    /** Defaults to whatever the form itself defaults to — doubles. */
    format?: "Doubles" | "Singles";
  },
) {
  await page.goto("/booking-buddy/bookings");
  await page.getByLabel("Facility").selectOption({ label: booking.place });
  await page.getByLabel("Court").fill(booking.court);
  await page.getByLabel("Date").fill(booking.date);
  // On-the-hour slots only (issue #20 follow-up) — these are `<select>`s now,
  // not free-typed times, so a value off the hour grid isn't reachable.
  await page.getByLabel("Start").selectOption(booking.start);
  await page.getByLabel("End").selectOption(booking.end);
  if (booking.format) {
    await page.getByLabel("Format").selectOption({ label: booking.format });
  }
  await page.getByRole("button", { name: "Log booking" }).click();
}
