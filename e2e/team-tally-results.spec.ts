import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import {
  TEAM_TALLY_FOURTEEN,
  deleteTeamEventOrganizer,
  playMatchup,
  scoreMatchup,
  seedTeamEvent,
  type SeededTeamEvent,
} from "./support/team-tally.ts";

/**
 * Team Tally: the night's end, the results page and the big screen (issue #625).
 *
 *   - a played-through four-Team night ends by itself when the last Flight
 *     Matchup is marked done: Score Links turn read-only, the Public Link shows
 *     the champions and then Final places, and the Organizer can reopen;
 *   - the Organizer deletes a Team Event (confirmed in the page) and every link
 *     stops opening;
 *   - the Public Link's big-screen stage fits 1366x768 and 1920x1080 with 14
 *     Teams in every stage, and the standings re-sort slides unless reduced
 *     motion asks for the cut.
 *
 * Nights are seeded through the save function and played as the Organizer
 * (e2e/support/team-tally.ts). Golden Set is Ben Johns, Kitchen Kings Hayden
 * Patriquin. Names are PPA Tour pros.
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

/** Opening round standings: Hayden 66, Ben 60, Federico 49, Christian 27. Flight A: Hayden v Ben; Flight B: Federico v Christian. */
async function playOpening(night: SeededTeamEvent) {
  await playMatchup(night, { opening: 1 }, RED_WINS, { done: true });
  await playMatchup(night, { opening: 2 }, BIG_RED, { done: true });
}

