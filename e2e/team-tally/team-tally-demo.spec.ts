import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Team Tally's demo night (issue #631), signed out: the real screens on a
 * night folded in the browser.
 *
 *   - a score entered on the Score Link shows on the TV and the Public Link,
 *     and 13-9 is refused with the real message;
 *   - your Matchup, tied, needs its Dreambreaker before Matchup done;
 *   - Let it run places the Flights and reaches the results; Reset brings the
 *     night back;
 *   - it fits a phone, and the landing links to it.
 *
 * Nothing here touches the database, so there is nothing to seed or clean up.
 * Let it run is driven by Playwright's clock rather than waited out.
 */

const DEMO = "/tools/team-tally/demo";

function tab(page: Page, name: string): Locator {
  return page.getByRole("tab", { name, exact: true });
}

function game(page: Page, round: number, kind: "captains'" | "teammates'"): Locator {
  return page.getByRole("form", { name: `Round ${round}, ${kind} game` });
}

/** Types a score until both boxes hold it, in case hydration wiped the first try, then saves. */
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

test("a score on the Score Link shows on the TV and the Public Link, and 13-9 is refused", async ({ page }) => {
  await page.goto(DEMO);
  await expect(page.getByText("Nothing here is real or saved")).toBeVisible();
  await expect(page.getByText("Team Ben Johns · Score link")).toBeVisible();
  await expect(page.getByTestId("demo-progress")).toHaveText("Opening round · 4 of 7 Matchups done");
  await expect(page.getByRole("region", { name: "Round 2, live" })).toBeVisible();

  await enterScore(page, 2, "captains'", 13, 9);
  await expect(game(page, 2, "captains'").getByRole("alert")).toHaveText("13-9 can't happen: the game ends at 11-9");

  await enterScore(page, 2, "captains'", 11, 8);
  await expect(game(page, 2, "captains'").getByText("Entered by Team Ben Johns")).toBeVisible();

  // Round 1 was 20-18 to Golden Set; 11 more makes 31.
  await tab(page, "TV").click();
  const tv = page.getByLabel("Big screen");
  await expect(tv).toBeVisible();
  await expect(tv.getByRole("listitem").filter({ hasText: "Golden Set" }).getByLabel("Total 31")).toBeVisible();

  await tab(page, "Public Link").click();
  await expect(page.getByRole("table", { name: "Match 1 · Courts 16 & 19" }).getByRole("row").first()).toContainText(
    "31",
  );
});

test("your tied Matchup needs its Dreambreaker, then Let it run ends the night and Reset brings it back", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(DEMO);
  await expect(page.getByText("Team Ben Johns · Score link")).toBeVisible();

  // Rounds 2 and 3 leave it level at 59-59.
  await enterScore(page, 2, "captains'", 9, 11);
  await enterScore(page, 2, "teammates'", 11, 9);
  await enterScore(page, 3, "captains'", 9, 11);
  await enterScore(page, 3, "teammates'", 10, 10);

  const finish = page.getByRole("region", { name: "Finish the Matchup" });
  await finish.getByRole("button", { name: "Matchup done" }).click();
  await expect(finish.getByRole("alert")).toHaveText("Tied 59-59. Record who won the Dreambreaker first.");
  await finish.getByRole("button", { name: "Golden Set won" }).click();
  await expect(finish.getByRole("button", { name: "Golden Set won" })).toHaveAttribute("aria-pressed", "true");
  await finish.getByRole("button", { name: "Matchup done" }).click();
  await page.getByRole("button", { name: "Yes, it's done" }).click();
  await expect(page.getByText("Marked done by Team Ben Johns.")).toBeVisible();
  await expect(page.getByTestId("demo-progress")).toHaveText("Opening round · 5 of 7 Matchups done");

  await page.getByTestId("demo-let-it-run").click();
  await page.clock.runFor(30_000);
  await expect(page.getByTestId("demo-progress")).toContainText("Flights ·");
  await page.clock.runFor(120_000);
  await expect(page.getByTestId("demo-progress")).toHaveText("Final · results are up");
  await expect(page.getByTestId("demo-let-it-run")).toBeDisabled();
  await expect(page.getByText("The night is over, so this link is read-only.")).toBeVisible();

  await tab(page, "Public Link").click();
  await expect(page.getByRole("region", { name: "Results" })).toBeVisible();
  await expect(page.getByText("Final places").first()).toBeVisible();

  await page.getByTestId("demo-reset").click();
  await expect(page.getByTestId("demo-progress")).toHaveText("Opening round · 4 of 7 Matchups done");
  await tab(page, "Score Link").click();
  await expect(page.getByRole("region", { name: "Round 2, live" })).toBeVisible();
});

test("the Organizer's board and the Brief show the same night", async ({ page }) => {
  await page.goto(DEMO);
  await tab(page, "Organizer").click();
  await expect(page.getByRole("region", { name: "The Flights" })).toContainText("4 of 7 Matchups done");

  await tab(page, "Brief").click();
  const brief = page.getByLabel("The brief");
  await expect(brief).toContainText("MATCH 1 — Courts 16 & 19");
  await expect(brief).toContainText("Ben Johns • Anna Leigh Waters • Collin Johns • Anna Bright");
  await expect(page.getByRole("button", { name: "Copy brief" })).toBeVisible();

  await expect(page.getByTestId("demo-build-a-night")).toHaveAttribute(
    "href",
    "/tools/team-tally/sign-in?next=%2Ftools%2Fteam-tally%2Fevents%2Fnew",
  );
});

test("on a phone it fits the screen, and the landing page leads to it", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto("/tools/team-tally");
  await page.getByRole("link", { name: "Try a demo night" }).click();
  await expect(page).toHaveURL(/\/tools\/team-tally\/demo$/);
  await expect(page.getByText("Team Ben Johns · Score link")).toBeVisible();

  for (const name of ["Score Link", "Public Link", "TV", "Organizer", "Brief"]) {
    await tab(page, name).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${name} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});

test("on the TV, tapping a screen's name cuts to it and its countdown starts over", async ({ page }) => {
  await page.clock.install();
  await page.goto(DEMO);
  await tab(page, "TV").click();
  const tv = page.getByLabel("Big screen");
  const screens = tv.getByRole("list", { name: "Screens" });
  await expect(tv.getByRole("region", { name: "Standings" })).toBeVisible();
  await expect(screens.locator("li[aria-current] .tt-tv-pie")).toHaveCount(1);

  await screens.getByRole("button", { name: "Matchups 5 to 7" }).click();
  await expect(tv.getByRole("region", { name: "Matchups 5 to 7" })).toBeVisible();
  await expect(tv.getByRole("region", { name: "Standings" })).toBeHidden();
  await expect(screens.getByRole("listitem").nth(2)).toHaveAttribute("aria-current", "true");

  // Its dwell (10s) starts from the tap, then the cycle wraps to the standings.
  await page.clock.fastForward(9_000);
  await expect(tv.getByRole("region", { name: "Matchups 5 to 7" })).toBeVisible();
  await page.clock.fastForward(2_000);
  await expect(tv.getByRole("region", { name: "Standings" })).toBeVisible();
});
