import type { Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { selectDuration } from "./support/places.ts";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  type FixtureUser,
} from "./support/fixture-token.ts";

/**
 * Standing Games (issue #577): "Repeats weekly" on Post a game sets up a
 * weekly game and posts this week's game straight away, carrying an "Every
 * <day>" chip; editing the weekly game leaves the posted game as it was; End
 * takes it off the Weekly games list.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Two days from today on Toronto's clock: always a future game, never today's
 * edge where the start hour may already have gone.
 */
function dayAfterTomorrow(): { index: number; name: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const index = (new Date(`${today}T00:00:00Z`).getUTCDay() + 2) % 7;
  return { index, name: DAYS[index] };
}

/** Removes the account's weekly games and every game they posted, straight at PostgREST as the owner. */
async function deleteStandingGames(owner: FixtureUser): Promise<void> {
  const token = await fixtureToken(owner);
  const headers = { apikey: LOCAL_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  for (const path of ["slots?standing_game_id=not.is.null", "standing_games?owner_id=not.is.null"]) {
    const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`, { method: "DELETE", headers });
    if (!res.ok) {
      throw new Error(`standing game cleanup: ${path} failed: ${res.status} ${await res.text()}`);
    }
  }
}

/** The Games page section whose own heading is `heading` (not the page section wrapping all of them). */
function section(page: Page, heading: string) {
  return page.locator(`xpath=//section[h2[normalize-space()="${heading}"]]`);
}

test.beforeEach(async ({ accounts }) => {
  await deleteStandingGames({ email: accounts.amy.email, password: accounts.password });
});

test.afterEach(async ({ accounts }) => {
  await deleteStandingGames({ email: accounts.amy.email, password: accounts.password });
});

test("a weekly game posts this week's game with its chip, edits leave it alone, and End takes it off the list", async ({
  page,
  accounts,
}) => {
  const day = dayAfterTomorrow();
  const chip = `Every ${day.name}`;

  await signIn(page, accounts.amy.email, "/booking-buddy/slots");
  await page.getByLabel("Repeats weekly").check();
  await page.getByLabel("Day", { exact: true }).selectOption(String(day.index));
  await page.getByLabel("Start").selectOption("20:00");
  await selectDuration(page, "20:00", "22:00");
  await page.getByRole("button", { name: "Post weekly game" }).click();

  const weekly = section(page, "Weekly games");
  await expect(weekly.getByRole("listitem").filter({ hasText: chip })).toBeVisible();

  const posted = section(page, "Your games").getByRole("listitem").filter({ hasText: chip });
  await expect(posted).toHaveCount(1);
  await expect(posted).toContainText("8:00 PM");

  // The posted game's own page carries the chip too.
  await posted.getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  const postedUrl = page.url();
  await expect(page.getByText(chip, { exact: true })).toBeVisible();

  // A friend sees the same chip on the same game.
  const friend = await page.context().browser()!.newContext();
  const friendPage = await friend.newPage();
  await signIn(friendPage, accounts.ben2.email, new URL(postedUrl).pathname);
  await expect(friendPage.getByText(chip, { exact: true })).toBeVisible();
  await friend.close();

  // Edit the weekly game: move it to 6pm.
  await page.getByRole("link", { name: "Edit the weekly game" }).click();
  await page.waitForURL(/\/booking-buddy\/slots\/weekly\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: chip })).toBeVisible();
  await page.getByLabel("Start").selectOption("18:00");
  await page.getByRole("button", { name: "Save weekly game" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(page.getByText("6:00 PM – 8:00 PM")).toBeVisible();

  // The game already posted keeps the time it was posted with.
  await page.goto(postedUrl);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("8:00 PM");

  // End it.
  await page.goBack();
  await page.waitForURL(/\/booking-buddy\/slots\/weekly\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "End weekly game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End weekly game" }).click();
  await page.waitForURL(/\/booking-buddy\/slots$/);

  await expect(section(page, "Your games").getByRole("listitem").filter({ hasText: chip })).toHaveCount(1);
  await expect(section(page, "Weekly games")).toHaveCount(0);
});
