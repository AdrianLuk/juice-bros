import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Team Tally's signed-out landing (issue #636): the whole night, sold with
 * previews built from the real components on a made-up night.
 *
 *   - every section is there, and it ends on Try the demo and Build a night;
 *   - the Score Link preview works: Round 2's captains' game is already in
 *     with who entered it, 13-9 gets the real refusal, a real score saves;
 *   - the hero's standings re-sort once a score lands;
 *   - no sideways scroll on a phone or a desktop.
 *
 * Signed out and folded in the browser, so nothing to seed or clean up.
 */

const LANDING = "/tools/team-tally";

const SECTIONS = [
  "How a night runs",
  "One night, five screens",
  "Flights place themselves",
  "It runs without you",
  "No TV? Fine.",
  "The format it runs",
  "Questions",
  "Try a night before you run one",
];

function scoreLink(page: Page): Locator {
  return page.getByRole("article", { name: "Score Link" });
}

test("the landing walks through the whole night and ends on the demo and a way to build one", async ({ page }) => {
  await page.goto(LANDING);

  for (const name of SECTIONS) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  for (const name of ["Score Link", "Public Link", "TV", "Organizer", "Brief"]) {
    await expect(page.getByRole("heading", { level: 3, name, exact: true })).toBeVisible();
  }

  await expect(page.getByLabel("An excerpt of the brief")).toContainText("MATCH 1 — Courts 16 & 19");
  await expect(page.getByRole("region", { name: "Flight A · Courts 16 & 19" })).toBeVisible();
  await expect(page.getByText("13-9 can't happen: the game ends at 11-9")).toBeVisible();

  await expect(page.getByRole("link", { name: "Try the demo", exact: true })).toHaveAttribute(
    "href",
    "/tools/team-tally/demo",
  );
  await expect(page.getByRole("link", { name: "Build a night", exact: true })).toHaveAttribute(
    "href",
    "/tools/team-tally/sign-in?next=%2Ftools%2Fteam-tally%2Fevents%2Fnew",
  );
});

test("the Score Link preview refuses 13-9 and saves a real score", async ({ page }) => {
  await page.goto(LANDING);
  await expect(
    scoreLink(page).getByRole("form", { name: "Round 2, captains' game" }).getByText("Entered by Team Ben Johns"),
  ).toBeVisible();
  const form = scoreLink(page).getByRole("form", { name: "Round 2, teammates' game" });
  const red = form.getByLabel("Golden Set points");
  const blue = form.getByLabel("Team Federico Staksrud points");

  await expect(async () => {
    await red.fill("13");
    await blue.fill("9");
    await expect(red).toHaveValue("13", { timeout: 500 });
    await expect(blue).toHaveValue("9", { timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await form.getByRole("button", { name: "Save score" }).click();
  await expect(form.getByRole("alert")).toHaveText("13-9 can't happen: the game ends at 11-9");

  await red.fill("11");
  await blue.fill("9");
  await form.getByRole("button", { name: "Save score" }).click();
  // Round 2 is in: it folds to one line under a FINAL stamp, and Round 3 leads.
  const round2 = scoreLink(page).locator("details", { hasText: "Round 2" });
  await expect(round2).toContainText("11–7 · 11–9");
  await expect(round2).toContainText("Final");
  await expect(scoreLink(page).getByRole("region", { name: "Round 3, live" })).toBeVisible();
});

test("the hero's standings re-sort when the score lands", async ({ page }) => {
  await page.goto(LANDING);
  const standings = page.getByRole("figure", { name: "An example night, mid Round 2" }).getByRole("list", {
    name: "Standings · opening round",
  });
  await expect(standings.getByRole("listitem").first()).toContainText("Third Shot Club");
  await expect(standings.getByRole("listitem").first()).toContainText("Golden Set", { timeout: 10_000 });
});

for (const width of [390, 1440]) {
  test(`at ${width} wide it never scrolls sideways, and ends at the footer`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    await page.goto(LANDING);
    await expect(page.getByRole("heading", { level: 2, name: "Questions" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Nothing inside the previews (the phone frame scrolls its own content)
    // may stretch the page into blank space below the site footer.
    const pastFooter = await page.evaluate(() => {
      const footer = [...document.querySelectorAll("footer")].pop()!;
      return document.documentElement.scrollHeight - (footer.getBoundingClientRect().bottom + window.scrollY);
    });
    expect(pastFooter).toBeLessThanOrEqual(1);
  });
}
