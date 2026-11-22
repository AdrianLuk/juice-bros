import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { parseRoster } from "../../src/lib/ddd/roster.ts";
import { SHEET_CAPTAINS, SHEET_PASTE } from "../../src/lib/ddd/roster-sheet.ts";
import {
  cleanUp,
  createEvent,
  linkPaths,
  saveRoster,
  seedAccount,
  seedDoubles,
  seedLineups,
  seedRoundOne,
  seedSpreads,
  type DddAccount,
} from "../support/ddd.ts";
import { signIn } from "../support/sign-in.ts";

/**
 * Dink Dine & Drink: Punishments and the results (issue #718).
 *
 *   - the results page shows each Final place with its Team, Punishment and
 *     shots, and an Organizer's edit to a Punishment survives a reload and
 *     reaches the TV without one;
 *   - tapping a Team's shot total lists every Game that cost it shots.
 *
 * The breakdown is unit-tested in src/lib/ddd/matchups.test.ts (shotLines);
 * the column in supabase/tests/ddd_punishments.test.sql.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Results e2e ${RUN}`;
// The earlier Team wins every Game, so the Final places are in roster order.
const [FIRST, , , FOURTH] = SHEET_CAPTAINS;

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
  await seedSpreads(organizer, eventId);
  await seedDoubles(organizer, eventId);
  links = await linkPaths(organizer, eventId);
});

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  contexts = [];
});

test.afterAll(async () => {
  if (organizer) await cleanUp(organizer, [DDD_NAME], [organizer]);
});

const place = (page: Page, name: string) => page.getByRole("listitem", { name: `${name} place`, exact: true });

test("an Organizer's Punishment edit reaches the results on the TV", async ({ browser }) => {
  const tv = await phone(browser);
  await tv.goto(links.public);
  await tv.getByRole("link", { name: "Final places and Punishments" }).click();
  await expect(place(tv, "1st")).toContainText(FIRST);
  await expect(place(tv, "1st")).toContainText("1 bottle");
  await expect(place(tv, "1st")).toContainText("0 shots");
  // Round 2 and the Playoff both lost 11-3 against 5.5: 8 Games at 3 shots.
  await expect(place(tv, "4th")).toContainText(FOURTH);
  await expect(place(tv, "4th")).toContainText("4 bottles");
  await expect(place(tv, "4th")).toContainText("24 shots");

  const page = await phone(browser);
  await signIn(page, organizer.email);
  await page.goto(`/tools/ddd/events/${eventId}`);
  const form = page.getByRole("form", { name: "Punishments" });
  await expect(form.getByLabel("1st place")).toHaveValue("1 bottle");
  await expect(form.getByLabel("4th place")).toHaveValue("4 bottles");
  await form.getByLabel("4th place").fill("2 bottles + 3 shots");
  await form.getByRole("button", { name: "Save the Punishments" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved.");

  await page.reload();
  await expect(page.getByRole("form", { name: "Punishments" }).getByLabel("4th place")).toHaveValue("2 bottles + 3 shots");
  await expect(place(tv, "4th")).toContainText("2 bottles + 3 shots", { timeout: 10_000 });
});

test("tapping a Team's shot total lists the Games that cost it", async ({ browser }) => {
  const page = await phone(browser);
  await page.goto(links.public);
  const tab = page.getByRole("listitem", { name: `Tab: ${FOURTH}` });
  await expect(tab).toContainText("4th · 2 bottles + 3 shots");

  await tab.getByRole("button", { name: "24 shots" }).click();
  const lines = tab.getByRole("list", { name: `${FOURTH}'s shots, Game by Game` }).getByRole("listitem");
  await expect(lines).toHaveCount(8);
  await expect(lines.first()).toContainText(`Men's doubles v ${FIRST}`);
  await expect(lines.first()).toContainText("3 shots");
  await expect(lines.first()).toContainText("3-11 · Spread 5.5 on");

  // A Team that never lost against the Spread has nothing to open.
  await expect(page.getByRole("listitem", { name: `Tab: ${FIRST}` }).getByRole("button")).toHaveCount(0);
});
