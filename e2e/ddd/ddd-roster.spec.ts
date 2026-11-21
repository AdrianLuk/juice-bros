import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { SHEET_CAPTAINS, SHEET_PASTE } from "../../src/lib/ddd/roster-sheet.ts";
import { cleanUp, createEvent, seedAccount, type DddAccount } from "../support/ddd.ts";
import { signIn } from "../support/sign-in.ts";

/**
 * Dink Dine & Drink: paste the roster (issue #712).
 *
 *   - paste the real sheet: the preview shows 4 Teams of 6 with the right
 *     Captains, and bad rows, a wrong Team count and a missing Captain are
 *     flagged before anything saves;
 *   - saving puts the roster on the Organizer's page and on the Public Link;
 *   - an Organizer edits, adds, moves and removes players, and the Public
 *     Link follows;
 *   - pasting again asks before it replaces the roster.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `Roster e2e ${RUN}`;

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
});

test.afterAll(async () => {
  await context?.close();
  if (organizer) await cleanUp(organizer, [DDD_NAME], [organizer]);
});

const preview = () => page.getByLabel("Preview", { exact: true });

test("pasting the sheet previews 4 Teams of 6 with their Captains, and flags what is wrong", async () => {
  await page.goto(`/tools/ddd/events/${eventId}/roster`);
  const box = page.getByLabel("Rows from the sheet");

  // A short paste: 1 Team, and one row that is not a row.
  await box.fill("Ann\tF\t4.0\t4.0\t4.0\t4.0\tAnn\nnot a row at all");
  await expect(page.getByText("Found 1 Team.")).toBeVisible();
  await expect(page.getByText("Row 2 has 1 columns")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save the roster" })).toBeDisabled();

  await box.fill(SHEET_PASTE);
  await expect(page.getByLabel("Problems with the paste")).toHaveCount(0);
  await expect(page.getByText("Preview: 4 Teams")).toBeVisible();
  for (const captain of SHEET_CAPTAINS) {
    await expect(preview().getByText(`Captain: ${captain}`)).toBeVisible();
  }
  await expect(preview().getByRole("row")).toHaveCount(24 + 4);

  // Ed Ju: ratings blank, average from the DUPR alone. The Wildcard has none.
  await expect(preview().getByRole("row", { name: /^Ed Ju/ })).toContainText("4.258");
  await expect(preview().getByRole("row", { name: /^Wildcard/ })).toContainText("–");

  await page.getByRole("button", { name: "Save the roster" }).click();
  await expect(page.getByText("Roster saved")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Federico Staksrud" })).toBeVisible();
});

test("the Public Link shows the 4 Teams with Ratings and Average Rating", async ({ browser }) => {
  await page.goto(`/tools/ddd/events/${eventId}`);
  const publicUrl = await page.getByRole("link", { name: /\/tools\/ddd\/live\// }).textContent();
  const visitor = await browser.newContext();
  try {
    const stranger = await visitor.newPage();
    await stranger.goto(publicUrl!);
    // Round 1 has headings of its own; the Teams' are the ones named after a Captain.
    const teamHeadings = stranger
      .getByRole("heading", { level: 2 })
      .filter({ hasText: new RegExp(`^(${SHEET_CAPTAINS.join("|")})$`) });
    await expect(teamHeadings).toHaveText(SHEET_CAPTAINS);
    await expect(stranger.getByText("Captain", { exact: true })).toHaveCount(4);
    await expect(stranger.getByRole("row", { name: /^Ed Ju/ })).toContainText("4.258");
    await expect(stranger.getByRole("row", { name: /^Riley Newman/ })).toContainText("2.425");
  } finally {
    await visitor.close();
  }
});

test("an Organizer edits, adds, moves and removes players", async () => {
  await page.goto(`/tools/ddd/events/${eventId}/roster`);

  const ed = page.getByRole("form", { name: "Edit Ed Ju" });
  await ed.getByLabel("DUAR").fill("3.5");
  await ed.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("form", { name: "Edit Ed Ju" }).getByText("Average 3.879")).toBeVisible();

  await page.getByRole("form", { name: "Edit Ed Ju" }).getByLabel("Team").selectOption({ label: "Anna Leigh Waters" });
  await page.getByRole("form", { name: "Edit Ed Ju" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Anna Leigh Waters" }).getByRole("form", { name: "Edit Ed Ju" })).toBeVisible();

  await page.getByText("Add a player to Federico Staksrud").click();
  const add = page.getByRole("form", { name: "Add a player to Federico Staksrud" });
  await add.getByLabel("Name").fill("Sam Newman");
  await add.getByLabel("DUPR").fill("3.25");
  await add.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByRole("form", { name: "Edit Sam Newman" })).toBeVisible();

  await page.getByRole("form", { name: "Edit Wildcard (Kevin Ah-Chuen)" }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("form", { name: "Edit Wildcard (Kevin Ah-Chuen)" })).toHaveCount(0);

  await page.goto(`/tools/ddd/events/${eventId}`);
  const publicUrl = await page.getByRole("link", { name: /\/tools\/ddd\/live\// }).textContent();
  await page.goto(publicUrl!);
  await expect(page.getByRole("region", { name: "Anna Leigh Waters" }).getByRole("row", { name: /^Ed Ju/ })).toContainText("3.879");
  await expect(page.getByRole("row", { name: /^Sam Newman/ })).toContainText("3.250");
  await expect(page.getByText("Wildcard")).toHaveCount(0);
});

test("pasting again asks before it replaces the roster", async () => {
  await page.goto(`/tools/ddd/events/${eventId}/roster`);
  await page.getByLabel("Rows from the sheet").fill(SHEET_PASTE);
  await page.getByRole("button", { name: "Replace the roster" }).click();
  await expect(page.getByText("This replaces every Team and player")).toBeVisible();

  await page.getByRole("button", { name: "Keep the current roster" }).click();
  await expect(page.getByRole("form", { name: "Edit Sam Newman" })).toBeVisible();

  await page.getByRole("button", { name: "Replace the roster" }).click();
  await page.getByRole("button", { name: "Yes, replace the roster" }).click();
  await expect(page.getByText("Roster saved")).toBeVisible();
  await expect(page.getByRole("form", { name: "Edit Sam Newman" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Edit Wildcard (Kevin Ah-Chuen)" })).toBeVisible();
});
