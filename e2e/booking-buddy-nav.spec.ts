import { expect, test } from "@playwright/test";

import { BEN, signIn } from "./support/sign-in.ts";

/**
 * The two-tier navigation (ADR 0016): a desktop top bar with section dropdowns,
 * a mobile bottom tab bar, a sibling pill row under section headings, and Sign
 * out moved off the nav onto the Settings page.
 *
 * Read-only — every test just signs in and navigates, so it's safe to run
 * against the shared `BEN` account alongside the rest of the suite.
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

test("desktop: the active section is marked and its dropdown exposes the siblings", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await signIn(page, BEN, "/booking-buddy/friends");

  const bar = page.locator("header");
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("link", { name: "Booking Buddy" })).toBeVisible();

  // Standalone shell — the marketing site footer is gone.
  await expect(page.getByText("All rights reserved")).toHaveCount(0);

  // Friends is the active section.
  await expect(
    bar.getByRole("link", { name: "Friends" }).first(),
  ).toHaveAttribute("aria-current", "page");

  // Its child "Groups" is hidden until the trigger is hovered.
  const groups = bar.getByRole("link", { name: "Groups" });
  await expect(groups).toBeHidden();
  await bar.getByRole("link", { name: "Friends" }).first().hover();
  await expect(groups).toBeVisible();
});

test("desktop: Facilities has moved under the Settings dropdown", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await signIn(page, BEN, "/booking-buddy/settings");

  const bar = page.locator("header");

  // Facilities is no longer a child of Bookings.
  await bar.getByRole("link", { name: "Bookings" }).first().hover();
  await expect(bar.getByRole("link", { name: "Facilities" })).toBeHidden();

  // It's exposed by the Settings dropdown in the account cluster.
  const facilities = bar.getByRole("link", { name: "Facilities" });
  await bar.getByRole("link", { name: "Settings" }).first().hover();
  await expect(facilities).toBeVisible();
});

test("mobile: a bottom tab bar replaces the top bar, with all five sections", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  // A section page, not the dashboard — the onboarding modal there sets
  // `aria-hidden` on the rest of the page, nav included.
  await signIn(page, BEN, "/booking-buddy/friends");

  await expect(page.locator("header")).toBeHidden();

  const tabs = page.getByRole("navigation", { name: "Booking Buddy", exact: true });
  await expect(tabs).toBeVisible();
  for (const name of ["Dashboard", "Plan", "Bookings", "Friends", "Settings"]) {
    await expect(tabs.getByRole("link", { name })).toBeVisible();
  }
});

test("the sibling pill row shows on a section page and is absent on the dashboard", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await signIn(page, BEN, "/booking-buddy/orgs");

  const pills = page.getByRole("navigation", { name: "Section" });
  await expect(pills.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(pills.getByRole("link", { name: "Facilities" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto("/booking-buddy");
  await expect(page.getByRole("navigation", { name: "Section" })).toHaveCount(0);
});

test("Sign out is off the nav and reachable from the Settings page", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await signIn(page, BEN, "/booking-buddy/settings");

  await expect(
    page.locator("header").getByRole("button", { name: "Sign out" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign out of Booking Buddy?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay signed in" }).click();
});