test.describe("the night ends", () => {
  let night: SeededTeamEvent;

  test.beforeEach(async () => {
    night = await seedTeamEvent("Results Night");
  });

  test.afterEach(async () => {
    if (night) await deleteTeamEventOrganizer(night);
  });

  test("the last Flight done ends the night: read-only Score Links, then champions and Final places", async ({
    browser,
  }) => {
    await playOpening(night);
    // Flight A: Ben's Golden Set (blue, the lower seed) beats Hayden's Kitchen Kings 60-49.
    await playMatchup(night, { flight: "A" }, BLUE_WINS, { done: true });
    // Flight B is scored but not yet done: Federico's captain taps it.
    await playMatchup(night, { flight: "B" }, RED_WINS);

    const fed = await open(browser, `/tools/team-tally/score/${night.scoreTokens[1]}`, PHONE);
    const ben = await open(browser, `/tools/team-tally/score/${night.scoreTokens[0]}`, PHONE);
    const room = await open(browser, `/tools/team-tally/live/${night.publicToken}`, PHONE);

    // Mid-night: scoring is open.
    await expect(fed.getByRole("region", { name: "The night is over" })).toHaveCount(0);
    await expect(room.getByRole("region", { name: "Results" })).toHaveCount(0);

    const finish = fed.getByRole("region", { name: "Finish the Matchup" });
    const confirm = fed.getByRole("alertdialog", { name: "Mark this Matchup done" });
    await clickUntil(finish.getByRole("button", { name: "Matchup done" }), confirm);
    await confirm.getByRole("button", { name: "Yes, it's done" }).click();

    // It ends by itself: Federico's own page, and Ben's, with no reload.
    for (const page of [fed, ben]) {
      const over = page.getByRole("region", { name: "The night is over" });
      await expect(over).toBeVisible({ timeout: 20_000 });
      await expect(over).toContainText("read-only");
      // Read-only: no inputs, no Save, no Matchup done, no roster.
      await expect(page.getByRole("spinbutton")).toHaveCount(0);
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Save|Matchup done/ })).toHaveCount(0);
    }
    await expect(fed.getByRole("region", { name: "The night is over" })).toContainText("finished 3rd");
    await expect(ben.getByRole("region", { name: "The night is over" })).toContainText("finished 1st");

    // The Public Link: champions first, then Final places, Flight A first.
    const results = room.getByRole("region", { name: "Results" });
    await expect(results).toBeVisible({ timeout: 20_000 });
    const champions = results.getByRole("region", { name: "Flight champions" });
    await expect(champions.getByRole("listitem")).toHaveCount(2);
    await expect(champions.getByRole("listitem").nth(0)).toContainText("Flight A");
    await expect(champions.getByRole("listitem").nth(0)).toContainText("Golden Set");
    await expect(champions.getByRole("listitem").nth(0)).toContainText("60–49");
    await expect(champions.getByRole("listitem").nth(1)).toContainText("Team Federico Staksrud");

    const places = results.getByRole("region", { name: "Final places" });
    await expect(places.getByRole("listitem")).toHaveCount(4);
    await expect(places.getByRole("listitem")).toContainText([
      "Golden Set",
      "Kitchen Kings",
      "Team Federico Staksrud",
      "Team Christian Alshon",
    ]);
    await expect(places.getByRole("listitem").nth(0)).toContainText("Flight A champion");
    await expect(places.getByRole("listitem").nth(1)).toContainText("Flight A runner-up");
    await expect(places.getByRole("listitem").nth(2)).toContainText("Flight B champion");

    // Then the opening standings, then every Matchup's Games.
    await expect(room.getByRole("list", { name: "Standings · opening round" })).toContainText("Kitchen Kings");
    // (Folded under their summaries, so found by label rather than by role.)
    await expect(room.locator('[aria-label="Flight A games"]')).toBeAttached();
    await expect(room.locator('[aria-label="Match 2 games"]')).toBeAttached();
  });

  test("on a TV the Public Link opens on the results, with no scrolling", async ({ browser }) => {
    await playOpening(night);
    await playMatchup(night, { flight: "A" }, BLUE_WINS, { done: true });
    await playMatchup(night, { flight: "B" }, RED_WINS, { done: true });

    const tv = await open(browser, `/tools/team-tally/live/${night.publicToken}`, { width: 1366, height: 768 });
    const screen = tv.getByRole("region", { name: "Results" });
    await expect(screen).toBeVisible();
    await expect(screen.getByRole("region", { name: "Final places" })).toContainText("Golden Set");
    await expect(tv.getByRole("heading", { level: 1 })).toHaveText("Results Night");

    // The stage covers the viewport and the page behind it can't scroll.
    expect(await tv.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
    expect(await tv.locator(".tt-tv").evaluate((el) => el.getBoundingClientRect().height)).toBe(768);
  });

  test("the Organizer reopens a Flight Matchup and the night is on again", async ({ browser, page }) => {
    await playOpening(night);
    await playMatchup(night, { flight: "A" }, BLUE_WINS, { done: true });
    await playMatchup(night, { flight: "B" }, RED_WINS, { done: true });

    const fed = await open(browser, `/tools/team-tally/score/${night.scoreTokens[1]}`, PHONE);
    await expect(fed.getByRole("region", { name: "The night is over" })).toBeVisible();

    await signIn(page, night, `/tools/team-tally/events/${night.eventId}`);
    const flightB = page.getByRole("region", { name: "Flight B · Courts 17 & 18" });
    await clickUntil(flightB.getByRole("button", { name: "Reopen Matchup" }), flightB.getByRole("button", { name: "Matchup done" }));

    await expect(fed.getByRole("region", { name: "The night is over" })).toHaveCount(0, { timeout: 20_000 });
    await expect(fed.getByRole("region", { name: "Your Flight" })).toBeVisible();
  });
});

