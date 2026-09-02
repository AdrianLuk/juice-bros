import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
  finishCourtViaRpc,
  pausePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: the read-only Display (issue #253). A tablet on the snack table
 * shows Courts and occupants, the ordered Queue with Wait Times, and the two
 * On Deck Foursomes prominently, with a one-line queue-order explainer. No
 * buttons, no Skill Level, no contact data. It reflects a join, a Court
 * finish, and an On Deck change within a poll interval.
 */
const ORGANIZER = `on-deck-display-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let sessionId: string;
let volunteerToken: string;

// Ten queued from the start — enough for a seated Court plus two committed On
// Deck Foursomes with people still visibly waiting.
const PLAYERS: [string, string, string][] = [
  ["dev-disp-1", "Ana", "A"],
  ["dev-disp-2", "Bea", "B"],
  ["dev-disp-3", "Cal", "C"],
  ["dev-disp-4", "Dan", "D"],
  ["dev-disp-5", "Eve", "E"],
  ["dev-disp-6", "Fin", "F"],
  ["dev-disp-7", "Gus", "G"],
  ["dev-disp-8", "Hal", "H"],
  ["dev-disp-9", "Ivy", "I"],
  ["dev-disp-10", "Jo", "J"],
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
    name: "Display Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId, volunteerToken } = await seedOpenSession(ORGANIZER, clubId, {
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

test("the Display renders courts, the ordered queue with wait times, and the On Deck foursomes — and it's strictly read-only", async ({
  page,
}) => {
  await page.goto(`/on-deck/session/${sessionId}/display`);

  const board = page.getByTestId("display-board");
  await expect(board).toBeVisible();

  // Both On Deck Foursomes are shown and are the prominent element.
  await expect(page.getByTestId("display-on-deck-0")).toContainText("Up next");
  await expect(page.getByTestId("display-on-deck-1")).toContainText("After that");
  await expect(page.getByTestId("display-on-deck-0").locator("li")).toHaveCount(
    4,
  );

  // The queue lists the waiters not On Deck, in order, each with a Wait Time.
  const queue = page.getByTestId("display-queue");
  await expect(queue.locator("li").first()).toContainText(
    /just now|\d+ min|\d+ hr/,
  );

  // The queue-order explainer is present.
  await expect(
    page.getByText(/Groups line up at the middle/),
  ).toBeVisible();

  // No Skill Level anywhere on the board, and no operational buttons.
  await expect(board.getByText(/newbie|beginner|intermediate|advanced/i)).toHaveCount(
    0,
  );
  await expect(board.getByRole("button")).toHaveCount(0);

  // A tablet viewport: no horizontal scroll.
  await page.setViewportSize({ width: 1024, height: 768 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: "test-results/253-display-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/253-display-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 768 });

  // A join lands on the board within a poll interval.
  await joinPlayerViaRpc(sessionId, "dev-disp-late", "Kip", "K");
  await queuePlayerViaRpc(sessionId, "dev-disp-late");
  await expect(queue.getByText("Kip K.")).toBeVisible({ timeout: 15_000 });

  // A Court finish: the "Up next" Foursome walks onto Court 1, and a fresh
  // Foursome refills On Deck — an On Deck change the board reflects.
  const upNextNames = (
    await page.getByTestId("display-on-deck-0").locator("li").allInnerTexts()
  ).filter((t) => t !== "Open spot");
  await finishCourtViaRpc(sessionId, volunteerToken, 1);
  const court1 = page.getByTestId("display-court-1");
  await expect(court1).toContainText(upNextNames[0], { timeout: 15_000 });
  // On Deck still shows two foursomes — it topped back up.
  await expect(page.getByTestId("display-on-deck-0").locator("li")).toHaveCount(
    4,
  );

  // An On Deck change from a pause: a waiting player steps aside and drops off
  // the board within a poll interval.
  await expect(board.getByText("Kip K.")).toBeVisible();
  await pausePlayerViaRpc(sessionId, "dev-disp-late");
  await expect(board.getByText("Kip K.")).toHaveCount(0, { timeout: 15_000 });
});
