import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
} from "./support/on-deck.ts";

/**
 * On Deck: Session pre-creation and Club defaults (issue #254).
 *
 *   - the Organizer edits the Club's saved defaults and they persist;
 *   - the Organizer sets up a Session ahead of time with its own venue / court
 *     count, and one-tap Start opens *that* Session (its values, not the
 *     defaults) once its date has come — including after editing it.
 *
 * A throwaway account per run (never deleted — there is no delete-account
 * feature), following `on-deck.spec.ts`'s posture. The Club is reseeded before
 * each test so the cases don't leak state into each other.
 */
const ORGANIZER_EMAIL = `on-deck-precreate-${Date.now()}@example.com`;
const ORGANIZER_PASSWORD = "pickleball123";

// The Organizer's *local* calendar date — what the home screen's Start control
// keys "due today" off, and what it sends the promote RPC. `sv-SE` → YYYY-MM-DD.
const TODAY = new Date().toLocaleDateString("sv-SE");

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
  await page.close();
});

test.beforeEach(async () => {
  await seedClubForOrganizer(ORGANIZER_EMAIL, {
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
    courtCount: 8,
    groupCap: 4,
    floorMode: "hybrid",
  });
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER_EMAIL);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test("an Organizer edits the Club's saved defaults and they persist", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/on-deck/home");

  await page.getByRole("link", { name: "Edit defaults" }).click();
  await page.waitForURL(/\/on-deck\/home\/settings$/);

  await page.getByLabel("Venue name").fill("Trinity Bellwoods");
  await page.getByLabel("Courts").fill("5");
  await page.getByLabel("Group cap").fill("6");
  await page.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByText("Defaults saved.")).toBeVisible();

  // Persisted: a fresh load of the settings screen shows the new values…
  await page.goto("/on-deck/home/settings");
  await expect(page.getByLabel("Venue name")).toHaveValue("Trinity Bellwoods");
  await expect(page.getByLabel("Courts")).toHaveValue("5");
  await expect(page.getByLabel("Group cap")).toHaveValue("6");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/254-club-settings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/254-club-settings-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  // …and the home screen reflects them for the next one-tap Start.
  await page.goto("/on-deck/home");
  await expect(page.getByText("Trinity Bellwoods")).toBeVisible();
});

test("Start opens a pre-created Session with its own court count, not the defaults", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/on-deck/home");

  await page.getByRole("link", { name: "Schedule a session" }).click();
  await page.waitForURL(/\/on-deck\/home\/sessions\/new$/);

  await page.getByLabel("Date").fill(TODAY);
  await page.getByLabel("Venue name").fill("Christie Pits");
  await page.getByLabel("Courts").fill("3");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/254-schedule-session-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Schedule session" }).click();

  await page.waitForURL(/\/on-deck\/home$/);
  await expect(
    page.getByTestId("scheduled-sessions").getByText("Christie Pits, 3 courts"),
  ).toBeVisible();
  await expect(page.getByText("Start opens this")).toBeVisible();

  await page.screenshot({
    path: "test-results/254-home-scheduled-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/254-home-scheduled-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL(/\/on-deck\/session\/[0-9a-f-]+$/);

  const sessionUrl = page.url();
  await page.goto(`${sessionUrl}/floor`);
  await expect(
    page.getByRole("heading", { name: "Christie Pits" }),
  ).toBeVisible();
  // Court count from the scheduled Session (3), not the Club default (8).
  await expect(page.getByTestId("court-3")).toBeVisible();
  await expect(page.getByTestId("court-4")).toHaveCount(0);
});

test("editing a pre-created Session ahead of time — Start uses the edited values", async ({
  page,
}) => {
  await signIn(page);

  // Schedule for today with the Club default court count…
  await page.goto("/on-deck/home/sessions/new");
  await page.getByLabel("Date").fill(TODAY);
  await page.getByLabel("Venue name").fill("Ramsden Park");
  await page.getByLabel("Courts").fill("8");
  await page.getByRole("button", { name: "Schedule session" }).click();
  await page.waitForURL(/\/on-deck\/home$/);

  // …then edit it down to 2 courts and a different venue.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.waitForURL(/\/on-deck\/home\/sessions\/[0-9a-f-]+$/);
  await expect(page.getByLabel("Courts")).toHaveValue("8");
  await page.getByLabel("Venue name").fill("Dufferin Grove");
  await page.getByLabel("Courts").fill("2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/on-deck\/home$/);
  await expect(
    page.getByTestId("scheduled-sessions").getByText("Dufferin Grove, 2 courts"),
  ).toBeVisible();

  // Start opens the edited Session.
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL(/\/on-deck\/session\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}/floor`);
  await expect(
    page.getByRole("heading", { name: "Dufferin Grove" }),
  ).toBeVisible();
  await expect(page.getByTestId("court-2")).toBeVisible();
  await expect(page.getByTestId("court-3")).toHaveCount(0);
});
