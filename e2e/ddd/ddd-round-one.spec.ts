import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { parseRoster } from "../../src/lib/ddd/roster.ts";
import { SHEET_CAPTAINS, SHEET_PASTE } from "../../src/lib/ddd/roster-sheet.ts";
import { cleanUp, createEvent, linkPaths, saveRoster, seedAccount, type DddAccount } from "../support/ddd.ts";
import { signIn } from "../support/sign-in.ts";

/**
 * Dink Dine & Drink: Round 1 (issue #715).
 *
 *   - two phones: one enters a Dreambreaker final on the Score Link, the
 *     other, on the Public Link, sees the Seeding move without a reload;
 *   - a score that isn't a final is refused;
 *   - an Organizer corrects a final and reorders a Rotation.
 *
 * The Seeding rules themselves are unit-tested in
 * src/lib/ddd/dreambreakers.test.ts; the database side in
 * supabase/tests/ddd_dreambreakers.test.sql.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Round 1 e2e ${RUN}`;
const [FIRST, SECOND] = SHEET_CAPTAINS;

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
  links = await linkPaths(organizer, eventId);
});

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  contexts = [];
});

test.afterAll(async () => {
  if (organizer) await cleanUp(organizer, [DDD_NAME], [organizer]);
});

const card = (page: Page) => page.getByRole("article", { name: `${FIRST} v ${SECOND}` });

test("a final entered on the Score Link moves the Seeding on another phone", async ({ browser }) => {
  const watcher = await phone(browser);
  await watcher.goto(links.public);
  await expect(card(watcher)).toContainText("On now");
  await expect(watcher.getByRole("listitem", { name: `Seed 2: ${SECOND}` })).toContainText("Level so far");
  // The Public Link only reads.
  await expect(watcher.getByRole("button", { name: "Save final" })).toHaveCount(0);

  const scorer = await phone(browser);
  await scorer.goto(links.score);
  await card(scorer).getByLabel(`${FIRST} points`).fill("15");
  await card(scorer).getByLabel(`${SECOND} points`).fill("21");
  await card(scorer).getByRole("button", { name: "Save final" }).click();
  await expect(card(scorer)).toContainText("Last entered by the Score Link");

  await expect(watcher.getByRole("listitem", { name: `Seed 1: ${SECOND}` })).toContainText("1-0", { timeout: 10_000 });
  await expect(card(watcher)).toContainText("Final");
  await expect(card(watcher)).toContainText("21");
});

test("a score that isn't a final is refused", async ({ browser }) => {
  const scorer = await phone(browser);
  await scorer.goto(links.score);
  const other = scorer.getByRole("article", { name: `${SHEET_CAPTAINS[2]} v ${SHEET_CAPTAINS[3]}` });
  await other.getByLabel(`${SHEET_CAPTAINS[2]} points`).fill("22");
  await other.getByLabel(`${SHEET_CAPTAINS[3]} points`).fill("20");
  // Past the input's own max, so the server's refusal is what shows.
  await other.getByLabel(`${SHEET_CAPTAINS[2]} points`).evaluate((input) => input.removeAttribute("max"));
  await other.getByRole("button", { name: "Save final" }).click();
  await expect(other.getByRole("alert")).toContainText("The winner has 21");
  await expect(other).toContainText("On now");
});

test("an Organizer corrects a final and reorders a Rotation", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, organizer.email);
  await page.goto(`/tools/ddd/events/${eventId}/round-1`);

  await card(page).getByRole("button", { name: "Correct the score" }).click();
  await card(page).getByLabel(`${FIRST} points`).fill("21");
  await card(page).getByLabel(`${SECOND} points`).fill("19");
  await card(page).getByRole("button", { name: "Save final" }).click();
  await expect(card(page)).toContainText("Last entered by an Organizer");
  await expect(page.getByRole("listitem", { name: `Seed 1: ${FIRST}` })).toBeVisible();

  const rotation = page.getByRole("group", { name: `${FIRST} Rotation` });
  const second = await rotation.getByRole("listitem").nth(1).locator("span").textContent();
  await rotation.getByRole("button", { name: `Move ${second} up` }).click();
  await expect(rotation.getByRole("listitem").first()).toContainText(second!);
});
