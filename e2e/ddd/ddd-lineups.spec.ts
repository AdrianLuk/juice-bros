import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { SHEET_PASTE } from "../../src/lib/ddd/roster-sheet.ts";
import { cleanUp, createEvent, seedAccount, type DddAccount } from "../support/ddd.ts";
import { signIn } from "../support/sign-in.ts";

/**
 * Dink Dine & Drink: Lineups (issue #713).
 *
 *   - an Organizer types a Team's four Pairs; Ben Johns' Team is uneven
 *     (2 women, 4 men) and plays both women twice, which warns about nothing;
 *   - a broken Lineup still saves and shows each warning beside its Pair;
 *     fixing it clears them;
 *   - the Public Link shows the Lineup as soon as it is saved.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Lineup e2e ${RUN}`;

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
});

test.afterAll(async () => {
  await context?.close();
  if (organizer) await cleanUp(organizer, [DDD_NAME], [organizer]);
});

const BEN = "Ben Johns Lineup";

async function pick(pairs: Record<string, [string, string]>) {
  const form = page.getByRole("form", { name: BEN });
  for (const [game, [a, b]] of Object.entries(pairs)) {
    await form.locator(`select[name="${game}-1"]`).selectOption({ label: a });
    await form.locator(`select[name="${game}-2"]`).selectOption({ label: b });
  }
  await form.getByRole("button", { name: "Save Lineup" }).click();
  await expect(form.getByText("Saved.")).toBeVisible();
}

const section = () => page.getByRole("region", { name: "Ben Johns", exact: true });

test("an uneven Team, 2 women and 4 men, plays both women twice and warns about nothing", async () => {
  await page.goto(`/tools/ddd/events/${eventId}/lineups`);
  await pick({
    mens: ["Ben Johns (M)", "Ben Ortiz (M)"],
    womens: ["Ava Moreno (F)", "Cleo Park (F)"],
    mixed1: ["Ed Ju (M)", "Ava Moreno (F)"],
    mixed2: ["Wildcard (Kevin Ah-Chuen) (M)", "Cleo Park (F)"],
  });
  await expect(section().getByText(/in no Game|plays 3 Games|takes two|takes one|twice/)).toHaveCount(0);
});

test("a broken Lineup saves and warns beside the Pair; fixing it clears the warnings", async () => {
  await page.goto(`/tools/ddd/events/${eventId}/lineups`);
  await pick({
    mens: ["Ben Johns (M)", "Ava Moreno (F)"],
    mixed1: ["Ben Johns (M)", "Ava Moreno (F)"],
    mixed2: ["Ben Johns (M)", "Cleo Park (F)"],
  });

  await expect(section().getByText("Ava Moreno is a woman. Men's doubles takes two men.")).toBeVisible();
  await expect(section().getByText("Ben Johns plays 3 Games. Two is the most.")).toHaveCount(3);
  await expect(section().getByText("Ed Ju is in no Game.")).toBeVisible();

  // It stayed saved: a reload shows the same warnings.
  await page.reload();
  await expect(section().getByText("Ben Johns plays 3 Games. Two is the most.")).toHaveCount(3);

  await pick({
    mens: ["Ben Johns (M)", "Ben Ortiz (M)"],
    mixed1: ["Ed Ju (M)", "Ava Moreno (F)"],
    mixed2: ["Wildcard (Kevin Ah-Chuen) (M)", "Cleo Park (F)"],
  });
  await expect(section().getByText(/in no Game|plays 3 Games|takes two|takes one|twice/)).toHaveCount(0);
});

test("the Public Link shows the Lineup, and a Team with none shows no Lineup", async ({ browser }) => {
  await page.goto(`/tools/ddd/events/${eventId}`);
  const publicUrl = await page.getByRole("link", { name: /\/tools\/ddd\/live\// }).textContent();
  const visitor = await browser.newContext();
  try {
    const stranger = await visitor.newPage();
    await stranger.goto(publicUrl!);
    const ben = stranger.getByRole("region", { name: "Ben Johns", exact: true });
    await expect(ben.getByRole("listitem").filter({ hasText: /^Men's doubles/ })).toContainText("Ben Johns / Ben Ortiz");
    await expect(ben.getByRole("listitem").filter({ hasText: "Mixed 2" })).toContainText("Wildcard (Kevin Ah-Chuen) / Cleo Park");
    await expect(stranger.getByRole("region", { name: "Anna Leigh Waters", exact: true }).getByText("Men's doubles")).toHaveCount(0);
    await expect(stranger.getByText(/in no Game|plays 3 Games/)).toHaveCount(0);
  } finally {
    await visitor.close();
  }
});
