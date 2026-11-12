import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { deleteTeamEventOrganizer, playMatchup, seedTeamEvent, type SeededTeamEvent } from "./support/team-tally.ts";

/**
 * Team Tally: the Organizer ends a night with a Flight still open, and takes it
 * back (issue #684).
 *
 * Flight A is played and done; Flight B has one Game in. The Organizer ends
 * the night from the event page, confirmed in the page: the Public Link shows
 * the results with Flight B's two places marked not played out, and Flight B's
 * Score Link turns read-only. Resume the night puts both back to live.
 *
 * Golden Set is Ben Johns, Kitchen Kings Hayden Patriquin. Names are PPA Tour
 * pros.
 */

const PHONE = { width: 390, height: 844 };

/** 60-49 to the red side. */
const RED_WINS: [number, number][] = [
  [11, 8],
  [11, 9],
  [7, 11],
  [11, 6],
  [9, 11],
  [11, 4],
];

/** 49-60: the blue side takes it. */
const BLUE_WINS: [number, number][] = RED_WINS.map(([red, blue]) => [blue, red]);

/** 66-27 to the red side. */
const BIG_RED: [number, number][] = [
  [11, 2],
  [11, 3],
  [11, 4],
  [11, 5],
  [11, 6],
  [11, 7],
];

async function clickUntil(button: Locator, then: Locator) {
  await expect(async () => {
    await button.click();
    await expect(then).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

async function open(browser: Browser, path: string, viewport?: { width: number; height: number }): Promise<Page> {
  const page = await (await browser.newContext(viewport ? { viewport } : {})).newPage();
  await page.goto(path);
  return page;
}

async function signIn(page: Page, night: SeededTeamEvent, next: string) {
  await page.goto(`/tools/team-tally/sign-in?next=${next}`);
  await clickUntil(page.getByRole("button", { name: "Sign in with a password" }), page.getByLabel("Password"));
  await page.getByLabel("Email").fill(night.organizerEmail);
  await page.getByLabel("Password").fill(night.organizerPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("ending a night with a Flight still open", () => {
  let night: SeededTeamEvent;

  test.beforeEach(async () => {
    night = await seedTeamEvent("End the Night");
  });

  test.afterEach(async () => {
    if (night) await deleteTeamEventOrganizer(night);
  });

  test("the Organizer ends it, the results say Flight B was not played out, and Resume the night brings it back", async ({
    browser,
    page,
  }) => {
    // Opening standings: Hayden 66, Ben 60, Federico 49, Christian 27.
    // Flight A: Hayden v Ben. Flight B: Federico v Christian.
    await playMatchup(night, { opening: 1 }, RED_WINS, { done: true });
    await playMatchup(night, { opening: 2 }, BIG_RED, { done: true });
    await playMatchup(night, { flight: "A" }, BLUE_WINS, { done: true });
    await playMatchup(night, { flight: "B" }, [[11, 6]]);

    const fed = await open(browser, `/tools/team-tally/score/${night.scoreTokens[1]}`, PHONE);
    const room = await open(browser, `/tools/team-tally/live/${night.publicToken}`, PHONE);
    await expect(room.getByRole("region", { name: "Results" })).toHaveCount(0);

    await signIn(page, night, `/tools/team-tally/events/${night.eventId}`);

    // Asked in the page: Flight B can't be marked done, so its places stay blank.
    const panel = page.getByRole("region", { name: "End the night" });
    const confirm = page.getByRole("alertdialog", { name: "End the night" });
    await clickUntil(panel.getByRole("button", { name: "End the night" }), confirm);
    await expect(confirm).toContainText("Flight B can't be");
    await expect(confirm).toContainText("places stay blank");
    await confirm.getByRole("button", { name: "End it" }).click();

    // The organizer page: the results link is there, and Resume the night replaces End.
    await expect(page.getByRole("link", { name: "See the results" })).toBeVisible({ timeout: 20_000 });
    const resume = page.getByRole("region", { name: "Resume the night" });
    await expect(resume).toContainText("Flight B was not played out");
    await expect(page.getByRole("region", { name: "End the night" })).toHaveCount(0);

    // The Public Link: Flight A's champion, and Flight B held open instead of a champion.
    const results = room.getByRole("region", { name: "Results" });
    await expect(results).toBeVisible({ timeout: 20_000 });
    await expect(room.getByRole("region", { name: "Flights", exact: true })).toHaveCount(0);
    const champions = results.getByRole("region", { name: "Flight champions" });
    await expect(champions.getByRole("listitem")).toHaveCount(2);
    await expect(champions.getByRole("listitem").nth(0)).toContainText("Golden Set");
    await expect(champions.getByRole("listitem").nth(1)).toContainText("Flight B");
    await expect(champions.getByRole("listitem").nth(1)).toContainText("Not played out");

    const places = results.getByRole("region", { name: "Final places" });
    await expect(places.getByRole("listitem")).toHaveCount(3);
    await expect(places.getByRole("listitem").nth(0)).toContainText("Flight A champion");
    await expect(places.getByRole("listitem").nth(1)).toContainText("Flight A runner-up");
    await expect(places.getByRole("listitem").nth(2)).toContainText("Flight B");
    await expect(places.getByRole("listitem").nth(2)).toContainText("Not played out");

    // Flight B's Score Link is read-only.
    const over = fed.getByRole("region", { name: "The night is over" });
    await expect(over).toBeVisible({ timeout: 20_000 });
    await expect(fed.getByRole("button", { name: /Save|Matchup done/ })).toHaveCount(0);

    // Resume the night: the Public Link and the Score Link are live again.
    await clickUntil(resume.getByRole("button", { name: "Resume the night" }), page.getByRole("region", { name: "End the night" }));
    // The Public Link is the live layout again: Flights and standings, no results.
    await expect(room.getByRole("region", { name: "Flights", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(room.getByRole("region", { name: "Results" })).toHaveCount(0);
    await expect(room.getByRole("region", { name: "Standings", exact: true })).toBeVisible();
    await expect(fed.getByRole("region", { name: "The night is over" })).toHaveCount(0, { timeout: 20_000 });
    await expect(fed.getByRole("region", { name: "Your Flight" })).toBeVisible();
  });
});
