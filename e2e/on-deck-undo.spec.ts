import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: operator Undo (issue #247). A single Undo on the floor screen drops
 * the most recent event and every surface re-folds to the prior state. The
 * guard rails — stale `expected_seq` (concurrent Operator), the undo window,
 * non-undoable event types, the volunteer-scope gate — are pinned without a
 * browser in supabase/tests/on_deck_undo.test.sql; this is the tap-wrong-court
 * → undo → restored journey, for the Organizer and a link Volunteer.
 */
const ORGANIZER = `on-deck-undo-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let sessionId: string;
let volunteerToken: string;

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

  const clubId = await seedClubForOrganizer(ORGANIZER, {
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId, volunteerToken } = await seedOpenSession(ORGANIZER, clubId, {
    floorMode: "hybrid",
  }));

  const stamp = Date.now();
  for (const [i, name] of ["Ana", "Bo", "Cy", "Di", "Ed", "Fi", "Gu", "Ha"].entries()) {
    const tok = `tok-undo-${stamp}-${i}`;
    await joinPlayerViaRpc(sessionId, tok, name, name[0]);
    await queuePlayerViaRpc(sessionId, tok);
  }
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER);
});

test("the Organizer sends four onto a court by mistake, then undoes it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/on-deck/session/${sessionId}/floor`);

  // Nothing operational has happened — the last event is a PLAYER_QUEUED, which
  // isn't an Operator's to undo.
  await expect(page.getByTestId("undo-button")).toHaveCount(0);

  const court1 = page.getByTestId("court-1");
  await court1.getByRole("button", { name: "Send next four" }).click();
  await expect(court1.locator("ul > li")).toHaveCount(4);

  const undo = page.getByTestId("undo-button");
  await expect(undo).toHaveText(/Undo the last court finish/);

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: "test-results/247-undo-organizer-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/247-undo-organizer-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await undo.click();

  // The foursome walks back off — Court 1 is empty again and the undo control
  // is gone (the last event is a PLAYER_QUEUED once more).
  await expect(court1.getByText("Waiting for a foursome")).toBeVisible();
  await expect(page.getByTestId("undo-button")).toHaveCount(0);
  await expect(page.getByTestId("floor-error")).toHaveCount(0);
});

test("a link Volunteer can undo their own tap", async ({ page }) => {
  await page.goto(`/on-deck/session/${sessionId}/volunteer/${volunteerToken}`);

  const court2 = page.getByTestId("court-2");
  await court2.getByRole("button", { name: "Send next four" }).click();
  await expect(court2.locator("ul > li")).toHaveCount(4);

  const undo = page.getByTestId("undo-button");
  await expect(undo).toBeVisible();
  await undo.click();

  await expect(court2.getByText("Waiting for a foursome")).toBeVisible();
  await expect(page.getByTestId("floor-error")).toHaveCount(0);
});
