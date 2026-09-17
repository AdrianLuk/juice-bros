import { expect, test } from "@playwright/test";

import { deleteClubForOrganizer, fillUntilSet } from "./support/on-deck.ts";

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
  await fillUntilSet(page, "Club name", "Riverside Pickleball");
  // The heading echo is client-rendered, so it is also proof of hydration.
  await expect(
    page.getByRole("heading", { name: "Riverside Pickleball", exact: true }),
  ).toBeVisible();
  await fillUntilSet(page, "Courts", "6");
  await page.getByRole("button", { name: "Create the club" }).click();
  // The form is gone and the heading is now the Club's, not the live echo of
  // what was being typed into it.
  await expect(
    page.getByRole("button", { name: "Create the club" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Riverside Pickleball", exact: true }),
  ).toBeVisible();
  // Start is the marker that home has finished settling. The heading alone is
  // not: the create form renders the same string while it is still mounted.
  await expect(
    page.getByRole("button", { name: "Start tonight" }),
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
    page.getByRole("button", { name: "Create the club" }),
  ).toBeVisible();
  await expect(page.getByText(ORGANIZER_EMAIL).first()).toBeVisible();

  // The page's heading is the Club's name, and with no Club it is the live
  // echo of the field: an Organizer sees their club on the board before they
  // commit to a name they can never change the owner of.
  await expect(page.getByRole("heading", { name: "Your club" })).toBeVisible();
  await fillUntilSet(page, "Club name", "Riverside");
  await expect(
    page.getByRole("heading", { name: "Riverside", exact: true }),
  ).toBeVisible();

  // Home, as their Club.
  await createTheClub(page);

  // The spec line under the Club's name, carrying what the two-field form
  // guessed. The venue is deliberately absent: it defaults to the club's own
  // name, which is already the heading, and printing it twice reads as a bug.
  // That it was set at all is asserted in settings below.
  const spec = page.locator(".od-bo-spec");
  await expect(spec).not.toContainText("Riverside Pickleball", {
    ignoreCase: true,
  });
  await expect(spec).toContainText("6 courts", { ignoreCase: true });
  await expect(spec).toContainText("Cap 4", { ignoreCase: true });
  await expect(spec).toContainText("Hybrid", { ignoreCase: true });

  // Start, ready. The point of the whole ticket.
  await expect(
    page.getByRole("button", { name: "Start tonight" }),
  ).toBeVisible();
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
  // Settings bounces to home when the account has no Club, so pin that we are
  // actually on it — otherwise a missing field reads as a markup change when
  // it was really a redirect.
  await page.waitForURL(/\/on-deck\/home\/settings$/);

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
  await expect(page.locator(".od-bo-spec")).toContainText(
    "Riverside Community Centre",
    { ignoreCase: true },
  );
  await expect(page.locator(".od-bo-spec")).toContainText("Self-serve", {
    ignoreCase: true,
  });
});
