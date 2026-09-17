import { expect, test } from "@playwright/test";

import { deleteClubForOrganizer, fillUntilSet } from "./support/on-deck.ts";

/**
 * On Deck: a Club draft typed before sign-in survives it (issue #520).
 *
 *   - a Club name and court count typed on the sign-in page are present,
 *     already filled in, on the create-club screen right after sign-in;
 *   - nothing is written to the account until the Organizer explicitly
 *     confirms — the create form still has to be submitted;
 *   - a second sign-in carrying a different draft shows that draft, not
 *     stale text from the first (the failure mode named in the ticket:
 *     `useState`'s initializer only runs once, so a form fed a new prop
 *     without being remounted would otherwise keep showing the old values);
 *   - signing out clears a leftover draft, so a shared device's next sign-in
 *     doesn't silently inherit a name nobody at the keyboard typed;
 *   - an Organizer who already has a Club, and so never reaches the create
 *     form, still has a stray draft typed on the way in cleared rather than
 *     left sitting for the next, unrelated sign-in on the same browser.
 *
 * Five throwaway accounts, following `on-deck-create-club.spec.ts`'s posture
 * of never seeding a Club through `service_role` here — this suite is about
 * the path that makes the row, not a fixture for it.
 */
const STAMP = Date.now();
const SOLO_EMAIL = `on-deck-club-draft-solo-${STAMP}@example.com`;
const REPEAT_FIRST_EMAIL = `on-deck-club-draft-repeat-a-${STAMP}@example.com`;
const REPEAT_SECOND_EMAIL = `on-deck-club-draft-repeat-b-${STAMP}@example.com`;
const AFTER_SIGN_OUT_EMAIL = `on-deck-club-draft-after-sign-out-${STAMP}@example.com`;
const EXISTING_OWNER_EMAIL = `on-deck-club-draft-existing-owner-${STAMP}@example.com`;
const PASSWORD = "pickleball123";

test.afterAll(async () => {
  await deleteClubForOrganizer(SOLO_EMAIL);
  await deleteClubForOrganizer(REPEAT_FIRST_EMAIL);
  await deleteClubForOrganizer(REPEAT_SECOND_EMAIL);
  await deleteClubForOrganizer(AFTER_SIGN_OUT_EMAIL);
  await deleteClubForOrganizer(EXISTING_OWNER_EMAIL);
});

/**
 * Types a Club draft on the sign-in page, signs up a brand-new account with
 * a password, and waits to land past sign-in.
 */
async function signUpWithDraft(
  page: import("@playwright/test").Page,
  email: string,
  draft: { name: string; courtCount: string },
) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await fillUntilSet(page, "Club name", draft.name);
  await fillUntilSet(page, "Courts", draft.courtCount);

  await page
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test("a Club draft typed before sign-in is present after it, and nothing is written until confirmed", async ({
  page,
}) => {
  await signUpWithDraft(page, SOLO_EMAIL, {
    name: "Riverside Pickleball",
    courtCount: "6",
  });
  await page.goto("/on-deck/home");

  // Still the create form — carried values seed it, they don't submit it.
  const createButton = page.getByRole("button", { name: "Create the club" });
  await expect(createButton).toBeVisible();
  await expect(page.getByLabel("Club name")).toHaveValue(
    "Riverside Pickleball",
  );
  await expect(page.getByLabel("Courts")).toHaveValue("6");
  // The live heading echo, proof the carried name actually reached the field
  // rather than just sitting unused in a cookie.
  await expect(
    page.getByRole("heading", { name: "Riverside Pickleball", exact: true }),
  ).toBeVisible();
  // Called out rather than silently applied — on a shared browser, the
  // person confirming might not be who typed it.
  await expect(
    page.getByText("Filled in from what was typed before signing in"),
  ).toBeVisible();

  // Confirming is still a real, separate step.
  await createButton.click();
  await expect(createButton).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start tonight" }),
  ).toBeVisible();
});

test("reaching /on-deck/home again with a different carried draft shows that draft, not stale text from the first", async ({
  page,
}) => {
  // One account, one draft, landing on the create form without submitting —
  // the same browser, so the same cookie jar the second sign-in below reuses.
  await signUpWithDraft(page, REPEAT_FIRST_EMAIL, {
    name: "Riverside Pickleball",
    courtCount: "6",
  });
  await page.goto("/on-deck/home");
  await expect(page.getByLabel("Club name")).toHaveValue(
    "Riverside Pickleball",
  );

  await page.getByRole("button", { name: "Sign out" }).click();

  // A second account, a different draft, the exact same route.
  await signUpWithDraft(page, REPEAT_SECOND_EMAIL, {
    name: "Sunset Courts",
    courtCount: "9",
  });
  await page.goto("/on-deck/home");

  await expect(page.getByLabel("Club name")).toHaveValue("Sunset Courts");
  await expect(page.getByLabel("Courts")).toHaveValue("9");
  await expect(
    page.getByRole("heading", { name: "Sunset Courts", exact: true }),
  ).toBeVisible();
  // Nothing of the first account's draft leaked into this one's form.
  await expect(page.getByLabel("Club name")).not.toHaveValue(
    "Riverside Pickleball",
  );
});

test("signing out clears a leftover draft rather than leaving it for whoever signs in next", async ({
  page,
}) => {
  await signUpWithDraft(page, AFTER_SIGN_OUT_EMAIL, {
    name: "Leak Test Club",
    courtCount: "7",
  });
  await page.goto("/on-deck/home");
  await expect(page.getByLabel("Club name")).toHaveValue("Leak Test Club");

  await page.getByRole("button", { name: "Sign out" }).click();

  // Nobody typed anything this time — the sign-in page's own draft fields,
  // shown so a leftover draft would be visible rather than a silent surprise
  // later, must not still be showing the account that just signed out.
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await expect(page.getByLabel("Club name")).toHaveValue("");
  await expect(page.getByLabel("Courts")).toHaveValue("");
});

test("an Organizer who already has a Club has a stray draft cleared rather than left for later", async ({
  page,
}) => {
  // A real Club, made the ordinary way, with no draft involved.
  await signUpWithDraft(page, EXISTING_OWNER_EMAIL, {
    name: "Stray Draft Club",
    courtCount: "5",
  });
  await page.goto("/on-deck/home");
  await expect(page.getByLabel("Club name")).toHaveValue("Stray Draft Club");
  await page.getByRole("button", { name: "Create the club" }).click();
  await expect(
    page.getByRole("button", { name: "Start tonight" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();

  // Signing back into that same, already-owned Club — typing a stray draft
  // on the way in that this account will never use, because it never reaches
  // the create form again.
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await fillUntilSet(page, "Club name", "Should Never Be Used");
  await fillUntilSet(page, "Courts", "3");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(EXISTING_OWNER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
  await page.goto("/on-deck/home");
  await expect(
    page.getByRole("heading", { name: "Stray Draft Club", exact: true }),
  ).toBeVisible();

  // The cleanup effect only fires after this render, so give it a moment.
  await expect(async () => {
    const cookie = await page.evaluate(() => document.cookie);
    expect(cookie).not.toContain("od_club_draft");
  }).toPass({ timeout: 5_000 });
});
