import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { torontoDate } from "../support/dates.ts";
import { cleanUp, seedAccount, type DddAccount } from "../support/ddd.ts";
import { signIn } from "../support/sign-in.ts";

/**
 * Dink Dine & Drink: Organizers sign in, invite each other and create a DDD
 * (issue #711).
 *
 *   - an account off the Organizer list is told to ask for an invite;
 *   - an Organizer draws the play venue, books its courts and creates a DDD,
 *     which opens with its header, courts and both links;
 *   - the Score Link and the Public Link open on the DDD header, no account;
 *   - an invite link puts the other account on the list, and it sees the DDD.
 *
 * Google sign-in can't be driven here, so both accounts sign in with a
 * password; the invite is joined with the signed-in Join button. The
 * database side (single use, expiry, the Superadmin) is in
 * supabase/tests/ddd_organizers.test.sql.
 */

const RUN = Date.now().toString(36);
const DDD_NAME = `DDD e2e ${RUN}`;
const VENUE_NAME = `Hall ${RUN}`;

let organizer: DddAccount;
let outsider: DddAccount;
let contexts: BrowserContext[] = [];

/** A page in a fresh context: one account per context, closed after the test. */
async function open(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  contexts.push(context);
  return context.newPage();
}

test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  contexts = [];
});

test.beforeAll(async () => {
  [organizer, outsider] = await Promise.all([seedAccount(true), seedAccount(false)]);
});

test.afterAll(async () => {
  if (organizer && outsider) await cleanUp(organizer, [DDD_NAME, VENUE_NAME], [organizer, outsider]);
});

test("an Organizer creates a DDD and invites another Organizer, who sees it", async ({ browser }) => {
  const outsiderPage = await open(browser);
  await signIn(outsiderPage, outsider.email);
  await outsiderPage.goto("/tools/ddd");
  await expect(outsiderPage.getByRole("heading", { name: "Ask for an invite" })).toBeVisible();
  await expect(outsiderPage.getByRole("link", { name: "New DDD" })).toHaveCount(0);

  const page = await open(browser);
  await signIn(page, organizer.email);
  await page.goto("/tools/ddd");
  await page.getByRole("link", { name: "New DDD" }).click();

  await page.getByLabel("Name", { exact: true }).fill(DDD_NAME);
  await page.getByLabel("Date").fill(torontoDate(7));
  // Other runs may have left Venues; the drawing opens by itself only when there are none.
  const draw = page.getByRole("button", { name: "Draw a new venue" });
  if (await draw.isVisible()) await draw.click();
  await page.getByRole("button", { name: "Row of 4" }).click();
  await page.getByLabel("Venue name").fill(VENUE_NAME);
  await page.getByRole("button", { name: "Save venue" }).click();
  await expect(page.getByText("Booked: courts 1, 2, 3, 4")).toBeVisible();
  await page.getByLabel("Dine & drink venue").fill("Noodle Bar");
  await page.getByRole("button", { name: "Create the DDD" }).click();

  await expect(page.getByRole("heading", { level: 1, name: DDD_NAME })).toBeVisible();
  await expect(page.getByText(VENUE_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText("Noodle Bar", { exact: true })).toBeVisible();
  await expect(page.getByText("Court 4", { exact: true })).toBeVisible();

  const scoreUrl = await page.getByRole("link", { name: /\/tools\/ddd\/score\// }).textContent();
  const publicUrl = await page.getByRole("link", { name: /\/tools\/ddd\/live\// }).textContent();

  // Both links open with no account.
  const stranger = await open(browser);
  await stranger.goto(scoreUrl!);
  await expect(stranger.getByRole("heading", { level: 1, name: DDD_NAME })).toBeVisible();
  await expect(stranger.getByText("Score Link", { exact: true })).toBeVisible();
  await stranger.goto(publicUrl!);
  await expect(stranger.getByRole("heading", { level: 1, name: DDD_NAME })).toBeVisible();
  await expect(stranger.getByText("Public Link", { exact: true })).toBeVisible();

  await page.goto("/tools/ddd");
  await expect(page.getByRole("link", { name: new RegExp(DDD_NAME) })).toBeVisible();
  await page.getByRole("button", { name: "Invite an Organizer" }).click();
  const inviteUrl = await page.getByRole("link", { name: /\/tools\/ddd\/join\// }).textContent();

  await outsiderPage.goto(inviteUrl!);
  await outsiderPage.getByRole("button", { name: `Join as ${outsider.email}` }).click();
  await expect(outsiderPage.getByRole("heading", { name: "Your DDDs" })).toBeVisible();
  await expect(outsiderPage.getByRole("link", { name: new RegExp(DDD_NAME) })).toBeVisible();
});
