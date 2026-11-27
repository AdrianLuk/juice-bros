import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { parseRoster } from "../../src/lib/ddd/roster.ts";
import { SHEET_PASTE } from "../../src/lib/ddd/roster-sheet.ts";
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

/**
 * Dink Dine & Drink: a player's Goal before they walk on.
 *
 *   - the court cards show each Pair's Goal for what is on now and up next;
 *   - "Your games": pick your name once on the Public Link and this phone
 *     keeps your Games and Goals at the top, through a reload, until "Not you?".
 *
 * Which Games a player plays is unit-tested in src/lib/ddd/my-games.test.ts.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Your games e2e ${RUN}`;

let organizer: DddAccount;
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
  const eventId = await createEvent(organizer, DDD_NAME);
  await saveRoster(organizer, eventId, parseRoster(SHEET_PASTE).teams);
  await seedLineups(organizer, eventId);
  await seedRoundOne(organizer, eventId);
  // 5.5 on the later Team's Pair: in Seed 1 v Seed 4, Ben Johns' Pairs hold to 5 and Federico Staksrud's score 6+.
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

test("the court cards show each Pair's Goal", async ({ browser }) => {
  const page = await phone(browser);
  await page.goto(links.public);
  const court1 = page.getByRole("listitem", { name: "Court 1", exact: true });
  await expect(court1).toContainText(/On now\s*Men's doubles/);
  await expect(court1).toContainText("Goal: Hold to 5");
  await expect(court1).toContainText("Goal: Score 6+");
  await expect(court1).toContainText("Underdog");
});

test("a player picks their name once and keeps their Games and Goals at the top", async ({ browser }) => {
  const page = await phone(browser);
  await page.goto(links.public);
  await page.getByRole("region", { name: "Your games" }).getByLabel("Who are you?").selectOption({ label: "Ava Moreno" });

  const mine = page.getByRole("region", { name: "Ava Moreno", exact: true });
  const womens = mine.getByRole("listitem", { name: "Women's doubles", exact: true });
  await expect(womens).toContainText("On now · Court 2");
  await expect(womens).toContainText("With Cleo Park v Mia Sato / Opal Ray");
  await expect(womens).toContainText("Goal: Hold to 5");
  await expect(mine.getByRole("listitem", { name: "Mixed 1", exact: true })).toContainText("Up next");

  // The phone remembers who it is.
  await page.reload();
  await expect(page.getByRole("region", { name: "Ava Moreno", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Not you?" }).click();
  await expect(page.getByRole("region", { name: "Your games" }).getByLabel("Who are you?")).toBeVisible();
});
