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

/**
 * Gets the onboarding modal (#176) out of the way so the dashboard beneath it
 * is on screen — dismissing it snoozes it (localStorage), so a reload keeps it
 * gone.
 */
async function dismissOnboarding(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "What do you want to start with?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
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

  // Onboarding covers the dashboard until the User has a Booking or Slot —
  // dismiss it so the calendar and sidebar underneath are actually on screen.
  await dismissOnboarding(page);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // "Upcoming courts" sidebar — server-rendered alongside every calendar view,
  // so once the Agenda is showing its CTA and the Agenda's are both on the
  // page. #407 gave them the same name ("Log a booking"), so each assertion is
  // scoped to the empty state it belongs to rather than matched page-wide.
  const sidebarEmpty = page.getByText("Nothing booked yet.");
  await expect(sidebarEmpty).toBeVisible();
  await expect(sidebarEmpty.getByRole("link", { name: "Log a booking" })).toBeVisible();

  // Agenda view — the calendar's own empty state, with both first-step CTAs.
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  const agendaEmpty = page
    .locator("div.bb-outline")
    .filter({ hasText: "Your games and bookings show up here" });
  await expect(agendaEmpty).toBeVisible();
  await expect(agendaEmpty.getByRole("link", { name: "Log a booking" })).toBeVisible();
  await expect(agendaEmpty.getByRole("link", { name: "Post a time" })).toBeVisible();
});