async function signIn(page: Page, night: SeededTeamEvent, next: string) {
  await page.goto(`/tools/team-tally/sign-in?next=${next}`);
  await clickUntil(page.getByRole("button", { name: "Sign in with a password" }), page.getByLabel("Password"));
  await page.getByLabel("Email").fill(night.organizerEmail);
  await page.getByLabel("Password").fill(night.organizerPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("deleting a Team Event asks first, removes it, and its links stop opening", async ({ page }) => {
  const night = await seedTeamEvent("Delete Me Night");
  try {
    await signIn(page, night, `/tools/team-tally/events/${night.eventId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Delete Me Night" })).toBeVisible();

    // Asked in the page: keeping it changes nothing.
    const dialog = page.getByRole("alertdialog", { name: "Delete this Team Event for good" });
    await clickUntil(page.getByRole("button", { name: "Delete Team Event" }), dialog);
    await expect(dialog).toContainText("can't be undone");
    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Delete Me Night" })).toBeVisible();

    await clickUntil(page.getByRole("button", { name: "Delete Team Event" }), dialog);
    await dialog.getByRole("button", { name: "Yes, delete it" }).click();

    // Back on the Organizer's list, without it.
    await expect(page).toHaveURL(/\/tools\/team-tally$/);
    await expect(page.getByText("Delete Me Night")).toHaveCount(0);

    // The Public Link and every Score Link stop opening. Next serves a soft
    // 404 (200 plus the not-found screen), so assert on what renders.
    const missing = page.getByRole("heading", { name: "This page could not be found." });
    await page.goto(`/tools/team-tally/live/${night.publicToken}`);
    await expect(missing).toBeVisible();
    for (const token of night.scoreTokens) {
      await page.goto(`/tools/team-tally/score/${token}`);
      await expect(missing).toBeVisible();
    }
  } finally {
    await deleteTeamEventOrganizer(night);
  }
});

test.describe("the big screen", () => {
  let night: SeededTeamEvent;

  test.beforeEach(async () => {
    night = await seedTeamEvent("Big Screen Night");
  });

  test.afterEach(async () => {
    if (night) await deleteTeamEventOrganizer(night);
  });

  test("cuts between the opening standings and the Matchups on a timer, and the phone layout keeps scrolling", async ({
    browser,
  }) => {
    await scoreMatchup(night, 1, RED_WINS);

    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const tv = await context.newPage();
    await tv.clock.install();
    await tv.goto(`/tools/team-tally/live/${night.publicToken}`);

    // Hard cut: one complete screen at a time. The standings lead.
    const standings = tv.getByRole("region", { name: "Standings" });
    const matchups = tv.getByRole("region", { name: "Matchups" });
    await expect(standings).toBeVisible();
    await expect(matchups).toBeHidden();
    await expect(standings.getByRole("list", { name: "Standings · Flights A to B" })).toContainText("Golden Set");
    await expect(tv.getByRole("list", { name: "Screens" }).getByRole("listitem").first()).toHaveAttribute(
      "aria-current",
      "true",
    );

    await expect(async () => {
      await tv.clock.fastForward(5_000);
      await expect(matchups).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 15_000 });
    await expect(standings).toBeHidden();
    await expect(matchups.getByRole("table", { name: "Match 1 · Courts 16 & 19" })).toBeVisible();

    // The same link on a phone is the scrolling page: no stage.
    const phone = await open(browser, `/tools/team-tally/live/${night.publicToken}`, PHONE);
    await expect(phone.locator(".tt-tv")).toBeHidden();
    await expect(phone.getByRole("list", { name: "Standings · opening round" })).toBeVisible();
    expect(await phone.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
  });

  for (const reduced of [false, true]) {
    test(`a score that re-sorts the standings ${reduced ? "cuts to the new order under reduced motion" : "slides the rows"}`, async ({
      browser,
    }) => {
      await scoreMatchup(night, 1, RED_WINS);
      await scoreMatchup(night, 2, [[11, 9]]);

      const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      const tv = await context.newPage();
      await tv.goto(`/tools/team-tally/live/${night.publicToken}?screen=standings`);

      const tower = tv.getByRole("list", { name: "Standings · Flights A to B" });
      const names = tower.locator(".tt-tower-name-text");
      await expect(names.first()).toHaveText("Golden Set");

      // Watching for a transform animation on any row before the score lands.
      const slid = tv
        .waitForFunction(
          () =>
            document.getAnimations().some((animation) =>
              (animation.effect as KeyframeEffect | null)?.getKeyframes().some((frame) => frame.transform),
            ),
          undefined,
          { timeout: reduced ? 3_000 : 20_000 },
        )
        .then(
          () => true,
          () => false,
        );

      // Hayden's Team pulls ahead of Ben's: the order flips.
      await scoreMatchup(night, 2, [
        [11, 9],
        [11, 2],
        [11, 3],
        [11, 4],
        [11, 5],
        [11, 6],
      ]);

      await expect(names.first()).toHaveText("Kitchen Kings", { timeout: 20_000 });
      // The up and down marks show either way.
      await expect(tower.getByLabel("Up 2")).toBeVisible();
      await expect(tower.getByLabel("Down 1").first()).toBeVisible();
      expect(await slid).toBe(!reduced);
      await context.close();
    });
  }
});

test.describe("14 Teams on the big screen", () => {
  test.describe.configure({ timeout: 240_000 });

  let night: SeededTeamEvent;

  test.beforeAll(async () => {
    night = await seedTeamEvent("Fourteen Team Night", TEAM_TALLY_FOURTEEN);
  });

  test.afterAll(async () => {
    if (night) await deleteTeamEventOrganizer(night);
  });

  /** Nothing in the visible screen runs past the stage, and the stage itself never scrolls. */
  async function expectFits(page: Page) {
    const report = await page.evaluate(() => {
      const stage = document.querySelector(".tt-tv")!;
      const box = stage.getBoundingClientRect();
      const overflowing: string[] = [];
      stage.querySelectorAll(".tt-tv-screen:not([hidden]) *, .tt-tv-head *, .tt-tv-foot *").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        if (rect.bottom > box.bottom + 1 || rect.right > box.right + 1) overflowing.push(el.className.toString());
      });
      const screen = stage.querySelector(".tt-tv-screen:not([hidden])")!;
      return {
        overflowing: overflowing.slice(0, 5),
        stageScroll: stage.scrollHeight - stage.clientHeight,
        screenScroll: screen.scrollHeight - screen.clientHeight,
        pageScroll: document.documentElement.scrollHeight - window.innerHeight,
      };
    });
    expect(report.overflowing).toEqual([]);
    expect(report.stageScroll).toBeLessThanOrEqual(1);
    expect(report.screenScroll).toBeLessThanOrEqual(1);
  }

  async function checkScreens(browser: Browser, screens: string[]) {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      for (const screen of screens) {
        const tv = await open(browser, `/tools/team-tally/live/${night.publicToken}?screen=${screen}`, viewport);
        await expect(tv.locator(".tt-tv-screen:not([hidden])")).toBeVisible();
        await expectFits(tv);
        await tv.context().close();
      }
    }
  }

  test("the opening round fits: the standings in two columns and the Matchups", async ({ browser }) => {
    for (const number of [1, 2, 3, 4, 5, 6, 7]) {
      await scoreMatchup(night, number, [
        [11, number],
        [11, number + 2],
        [9, 11],
        [11, 5],
      ]);
    }
    const tv = await open(browser, `/tools/team-tally/live/${night.publicToken}?screen=standings`, {
      width: 1920,
      height: 1080,
    });
    await expect(tv.getByRole("list", { name: "Standings · Flights A to C" })).toBeVisible();
    await expect(tv.getByRole("list", { name: "Standings · Flights D to G" })).toBeVisible();
    await expect(tv.getByRole("list", { name: "Standings · Flights D to G" }).getByRole("listitem")).toHaveCount(8);
    await tv.context().close();

    await checkScreens(browser, ["standings", "matchups"]);
  });

  test("the Flights hand-off, Flight scores and the results fit", async ({ browser }) => {
    for (const number of [1, 2, 3, 4, 5, 6, 7]) {
      // Each Matchup a little different, so the standings have a spread. Only
      // Games the blue side lost by a wide margin move: 13-7 isn't a score.
      const varied = RED_WINS.map(([red, blue]): [number, number] => [red, blue < 9 ? blue + (number % 3) : blue]);
      await playMatchup(night, { opening: number }, varied, { done: true });
    }
    // Seeded: the hand-off holds the stage alone until a Flight has a score.
    const tv = await open(browser, `/tools/team-tally/live/${night.publicToken}`, { width: 1366, height: 768 });
    await expect(tv.getByRole("region", { name: "Flights" })).toBeVisible();
    await expect(tv.getByRole("list", { name: "Screens" })).toHaveCount(0);
    await tv.context().close();
    await checkScreens(browser, ["handoff"]);

    for (const letter of ["A", "B", "C", "D", "E", "F", "G"]) {
      await playMatchup(night, { flight: letter }, letter < "D" ? RED_WINS : BLUE_WINS, { done: true });
    }
    await checkScreens(browser, ["summary", "flight-scores", "standings"]);
  });
});
