import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: Queue Together, volunteer-formed (issue #250). An Operator on the
 * floor picks 2 to the live cap waiting Players who asked to play together and
 * queues them as one Group: it shows as a single Queue entry, a short Group is
 * filled to four by Match Me, and it dissolves when its Game ends. The
 * database scope (volunteer append accepts the two events, GROUP_FORMED is
 * undoable) is pinned in supabase/tests/on_deck_queue_together.test.sql.
 */
const ORGANIZER = `on-deck-qt-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let sessionId: string;

const PLAYERS: [string, string, string][] = [
  ["dev-qt-1", "Ana", "A"],
  ["dev-qt-2", "Bea", "B"],
  ["dev-qt-3", "Cal", "C"],
  ["dev-qt-4", "Dan", "D"],
  ["dev-qt-5", "Eve", "E"],
  ["dev-qt-6", "Fin", "F"],
];

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
    name: "Queue Together Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId } = await seedOpenSession(ORGANIZER, clubId, {
    floorMode: "hybrid",
  }));

  for (const [token, first, initial] of PLAYERS) {
    await joinPlayerViaRpc(sessionId, token, first, initial);
    await queuePlayerViaRpc(sessionId, token);
  }
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test("an operator forms a Group of three; it queues as one unit, fills to four, and dissolves when its Game ends", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/on-deck/session/${sessionId}/floor`);

  const qt = page.getByTestId("queue-together");
  await expect(qt).toBeVisible();

  // The cap only goes down — 5 is not on the menu.
  await expect(qt.getByLabel("Group cap")).toHaveValue("4");

  for (const name of ["Ana A.", "Bea B.", "Cal C."]) {
    await qt.getByRole("button", { name, exact: true }).click();
  }
  await qt.getByRole("button", { name: /Form group/ }).click();
  await expect(page.getByTestId("floor-error")).toHaveCount(0);

  // The Group is one unit: filled to four (Dan D. is the Match Me fill) and
  // shown with a single Group label on the "Up next" card.
  const upNext = page.getByTestId("on-deck-0");
  await expect(upNext.getByText("Group")).toBeVisible();
  await expect(upNext.locator("li")).toHaveCount(4);
  for (const name of ["Ana A.", "Bea B.", "Cal C.", "Dan D."]) {
    await expect(upNext.getByText(name)).toBeVisible();
  }

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: "test-results/250-queue-together-floor-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/250-queue-together-floor-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  // The Group walks onto Court 1 as a unit.
  const court1 = page.getByTestId("court-1");
  await court1.getByRole("button", { name: "Send next four" }).click();
  await expect(court1.locator("ul > li")).toHaveCount(4);
  for (const name of ["Ana A.", "Bea B.", "Cal C.", "Dan D."]) {
    await expect(court1.getByText(name)).toBeVisible();
  }

  // Its Game ends — the Group dissolves and its members re-queue as solos,
  // free to be grouped again.
  await court1.getByRole("button", { name: "Court 1 done" }).click();
  // Cal C. re-queued as a solo — the "queue together" picker offers them again.
  await expect(
    qt.getByRole("button", { name: "Cal C.", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("on-deck-0").getByText("Group")).toHaveCount(0);
});
