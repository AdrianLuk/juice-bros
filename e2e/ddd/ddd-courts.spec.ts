import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

import { parseRoster } from "../../src/lib/ddd/roster.ts";
import { SHEET_CAPTAINS, SHEET_PASTE } from "../../src/lib/ddd/roster-sheet.ts";
import {
  cleanUp,
  createEvent,
  linkPaths,
  saveRoster,
  seedAccount,
  seedLineups,
  seedRoundOne,
  seedSpreads,
  type DddAccount,
} from "../support/ddd.ts";
import { signIn } from "../support/sign-in.ts";

/**
 * Dink Dine & Drink: courts (issue #717).
 *
 *   - the first Court turn of a Matchup finishes on the Score Link, and the
 *     court cards on another phone move on to the second;
 *   - an Organizer swaps a Matchup's Court turns and moves a Game to another
 *     court, and both survive a reload and reach every phone.
 *
 * The split and the court assignment are unit-tested in
 * src/lib/ddd/courts.test.ts. Screens never say "Court turn": a Game is On
 * now, Up next or Final.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Courts e2e ${RUN}`;
// Round 1 seeds the Teams in roster order: Seed 1 v 4 on courts 1-2, Seed 2 v 3 on courts 3-4.
const [SEED_1, SEED_2, SEED_3, SEED_4] = SHEET_CAPTAINS;

let organizer: DddAccount;
let eventId: string;
let links: { score: string; public: string };
let contexts: BrowserContext[] = [];

async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  contexts.push(context);
  return context.newPage();
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  organizer = await seedAccount(true);
  eventId = await createEvent(organizer, DDD_NAME);
  await saveRoster(organizer, eventId, parseRoster(SHEET_PASTE).teams);
  // Each woman plays women's doubles and one mixed Game, so men's + women's go first.
  await seedLineups(organizer, eventId);
  await seedRoundOne(organizer, eventId);
  await seedSpreads(organizer, eventId);
  links = await linkPaths(organizer, eventId);
});

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  contexts = [];
});

test.afterAll(async () => {
  if (organizer) await cleanUp(organizer, [DDD_NAME], [organizer]);
});

const court = (page: Page, name: string) => page.getByRole("listitem", { name: `Court ${name}`, exact: true });
const matchup = (page: Page, a: string, b: string) => page.getByRole("article", { name: `Matchup: ${a} v ${b}` });
const game = (m: Locator, label: string) => m.getByRole("listitem", { name: label, exact: true });

test("finishing the first Games of a Matchup moves the court cards on", async ({ browser }) => {
  const watcher = await phone(browser);
  await watcher.goto(links.public);
  await expect(court(watcher, "1")).toContainText(/On now\s*Men's doubles/);
  await expect(court(watcher, "1")).toContainText(/Up next\s*Mixed 1/);
  await expect(court(watcher, "2")).toContainText(/On now\s*Women's doubles/);

  const scorer = await phone(browser);
  await scorer.goto(links.score);
  const top = matchup(scorer, SEED_1, SEED_4);
  for (const label of ["Men's doubles", "Women's doubles"]) {
    const row = game(top, label);
    await row.getByLabel(`${SEED_1} points`).fill("11");
    await row.getByLabel(`${SEED_4} points`).fill("4");
    await row.getByRole("button", { name: "Save final" }).click();
    await expect(row).toContainText("Final");
  }

  await expect(court(watcher, "1")).toContainText(/On now\s*Mixed 1/, { timeout: 10_000 });
  await expect(court(watcher, "2")).toContainText(/On now\s*Mixed 2/);
  await expect(court(watcher, "1")).toContainText(/Up next\s*Free/);
});

test("an Organizer's swap and move survive a reload and reach every phone", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, organizer.email);
  await page.goto(`/tools/ddd/events/${eventId}/matchups`);

  const bottom = matchup(page, SEED_2, SEED_3);
  await expect(game(bottom, "Men's doubles")).toContainText("On now");
  await bottom.getByRole("button", { name: "Swap which Games play first" }).click();
  await expect(game(bottom, "Mixed 1")).toContainText("On now");
  await expect(game(bottom, "Men's doubles")).toContainText("Up next");

  await game(bottom, "Mixed 2").getByLabel("Court", { exact: true }).selectOption({ label: "Court 1" });
  await expect(game(bottom, "Mixed 2").locator(".ddd-db-court")).toHaveText("Court 1");

  await page.reload();
  await expect(game(bottom, "Mixed 1")).toContainText("On now");
  await expect(game(bottom, "Mixed 2").locator(".ddd-db-court")).toHaveText("Court 1");

  const watcher = await phone(browser);
  await watcher.goto(links.public);
  await expect(court(watcher, "3")).toContainText(/On now\s*Mixed 1/);
  await expect(game(matchup(watcher, SEED_2, SEED_3), "Mixed 2").locator(".ddd-db-court")).toHaveText("Court 1");
});
