import { expect, test, type Page } from "@playwright/test";

import {
  closeSessionViaRest,
  deleteClubForOrganizer,
  seedClubForOrganizer,
  seedOpenSession,
  sessionEventCount,
} from "./support/on-deck.ts";

/**
 * A Player's own taps on a Session that closed while their tab was open
 * (issue #642). The database already refuses the write; what this pins is
 * that the Player is told the night is over, and that nothing lands in the
 * event log.
 */
const ORGANIZER = `on-deck-closed-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";
const ENDED = "This night has ended.";

let clubId: string;
let sessionId: string;

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
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
  });
});

// Each test closes its Session, so each gets a fresh one.
test.beforeEach(async () => {
  ({ sessionId } = await seedOpenSession(ORGANIZER, clubId, { courtCount: 2 }));
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER);
});

async function fillName(page: Page, first: string, initial: string) {
  await page.goto(`/on-deck/session/${sessionId}`);
  await expect(page.getByText("Session running")).toBeVisible();
  await page.getByLabel("First name").fill(first);
  await page.getByLabel("Last initial").fill(initial);
  await page.getByRole("button", { name: "Next", exact: true }).click();
}

test("joining a Session that closed while the form was open says the night has ended", async ({
  page,
}) => {
  await fillName(page, "Dana", "R");

  await closeSessionViaRest(sessionId);
  const events = await sessionEventCount(sessionId);

  await page.getByRole("button", { name: "Intermediate", exact: true }).click();
  await expect(page.getByText(ENDED, { exact: true })).toBeVisible();
  expect(await sessionEventCount(sessionId)).toBe(events);
});

test("queueing on a Session that closed while the tab was open says the night has ended", async ({
  page,
}) => {
  await fillName(page, "Eli", "S");
  await page.getByRole("button", { name: "Intermediate", exact: true }).click();
  await expect(page.getByText("You're in")).toBeVisible();
  const joinQueue = page.getByRole("button", { name: "Join the queue" });
  await expect(joinQueue).toBeVisible();

  await closeSessionViaRest(sessionId);
  const events = await sessionEventCount(sessionId);

  await joinQueue.click();
  await expect(page.getByText(ENDED, { exact: true })).toBeVisible();
  expect(await sessionEventCount(sessionId)).toBe(events);
});
