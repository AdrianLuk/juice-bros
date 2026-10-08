import { expect, test, type Page } from "@playwright/test";

import { deleteTeamEventOrganizer, seedTeamEvent, type SeededTeamEvent } from "./support/team-tally.ts";

/**
 * Team Tally: Score Links and live scoring (issue #623).
 *
 *   - two captains of one Matchup, each on their own Score Link: a score
 *     entered on one phone shows on the other and on the Public Link, with
 *     the Team that entered it, and no reload;
 *   - a score no Game can end on is refused with the reason;
 *   - a captain renames a slot and the new name shows in that Round.
 *
 * The night is seeded straight through the save function as a throwaway
 * Organizer (e2e/support/team-tally.ts); its Matchup 1 is Golden Set (Ben
 * Johns, red) against Team Federico Staksrud (blue). Names are PPA Tour pros.
 */

let night: SeededTeamEvent;

test.beforeAll(async () => {
  night = await seedTeamEvent();
});

test.afterAll(async () => {
  if (night) await deleteTeamEventOrganizer(night);
});

function game(page: Page, round: number, kind: "captains'" | "teammates'") {
  return page.getByRole("form", { name: `Round ${round}, ${kind} game` });
}

/** Types a score until both boxes hold it, in case hydration wiped the first try. */
async function enterScore(page: Page, round: number, kind: "captains'" | "teammates'", red: number, blue: number) {
  const form = game(page, round, kind);
  const redBox = form.getByLabel("Golden Set points");
  const blueBox = form.getByLabel("Team Federico Staksrud points");
  await expect(async () => {
    await redBox.fill(String(red));
    await blueBox.fill(String(blue));
    await expect(redBox).toHaveValue(String(red), { timeout: 500 });
    await expect(blueBox).toHaveValue(String(blue), { timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await form.getByRole("button", { name: "Save score" }).click();
}

test("a score entered on one captain's phone shows on the other's and on the Public Link", async ({ browser }) => {
  const benPage = await (await browser.newContext()).newPage();
  const fedPage = await (await browser.newContext()).newPage();
  const publicPage = await (await browser.newContext()).newPage();

  await benPage.goto(`/tools/team-tally/score/${night.scoreTokens[0]}`);
  await fedPage.goto(`/tools/team-tally/score/${night.scoreTokens[1]}`);
  await publicPage.goto(`/tools/team-tally/live/${night.publicToken}`);

  await expect(benPage.getByText("Team Ben Johns · Score link")).toBeVisible();
  await expect(fedPage.getByText("Team Federico Staksrud · Score link")).toBeVisible();
  // Round 1's captains' game: Ben with Player A against Federico with his.
  await expect(game(benPage, 1, "captains'")).toContainText("Ben Johns + Anna Leigh Waters");
  await expect(game(benPage, 1, "captains'")).toContainText("Federico Staksrud + Catherine Parenteau");

  await enterScore(benPage, 1, "captains'", 11, 8);
  await expect(game(benPage, 1, "captains'")).toContainText("Entered by Team Ben Johns");

  // The other captain's phone, already open, catches up on its own.
  const fedGame = game(fedPage, 1, "captains'");
  await expect(fedGame).toContainText("Entered by Team Ben Johns");
  await expect(fedGame.getByLabel("Golden Set points")).toHaveValue("11");
  await expect(fedGame.getByLabel("Team Federico Staksrud points")).toHaveValue("8");
  await expect(fedPage.getByRole("table", { name: "Match 1 · Courts 16 & 19" })).toContainText("11");

  // So does the Public Link, standings first.
  const standings = publicPage.getByRole("list", { name: "Standings · opening round" });
  await expect(standings.getByRole("listitem").filter({ hasText: "Golden Set" }).getByLabel("Total 11")).toBeVisible();
  await publicPage.getByText("Match 1 games").click();
  await expect(publicPage.getByRole("region", { name: "Match 1 games" })).toContainText("Entered by Team Ben Johns");

  // Federico's captain corrects it; Ben's phone shows who did.
  await expect(async () => {
    await fedGame.getByLabel("Golden Set points").fill("11");
    await fedGame.getByLabel("Team Federico Staksrud points").fill("9");
    await expect(fedGame.getByLabel("Team Federico Staksrud points")).toHaveValue("9", { timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await fedGame.getByRole("button", { name: "Save score" }).click();
  await expect(game(benPage, 1, "captains'")).toContainText("Entered by Team Federico Staksrud");
  await expect(game(benPage, 1, "captains'").getByLabel("Team Federico Staksrud points")).toHaveValue("9");
});

test("a score no game can end on is refused with the reason", async ({ page }) => {
  await page.goto(`/tools/team-tally/score/${night.scoreTokens[0]}`);
  await enterScore(page, 1, "teammates'", 13, 9);
  await expect(game(page, 1, "teammates'")).toContainText("13-9 can't happen: the game ends at 11-9");
});

test("a captain renames a slot and the new name shows in that Round", async ({ page }) => {
  await page.goto(`/tools/team-tally/score/${night.scoreTokens[0]}`);

  const roster = page.getByRole("form", { name: "Your roster" });
  // Round 1 has a score, so Player A is pinned.
  await expect(roster.getByLabel("Player A")).toHaveAttribute("readonly", "");
  await expect(async () => {
    await roster.getByLabel("Player B").fill("Tyra Black");
    await expect(roster.getByLabel("Player B")).toHaveValue("Tyra Black", { timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await roster.getByRole("button", { name: "Save roster" }).click();
  await expect(roster).toContainText("Roster saved.");

  await page.locator("summary").filter({ hasText: "Round 2" }).click();
  await expect(game(page, 2, "captains'")).toContainText("Ben Johns + Tyra Black");
});
