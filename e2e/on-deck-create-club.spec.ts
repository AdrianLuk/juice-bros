import { expect, test } from "@playwright/test";

import { deleteClubForOrganizer } from "./support/on-deck.ts";

/**
 * On Deck: an Organizer creates their own Club (issue #515).
 *
 *   - a signed-in Organizer with no Club is shown a two-field form, not the
 *     old panel telling them Clubs are made by hand and to get in touch;
 *   - filling it lands them on home with Start ready, the venue taken from the
 *     club's name, and the form gone;
 *   - a second visit does not offer to make them a second one;
 *   - everything the form guessed, and the two fields it asked for, can be
 *     corrected in Settings afterwards.
 *
 * The only spec in this suite that does *not* seed its Club through
 * `service_role` — the app path being tested is the one that makes the row, so
 * seeding one would be testing the fixture. A throwaway account per run
 * (never deleted, there is no delete-account feature), following
 * `on-deck.spec.ts`'s posture.
 */
const ORGANIZER_EMAIL = `on-deck-create-club-${Date.now()}@example.com`;
const ORGANIZER_PASSWORD = "pickleball123";

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

// Every test starts from "this account has no Club", because that is the state
// the thing under test needs and because a retry of a test that created one
// would otherwise find no form. Each test then makes its own through the form
// rather than seeding one, so none of them depends on another having run.
test.beforeEach(async () => {
  await deleteClubForOrganizer(ORGANIZER_EMAIL);
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER_EMAIL);
});

/** Fills the two fields and waits for home to come back as the Club. */
async function createTheClub(page: import("@playwright/test").Page) {
  await page.getByLabel("Club name").fill("Riverside Pickleball");
  await page.getByLabel("Courts").fill("6");
  await page.getByRole("button", { name: "Create the club" }).click();
  await expect(
    page.getByRole("heading", { name: "Riverside Pickleball", exact: true }),
  ).toBeVisible();
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test("an Organizer with no Club creates one in two fields and lands on home with Start ready", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/on-deck/home");

  // The form, where the "get in touch" wall used to be.
  await expect(
    page.getByRole("heading", { name: "Set up your club" }),
  ).toBeVisible();
  await expect(page.getByText(ORGANIZER_EMAIL)).toBeVisible();

  // Home, as their Club. The heading is the marker that the server re-rendered
  // past the create form rather than the form merely clearing itself.
  await createTheClub(page);
  await expect(
    page.getByRole("heading", { name: "Set up your club" }),
  ).toHaveCount(0);

  // The Club card's definition list, in its rendered order: venue, courts,
  // group cap, floor mode. The venue nobody was asked for came off the club's
  // own name, and the two nobody was asked for took the schema's defaults.
  const details = page.getByRole("definition");
  await expect(details.nth(0)).toHaveText("Riverside Pickleball");
  await expect(details.nth(1)).toHaveText("6");
  await expect(details.nth(2)).toHaveText("4");
  await expect(details.nth(3)).toHaveText("Hybrid");

  // Start, ready. The point of the whole ticket.
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
});

test("a second visit offers no second Club", async ({ page }) => {
  await signIn(page);
  await page.goto("/on-deck/home");
  await createTheClub(page);

  await page.goto("/on-deck/home");
  await expect(
    page.getByRole("heading", { name: "Riverside Pickleball", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Set up your club" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create the club" }),
  ).toHaveCount(0);
});

test("everything the create form asked for or guessed is editable in settings", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/on-deck/home");
  await createTheClub(page);

  await page.goto("/on-deck/home/settings");

  await expect(page.getByLabel("Club name")).toHaveValue("Riverside Pickleball");
  await expect(page.getByLabel("Venue name")).toHaveValue("Riverside Pickleball");
  await expect(page.getByLabel("Courts")).toHaveValue("6");
  await expect(page.getByLabel("Group cap")).toHaveValue("4");
  await expect(page.getByLabel("Floor Mode")).toHaveValue("hybrid");

  await page.getByLabel("Club name").fill("Riverside Pickleball Club");
  await page.getByLabel("Venue name").fill("Riverside Community Centre");
  await page.getByLabel("Courts").fill("10");
  await page.getByLabel("Group cap").fill("6");
  await page.getByLabel("Floor Mode").selectOption("self-serve");
  await page.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByText("Defaults saved.")).toBeVisible();

  await page.goto("/on-deck/home");
  await expect(
    page.getByRole("heading", { name: "Riverside Pickleball Club" }),
  ).toBeVisible();
  await expect(page.getByText("Riverside Community Centre")).toBeVisible();
  await expect(page.getByText("Self-serve")).toBeVisible();
});
