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
 * buttons and no contact data. Every name is inked by its Player's Skill Level
 * and the legend spells the four out. It reflects a join, a Court finish, and
 * an On Deck change within a poll interval.
 */
const ORGANIZER = `on-deck-display-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let clubId: string;
let sessionId: string;
let volunteerToken: string;

// Ten queued from the start — enough for a seated Court plus two committed On
// Deck Foursomes with people still visibly waiting. All four Skill Levels are
// represented so the board's name ink can be read off every one of them.
const PLAYERS: [string, string, string, string][] = [
  ["dev-disp-1", "Ana", "A", "newbie"],
  ["dev-disp-2", "Bea", "B", "beginner"],
  ["dev-disp-3", "Cal", "C", "intermediate"],
  ["dev-disp-4", "Dan", "D", "advanced"],
  ["dev-disp-5", "Eve", "E", "newbie"],
  ["dev-disp-6", "Fin", "F", "beginner"],
  ["dev-disp-7", "Gus", "G", "intermediate"],
  ["dev-disp-8", "Hal", "H", "advanced"],
  ["dev-disp-9", "Ivy", "I", "beginner"],
  ["dev-disp-10", "Jo", "J", "advanced"],
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

  clubId = await seedClubForOrganizer(ORGANIZER, {
    name: "Display Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId, volunteerToken } = await seedOpenSession(ORGANIZER, clubId, {
    floorMode: "hybrid",
  }));

  for (const [token, first, initial, skill] of PLAYERS) {
    await joinPlayerViaRpc(sessionId, token, first, initial, skill);
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

  // The whole app runs in On Deck's bare shell — its brand bar, none of the
  // main Juice Bros site nav.
  await expect(page.getByRole("link", { name: "On Deck" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Podcast" })).toHaveCount(0);

  // The join QR leads the board — the tablet doubles as the printed sign, so
  // someone not yet in the queue can get in without finding a person first.
  // It has to encode the *Club* link (the stable one the sign carries), never
  // this Session's own URL.
  const joinQr = board.getByTestId("display-join-qr");
  await expect(joinQr).toContainText("Scan to join");
  // Exactly one image in the a11y tree: the labelled code, not the drawn
  // `<svg>` underneath it announcing itself again unnamed.
  await expect(joinQr.getByRole("img")).toHaveAttribute(
    "aria-label",
    new RegExp(`/on-deck/c/${clubId}$`),
  );

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

  // Every name is inked by its Player's Skill Level. The colour itself isn't
  // assertable, but the attribute that drives it is — and it has to agree with
  // what each Player declared at join, wherever on the board they turn up.
  for (const [, first, initial, skill] of PLAYERS) {
    const inked = board.locator(
      `[data-player-name="${first} ${initial}."][data-skill="${skill}"]`,
    );
    await expect(inked.first()).toBeVisible();
  }
  // Nobody is printed without a level.
  await expect(
    board.locator("[data-player-name]:not([data-skill])"),
  ).toHaveCount(0);

  // The legend spells the four levels out, so the ink is never the only
  // carrier of what a colour means.
  const key = board.getByTestId("skill-key");
  await expect(key).toBeVisible();
  for (const word of ["Newbie", "Beginner", "Intermediate", "Advanced"]) {
    await expect(key.getByText(word, { exact: true })).toBeVisible();
  }

  // Still strictly read-only.
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
  // The board's display face is CSS-uppercased; read the underlying text
  // nodes (`textContent`, not the rendered `allInnerTexts`) so the name we
  // match against Court 1 is the same case as its own `<li>`.
  const upNextNames = (
    await page
      .getByTestId("display-on-deck-0")
      .locator("li")
      .evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""))
  ).filter((t) => t.toLowerCase() !== "open spot");
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
