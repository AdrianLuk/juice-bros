import { expect, test } from "@playwright/test";

import { seedClubForOrganizer, deleteClubForOrganizer } from "./support/on-deck.ts";

/**
 * On Deck's tenant backbone (issue #241): an Organizer signs in, sees their
 * Club, taps Start to open a Session from the saved defaults, and the stable
 * Club QR path resolves to that open Session.
 *
 * The Club is seeded straight against PostgREST — self-serve club creation is
 * out of scope (#238) and there is no app path that writes `on_deck_clubs`.
 * A throwaway account per run (never deleted — there is no delete-account
 * feature), following `onboarding.spec.ts`'s posture.
 */
const ORGANIZER_EMAIL = `on-deck-organizer-${Date.now()}@example.com`;
const ORGANIZER_PASSWORD = "pickleball123";

let clubId: string;

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

  clubId = await seedClubForOrganizer(ORGANIZER_EMAIL, {
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
    courtCount: 8,
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

test("the Club QR shows 'nothing running' before a Session is started", async ({
  page,
}) => {
  await page.goto(`/on-deck/c/${clubId}`);
  await expect(
    page.getByRole("heading", { name: "Nothing running right now" }),
  ).toBeVisible();
});

test("an Organizer signs in, sees their Club, and Start opens a Session the QR then resolves to", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/on-deck/home");
  await expect(
    page.getByRole("heading", { name: "TO Pickleball Club" }),
  ).toBeVisible();
  await expect(page.getByText("Ramsden Park")).toBeVisible();

  await page.getByRole("button", { name: "Start", exact: true }).click();

  // Lands on the live Session view.
  await page.waitForURL(/\/on-deck\/session\/[0-9a-f-]+$/);
  await expect(page.getByText("Session running")).toBeVisible();
  const sessionUrl = page.url();

  // The stable Club QR path now redirects to that same open Session.
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(sessionUrl);
  await expect(page.getByText("Session running")).toBeVisible();

  // Back on the home screen, Start is replaced by a link to the running one.
  await page.goto("/on-deck/home");
  await expect(page.getByText("A session is running.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(
    0,
  );
});

test("a Player scans the Club QR, does the two-tap setup, and is recognized on return", async ({
  page,
}) => {
  // The session opened by the test above is still running (there is no close
  // feature yet), so the QR resolves straight to it.
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(/\/on-deck\/session\/[0-9a-f-]+$/);
  const sessionUrl = page.url();
  await expect(page.getByText("Session running")).toBeVisible();

  // Tap one: name.
  await page.getByLabel("First name").fill("Sarah");
  await page.getByLabel("Last initial").fill("K");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Tap two: skill level — which submits.
  await page.getByRole("button", { name: "Intermediate", exact: true }).click();

  await expect(page.getByText("You're in")).toBeVisible();
  await expect(page.getByText("Sarah K.", { exact: true })).toBeVisible();
  await expect(page.getByText("Playing as Intermediate")).toBeVisible();

  // Reopening the QR on the same device recognizes the returning token —
  // straight to "you're in", no setup form.
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(sessionUrl);
  await expect(page.getByText("You're in")).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveCount(0);
});
