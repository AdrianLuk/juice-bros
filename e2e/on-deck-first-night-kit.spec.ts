import { expect, test } from "@playwright/test";

import {
  deleteClubForOrganizer,
  seedClubForOrganizer,
  seedOpenSession,
} from "./support/on-deck.ts";

/**
 * On Deck: the first-night kit (issue #521, parent #512 / OD-6.8).
 *
 * Two rows on home for a Club that has never closed a Session — put the join
 * link in the group chat, have the code ready for walk-ups — gone the moment
 * the first Session closes, with the same join message resurfacing on that
 * Session's own Summary page for the weekly rhythm after.
 */
const ORGANIZER = `on-deck-kit-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await page.getByLabel("Email").fill(ORGANIZER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
  await page.close();
});

test.afterEach(async () => {
  await deleteClubForOrganizer(ORGANIZER);
});

test("a brand-new Club's home leads with the join link, offers the code with no printer required, and neither the Kiosk nor the Volunteer Link", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedClubForOrganizer(ORGANIZER, {
    name: "Riverside Pickleball",
    venueName: "Riverside Park",
    floorMode: "hybrid",
  });
  await signIn(page);
  await page.goto("/on-deck/home");

  const kit = page.getByTestId("first-night-kit");
  await expect(kit).toBeVisible();
  await expect(
    kit.getByText("Put the join link in your group chat"),
  ).toBeVisible();
  await expect(
    kit.getByText("Have the code ready for walk-ups"),
  ).toBeVisible();
  // No hardware required for either item — printing is offered, not demanded.
  await expect(kit.getByText(/no printer needed/i)).toBeVisible();
  await expect(
    kit.getByRole("link", { name: "Prefer a printed sign?" }),
  ).toBeVisible();

  // Kiosk and the Volunteer Link are capabilities, not setup steps — neither
  // is named on home at all while there is no Session to carry them.
  await expect(page.getByText("Kiosk")).toHaveCount(0);
  await expect(page.getByText("Volunteer Link")).toHaveCount(0);

  // Item one needs no navigation at all — a straight copy, right there.
  await kit.getByRole("button", { name: "Copy the message" }).click();
  await expect(kit.getByRole("button", { name: "Copied" })).toBeVisible();

  // Item two's primary action is the phone-first view (issue #517), not print.
  await kit.getByRole("link", { name: "Show the code" }).click();
  await expect(page).toHaveURL(/\/on-deck\/home\/qr\/hold-up$/);
});

test("the kit disappears once the first Session has closed, and its message resurfaces on that night's Summary", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const clubId = await seedClubForOrganizer(ORGANIZER, {
    name: "Riverside Pickleball",
    venueName: "Riverside Park",
    floorMode: "hybrid",
  });
  const { sessionId } = await seedOpenSession(ORGANIZER, clubId, {
    courtCount: 2,
  });

  await signIn(page);
  await page.goto("/on-deck/home");
  await expect(page.getByTestId("first-night-kit")).toBeVisible();

  // Close the night the way an Organizer would — Last Call, then Close.
  await page.goto(`/on-deck/session/${sessionId}/floor`);
  const wrapUp = page.getByTestId("wrap-up");
  await wrapUp.getByTestId("last-call-button").click();
  await wrapUp.getByTestId("last-call-confirm").click();
  await expect(page.getByTestId("last-call-banner")).toBeVisible();
  await wrapUp.getByTestId("close-session-button").click();
  await wrapUp.getByTestId("close-session-confirm").click();
  await expect(page.getByText("Session closed")).toBeVisible({
    timeout: 10_000,
  });

  // Home no longer shows the kit — a Session has closed for this Club.
  await page.goto("/on-deck/home");
  await expect(page.getByTestId("first-night-kit")).toHaveCount(0);

  // The join message the kit carried is available again on the closed
  // Session's own page, for next week's post.
  await page.getByRole("link", { name: /played .* games/i }).first().click();
  await page.waitForURL(/\/on-deck\/home\/summaries\/[0-9a-f-]+$/);
  const nextWeek = page.getByTestId("next-week-message");
  await expect(nextWeek).toBeVisible();
  await nextWeek.getByRole("button", { name: "Copy the join message" }).click();
  await expect(
    nextWeek.getByRole("button", { name: "Copied" }),
  ).toBeVisible();
});
