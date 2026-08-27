import { expect, test, type Page } from "@playwright/test";

import { signUp } from "./support/sign-in.ts";

/**
 * The post-signup empty states (#177) — what a brand-new User sees before
 * they've logged a Booking or posted a Slot. Every test signs up a fresh,
 * throwaway account (same rationale as onboarding.spec.ts): a new account
 * naturally starts with an empty calendar, no Slots and no Connections, with
 * no risk of another suite's fixture drift.
 */

const uniqueEmail = () =>
  `empty-states-playwright-${Date.now()}${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Clears onboarding by adding a Facility the hand-typed way, same flow onboarding.spec.ts drives. */
async function addFacilityByHand(page: Page, name: string) {
  await page.getByText("Can't find your facility?").click();
  await page.getByLabel("Facility name").fill(name);
  await page.getByRole("button", { name: "Add facility" }).click();
  await expect(
    page.getByRole("dialog").getByRole("listitem").filter({ hasText: name }),
  ).toBeVisible();
}

test("the Slots page tells a User with nothing posted what Slots are for", async ({ page }) => {
  await signUp(page, uniqueEmail(), "/booking-buddy/slots");

  await expect(
    page.getByText(
      "Proposed times live here. Post one below and friends reply yes, no, or maybe, before anyone books a court.",
    ),
  ).toBeVisible();
});

test("the dashboard's empty calendar and sidebar point a new User at their first action", async ({
  page,
}) => {
  await signUp(page, uniqueEmail());

  // Onboarding covers the dashboard until the User has a Facility — clear it
  // so the calendar and sidebar underneath are actually on screen.
  await expect(
    page.getByRole("heading", { name: "Add your first facility" }),
  ).toBeVisible();
  await addFacilityByHand(page, `EmptyStates ${Date.now()}`);
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Add your first facility" }),
  ).toHaveCount(0);

  // "Coming up" sidebar — server-rendered alongside every calendar view.
  await expect(page.getByText("Nothing booked yet.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log a court reservation" }),
  ).toBeVisible();

  // Agenda view — the calendar's own empty state, with both first-step CTAs.
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(
    page.getByText(/Your games and bookings show up here/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Log a booking" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Post a time" })).toBeVisible();
});
