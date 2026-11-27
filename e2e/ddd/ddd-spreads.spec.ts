import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { SHEET_PASTE } from "../../src/lib/ddd/roster-sheet.ts";
import { cleanUp, createEvent, seedAccount, seedLineups, type DddAccount } from "../support/ddd.ts";
import { signIn } from "../support/sign-in.ts";

/**
 * Dink Dine & Drink: the 24 Spreads (issue #714).
 *
 *   - 4 Teams make 6 pairings of 4 Games each, every empty cell reading
 *     "Spread needed", and a Spread that does not end in .5 is refused;
 *   - all 24 are entered, and a reload and the Public Link both show 24;
 *   - a Lineup change flags the Spread for a re-check, and saving clears it.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Spreads e2e ${RUN}`;
const GAMES = ["mens", "womens", "mixed1", "mixed2"];

let organizer: DddAccount;
let eventId: string;
let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  organizer = await seedAccount(true);
  eventId = await createEvent(organizer, DDD_NAME);
  context = await browser.newContext();
  page = await context.newPage();
  await signIn(page, organizer.email);
  await page.goto(`/tools/ddd/events/${eventId}/roster`);
  await page.getByLabel("Rows from the sheet").fill(SHEET_PASTE);
  await page.getByRole("button", { name: "Save the roster" }).click();
  await expect(page.getByText("Roster saved")).toBeVisible();
  await seedLineups(organizer, eventId);
});

test.afterAll(async () => {
  await context?.close();
  if (organizer) await cleanUp(organizer, [DDD_NAME], [organizer]);
});

const forms = () => page.getByRole("form", { name: /forecasts$/ });

test("6 pairings of 4 Games, every cell naming its Pairs and reading Spread needed", async () => {
  await page.goto(`/tools/ddd/events/${eventId}/spreads`);
  await expect(forms()).toHaveCount(6);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Ben Johns v Anna Leigh Waters",
    "Ben Johns v Tyson McGuffin",
    "Ben Johns v Federico Staksrud",
    "Anna Leigh Waters v Tyson McGuffin",
    "Anna Leigh Waters v Federico Staksrud",
    "Tyson McGuffin v Federico Staksrud",
  ]);
  await expect(page.getByText("Forecast needed", { exact: true })).toHaveCount(24);
  // Ben Johns' men's doubles is Ben Johns and Ben Ortiz; Anna's is Gus Hale's pair.
  const options = forms().first().locator('select[name="mens-lower"] option');
  await expect(options.nth(1)).toHaveText("Ben Johns / Ben Ortiz (Ben Johns)");
  await expect(options.nth(2)).toHaveText("Eli Banks / Gus Hale (Anna Leigh Waters)");
});

test("a Spread that does not end in .5 or is out of range is refused, and nothing saves", async () => {
  await page.goto(`/tools/ddd/events/${eventId}/spreads`);
  const first = forms().first();
  await first.locator('select[name="mens-lower"]').selectOption("a");
  await first.locator('input[name="mens-points"]').fill("5");
  await first.locator('select[name="womens-lower"]').selectOption("b");
  await first.locator('input[name="womens-points"]').fill("3.5");
  await first.getByRole("button", { name: "Save forecasts" }).click();
  await expect(first.getByRole("alert")).toContainText("Men's doubles: 5 is refused: a forecast always ends in .5");
  // What was typed stays put, so the Organizer fixes one cell instead of retyping the pairing.
  await expect(first.locator('select[name="mens-lower"]')).toHaveValue("a");
  await expect(first.locator('input[name="womens-points"]')).toHaveValue("3.5");

  await first.locator('input[name="mens-points"]').fill("11.5");
  await first.getByRole("button", { name: "Save forecasts" }).click();
  await expect(first.getByRole("alert")).toContainText("forecasts run 0.5 to 10.5");

  await page.reload();
  await expect(page.getByText("Forecast needed", { exact: true })).toHaveCount(24);
});

test("all 24 are entered, and a reload and the Public Link show all 24", async ({ browser }) => {
  await page.goto(`/tools/ddd/events/${eventId}/spreads`);
  const count = await forms().count();
  for (let i = 0; i < count; i++) {
    const form = forms().nth(i);
    for (const [g, game] of GAMES.entries()) {
      await form.locator(`select[name="${game}-lower"]`).selectOption(g % 2 === 0 ? "a" : "b");
      await form.locator(`input[name="${game}-points"]`).fill(`${g + 1}.5`);
    }
    await form.getByRole("button", { name: "Save forecasts" }).click();
    await expect(form.getByText("Saved.")).toBeVisible();
  }

  await page.reload();
  await expect(page.getByText("Forecast needed", { exact: true })).toHaveCount(0);
  await expect(page.locator('input[name$="-points"]')).toHaveCount(24);
  for (const [g, game] of GAMES.entries()) {
    for (const input of await page.locator(`input[name="${game}-points"]`).all()) await expect(input).toHaveValue(`${g + 1}.5`);
  }

  await page.goto(`/tools/ddd/events/${eventId}`);
  const publicUrl = await page.getByRole("link", { name: /\/tools\/ddd\/live\// }).textContent();
  const visitor = await browser.newContext();
  try {
    const stranger = await visitor.newPage();
    await stranger.goto(publicUrl!);
    // The Order of play: one Underdog per Game, 4 Games in each of the 6 pairings.
    await expect(stranger.getByText("Underdog", { exact: true })).toHaveCount(24);
    await expect(stranger.getByText("Forecast needed")).toHaveCount(0);
    // Ben Johns' Pair is the lower-rated one in Men's doubles against 1.5, in each of his 3 pairings.
    const benPair = stranger.getByRole("listitem").filter({ hasText: /^Ben Johns \/ Ben Ortiz/ });
    await expect(benPair.filter({ hasText: "Score 2+" })).toHaveCount(3);
  } finally {
    await visitor.close();
  }
});

test("a Lineup change flags the Spread for a re-check and keeps it; saving clears the flag", async () => {
  // Ben Johns' Team swaps a man into men's doubles.
  await page.goto(`/tools/ddd/events/${eventId}/lineups`);
  const lineup = page.getByRole("form", { name: "Ben Johns Lineup" });
  await lineup.locator('select[name="mens-2"]').selectOption({ label: "Ed Ju (M)" });
  await lineup.getByRole("button", { name: "Save Lineup" }).click();
  await expect(lineup.getByText("Saved.")).toBeVisible();

  await page.goto(`/tools/ddd/events/${eventId}/spreads`);
  const flag = page.getByText("The Lineup changed since this forecast was set");
  await expect(flag).toHaveCount(3);
  await expect(forms().first().locator('input[name="mens-points"]')).toHaveValue("1.5");

  const first = forms().first();
  await first.getByRole("button", { name: "Save forecasts" }).click();
  await expect(first.getByText("Saved.")).toBeVisible();
  await expect(flag).toHaveCount(2);
});
