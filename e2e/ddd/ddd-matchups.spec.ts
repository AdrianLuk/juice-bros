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
 * Dink Dine & Drink: Round 2 and the Playoff (issue #716).
 *
 *   - all four Games of a Matchup scored on the Score Link: another phone on
 *     the Public Link sees the winner and every Team's shots, without a reload;
 *   - a Game with no Spread can't be scored;
 *   - an Organizer's call on a 2-2 needs a reason and survives a reload.
 *
 * The maths is unit-tested in src/lib/ddd/matchups.test.ts; the database
 * side in supabase/tests/ddd_matchups.test.sql.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Matchups e2e ${RUN}`;
// Round 1 seeds the Teams in roster order, so Round 2 is 1 v 4 and 2 v 3.
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
  await seedLineups(organizer, eventId);
  await seedRoundOne(organizer, eventId);
  // Every Spread is 5.5 on the later Team's Pair, but Seed 2 v Seed 3's Mixed 2 has none.
  await seedSpreads(organizer, eventId, [[1, 2, "mixed2"]]);
  links = await linkPaths(organizer, eventId);
});

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  contexts = [];
});

test.afterAll(async () => {
  if (organizer) await cleanUp(organizer, [DDD_NAME], [organizer]);
});

const topMatchup = (page: Page) => page.getByRole("article", { name: `Matchup: ${SEED_1} v ${SEED_4}` });
const tab = (page: Page, team: string) => page.getByRole("listitem", { name: `Tab: ${team}` });

async function enterFinal(matchup: Locator, game: string, first: number, fourth: number) {
  const row = matchup.getByRole("listitem", { name: game });
  await row.getByLabel(`${SEED_1} points`).fill(String(first));
  await row.getByLabel(`${SEED_4} points`).fill(String(fourth));
  await row.getByRole("button", { name: "Save final" }).click();
  await expect(row).toContainText("Spread winner");
}

test("four Games scored on the Score Link give the winner and the shots on the Public Link", async ({ browser }) => {
  const watcher = await phone(browser);
  await watcher.goto(links.public);
  await expect(topMatchup(watcher)).toContainText("Spread winners so far");
  // The Public Link only reads.
  await expect(topMatchup(watcher).getByRole("button", { name: "Save final" })).toHaveCount(0);

  const scorer = await phone(browser);
  await scorer.goto(links.score);
  const matchup = topMatchup(scorer);
  // Seed 4's Pair is the lower-rated one, against 5.5 every time.
  await enterFinal(matchup, "Men's doubles", 11, 6); // 6 beats 5.5: 1 shot on Seed 1
  await enterFinal(matchup, "Women's doubles", 11, 3); // 3 misses by 2.5: 3 shots on Seed 4
  await enterFinal(matchup, "Mixed 1", 11, 8); // 8 beats it by 2.5: 3 shots on Seed 1
  await enterFinal(matchup, "Mixed 2", 11, 2); // 2 misses by 3.5: 4 shots on Seed 4
  // 2-2; Seed 1's Spread margin is -0.5 + 2.5 - 2.5 + 3.5 = +3.
  await expect(matchup).toContainText(`${SEED_1} wins 2-2 on Spread margin, by 3.0.`);

  await expect(topMatchup(watcher)).toContainText(`${SEED_1} wins 2-2 on Spread margin`, { timeout: 10_000 });
  await expect(tab(watcher, SEED_1)).toContainText("4 shots");
  await expect(tab(watcher, SEED_4)).toContainText("7 shots");
  await expect(tab(watcher, SEED_2)).toContainText("0 shots");
});

test("a Game with no Spread can't be scored", async ({ browser }) => {
  const scorer = await phone(browser);
  await scorer.goto(links.score);
  const mixed2 = scorer
    .getByRole("article", { name: `Matchup: ${SEED_2} v ${SEED_3}` })
    .getByRole("listitem", { name: "Mixed 2" });
  await expect(mixed2).toContainText("Spread needed");
  await expect(mixed2.getByRole("button", { name: "Save final" })).toHaveCount(0);
});

test("an Organizer's call on a 2-2 needs a reason and survives a reload", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, organizer.email);
  await page.goto(`/tools/ddd/events/${eventId}/matchups`);

  const call = topMatchup(page).getByRole("form", { name: "Organizer's call" });
  await call.getByLabel("Winner").selectOption({ label: SEED_4 });
  await call.getByRole("button", { name: "Save the call" }).click();
  await expect(topMatchup(page).getByRole("alert").last()).toContainText("Say why");

  await call.getByLabel("Reason").fill("Coin toss at the court");
  await call.getByRole("button", { name: "Save the call" }).click();
  const called = `${SEED_4} wins 2-2 on an Organizer's call: Coin toss at the court`;
  await expect(topMatchup(page)).toContainText(called);

  await page.reload();
  await expect(topMatchup(page)).toContainText(called);
  await page.goto(links.public);
  await expect(topMatchup(page)).toContainText(called);
});
