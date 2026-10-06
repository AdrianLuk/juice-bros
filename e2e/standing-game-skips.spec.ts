import type { Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { selectDuration } from "./support/places.ts";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  fixtureUserId,
  type FixtureUser,
} from "./support/fixture-token.ts";

/**
 * Skipping a week of a Standing Game (issue #578). A posted week is skipped
 * from its own game page, which takes the game down and tells its yes and
 * maybe answerers; it is never posted again. A week not posted yet is skipped
 * by date from the weekly game's page, and can be put back on.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Two days from today on Toronto's clock, so the first game is always still to come. */
function dayAfterTomorrow(): { index: number; name: string; date: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 2);
  const index = date.getUTCDay();
  return { index, name: DAYS[index], date: date.toISOString().slice(0, 10) };
}

async function rest(user: FixtureUser, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await fixtureToken(user);
  return fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/** Removes the account's weekly games and every game they posted, as the owner. */
async function deleteStandingGames(owner: FixtureUser): Promise<void> {
  for (const path of ["slots?standing_game_id=not.is.null", "standing_games?owner_id=not.is.null"]) {
    const res = await rest(owner, path, { method: "DELETE" });
    if (!res.ok) {
      throw new Error(`standing game cleanup: ${path} failed: ${res.status} ${await res.text()}`);
    }
  }
}

function section(page: Page, heading: string) {
  return page.locator(`xpath=//section[h2[normalize-space()="${heading}"]]`);
}

/** Sets up a weekly game two days out through the Post a game form and returns its day. */
async function postWeeklyGame(page: Page, email: string) {
  const day = dayAfterTomorrow();
  await signIn(page, email, "/booking-buddy/slots");
  await page.getByLabel("Repeats weekly").check();
  await page.getByLabel("Day", { exact: true }).selectOption(String(day.index));
  await page.getByLabel("Start").selectOption("20:00");
  await selectDuration(page, "20:00", "22:00");
  await page.getByRole("button", { name: "Post weekly game" }).click();
  await expect(
    section(page, "Weekly games").getByRole("listitem").filter({ hasText: `Every ${day.name}` }),
  ).toBeVisible();
  return day;
}

test.beforeEach(async ({ accounts }) => {
  await deleteStandingGames({ email: accounts.amy.email, password: accounts.password });
});

test.afterEach(async ({ accounts }) => {
  await deleteStandingGames({ email: accounts.amy.email, password: accounts.password });
});

test("skipping a posted week takes the game down, says who is told, and it never posts again", async ({
  page,
  accounts,
}) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  const ben = { email: accounts.ben2.email, password: accounts.password };
  const day = await postWeeklyGame(page, amy.email);
  const chip = `Every ${day.name}`;

  const posted = section(page, "Your games").getByRole("listitem").filter({ hasText: chip });
  await posted.getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  const slotId = new URL(page.url()).pathname.split("/").pop()!;

  // Ben says yes to it.
  const answered = await rest(ben, "responses", {
    method: "POST",
    body: JSON.stringify({ slot_id: slotId, user_id: await fixtureUserId(ben), answer: "yes" }),
  });
  expect(answered.ok).toBe(true);
  await page.reload();

  // "Skip this week" stands in for "Delete game".
  await expect(section(page, "Delete game")).toHaveCount(0);
  await section(page, "Skip this week").getByRole("button", { name: "Skip this week" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toContainText("The 1 person who said yes or maybe gets an email saying it's off.");
  await confirm.getByRole("button", { name: "Skip this week" }).click();

  // Lands on the weekly game's page, the date skipped and nothing posted.
  await page.waitForURL(/\/booking-buddy\/slots\/weekly\/[0-9a-f-]+$/);
  await expect(page.getByRole("list", { name: "Skipped weeks" })).toBeVisible();
  await expect(section(page, "Posted games")).toContainText("Nothing posted right now");

  // The posting path the cron uses won't put it back.
  const standingGameId = new URL(page.url()).pathname.split("/").pop()!;
  const repost = await rest(amy, "rpc/post_standing_game_week", {
    method: "POST",
    body: JSON.stringify({ target_standing_game: standingGameId, target_game_date: day.date }),
  });
  expect(await repost.json()).toBeNull();

  // The Weekly games row moves on to the following week.
  const following = new Date(`${day.date}T00:00:00Z`);
  following.setUTCDate(following.getUTCDate() + 7);
  const followingLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(following);
  await page.goto("/booking-buddy/slots");
  await expect(section(page, "Weekly games").getByRole("listitem").filter({ hasText: chip })).toContainText(
    `Next game ${followingLabel}`,
  );
  await expect(section(page, "Your games").getByRole("listitem").filter({ hasText: chip })).toHaveCount(0);
});

test("a week not posted yet can be skipped by date and put back on", async ({ page, accounts }) => {
  await postWeeklyGame(page, accounts.amy.email);
  await section(page, "Weekly games").getByRole("listitem").first().getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/weekly\/[0-9a-f-]+$/);

  const skipSection = section(page, "Skip a week");
  await expect(skipSection).toContainText("No weeks skipped");
  const picker = skipSection.getByLabel("Week to skip");
  const label = (await picker.locator("option:checked").textContent())!.trim();

  await skipSection.getByRole("button", { name: "Skip that week" }).click();
  const skipped = page.getByRole("list", { name: "Skipped weeks" });
  await expect(skipped.getByRole("listitem").filter({ hasText: label })).toBeVisible();
  await expect(picker.locator("option", { hasText: label })).toHaveCount(0);

  await skipped.getByRole("button", { name: `Put ${label} back on` }).click();
  await expect(skipSection).toContainText("No weeks skipped");
  await expect(picker.locator("option", { hasText: label })).toHaveCount(1);
});
