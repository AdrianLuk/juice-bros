import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { selectDuration } from "./support/places.ts";
import { deleteFriendGroups, resetNotificationPreferences } from "./support/db-reset.ts";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  fixtureUserId,
  type FixtureUser,
} from "./support/fixture-token.ts";

/**
 * Regulars and the Weekly Invite (issue #579): the organizer picks Regulars
 * on the Post a game form and edits them on the weekly game's page, a Friend
 * Group fills the list in one tap, a yes to the posted game joins the
 * answerer, and Settings carries the "Weekly game invites" opt-in.
 *
 * Friends are addressed by Username, never display name: both of Amy's
 * friends are called "Ben Backhand".
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Four days from today on Toronto's clock: always a future game, and a
 * different day (and hour, below) from the other weekly-game specs, so a
 * concurrent run on the same seeded account doesn't match this one's rows.
 */
function fourDaysOut(): { index: number; name: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const index = (new Date(`${today}T00:00:00Z`).getUTCDay() + 4) % 7;
  return { index, name: DAYS[index] };
}

async function rest(user: FixtureUser, path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await fixtureToken(user);
  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`regulars spec: ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function deleteStandingGames(owner: FixtureUser): Promise<void> {
  await rest(owner, "slots?standing_game_id=not.is.null", { method: "DELETE" });
  await rest(owner, "standing_games?owner_id=not.is.null", { method: "DELETE" });
}

/** A Friend Group of Amy's holding both her friends, made straight at PostgREST. */
async function createGroupOfBothFriends(owner: FixtureUser, name: string): Promise<void> {
  const ownerId = await fixtureUserId(owner);
  const [group] = (await rest(owner, "friend_groups", {
    method: "POST",
    body: JSON.stringify({ owner_id: ownerId, name }),
  })) as { id: string }[];
  const connections = (await rest(owner, "connections?status=eq.accepted&select=id")) as { id: string }[];
  await rest(owner, "friend_group_members", {
    method: "POST",
    body: JSON.stringify(connections.map((row) => ({ group_id: group.id, connection_id: row.id }))),
  });
}

function section(page: Page, heading: string) {
  return page.locator(`xpath=//section[h2[normalize-space()="${heading}"]]`);
}

function regular(page: Page | Locator, username: string) {
  return page.getByLabel(`(@${username})`);
}

test.beforeEach(async ({ accounts }) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  await deleteStandingGames(amy);
  await deleteFriendGroups(amy);
});

test.afterEach(async ({ accounts }) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  await deleteStandingGames(amy);
  await deleteFriendGroups(amy);
  await resetNotificationPreferences({ email: accounts.ben.email, password: accounts.password });
});

test("Regulars are picked on the form, filled from a group, joined by a yes, and counted on the row", async ({
  page,
  accounts,
}) => {
  const day = fourDaysOut();
  const chip = `Every ${day.name}`;
  const groupName = `Playwright crew ${Date.now()}`;
  await createGroupOfBothFriends({ email: accounts.amy.email, password: accounts.password }, groupName);

  await signIn(page, accounts.amy.email, "/booking-buddy/slots");
  await page.getByLabel("Repeats weekly").check();
  await page.getByLabel("Day", { exact: true }).selectOption(String(day.index));
  await page.getByLabel("Start").selectOption("07:00");
  await selectDuration(page, "07:00", "09:00");

  // Pick Ben only.
  await regular(page, accounts.ben.username).check();
  await expect(page.getByText("1 regular", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Post weekly game" }).click();

  const row = section(page, "Weekly games")
    .getByRole("listitem")
    .filter({ hasText: `${chip} · 7:00 AM` });
  await expect(row).toContainText("1 regular");

  // On the weekly game's page Ben is ticked; the group adds Ben2 in one tap.
  await row.getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/weekly\/[0-9a-f-]+$/);
  const standingGameId = new URL(page.url()).pathname.split("/").pop()!;
  const regulars = section(page, "Regulars");
  await expect(regular(regulars, accounts.ben.username)).toBeChecked();
  await expect(regular(regulars, accounts.ben2.username)).not.toBeChecked();
  await regulars.getByRole("button", { name: `Add everyone in ${groupName}` }).click();
  await expect(regular(regulars, accounts.ben2.username)).toBeChecked();
  await expect(regulars.getByText("2 regulars", { exact: true })).toBeVisible();

  // Untick Ben and save: only Ben2 is left.
  await regular(regulars, accounts.ben.username).uncheck();
  await regulars.getByRole("button", { name: "Save regulars" }).click();
  await expect(regulars.getByRole("status")).toContainText("Regulars saved");
  await page.reload();
  await expect(regular(regulars, accounts.ben.username)).not.toBeChecked();
  await expect(regular(regulars, accounts.ben2.username)).toBeChecked();

  // Ben, no longer a Regular, says yes to the posted game and joins again.
  const ownerToken = { email: accounts.amy.email, password: accounts.password };
  const [posted] = (await rest(ownerToken, `slots?standing_game_id=eq.${standingGameId}&select=id`)) as { id: string }[];
  const friend = await page.context().browser()!.newContext();
  const friendPage = await friend.newPage();
  await signIn(friendPage, accounts.ben.email, `/booking-buddy/slots/${posted.id}`);
  await friendPage.getByRole("group", { name: "Your response" }).getByRole("button", { name: "Yes" }).click();
  await expect(friendPage.getByRole("button", { name: "Yes", pressed: true })).toBeVisible();
  await friend.close();

  await expect(async () => {
    await page.reload();
    await expect(regular(regulars, accounts.ben.username)).toBeChecked({ timeout: 2_000 });
  }).toPass();

  await page.goto("/booking-buddy/slots");
  await expect(row).toContainText("2 regulars");
});

test("Weekly game invites is on by default in Settings and can be turned off", async ({ page, accounts }) => {
  const label = /^Weekly game invites/;

  await signIn(page, accounts.ben.email, "/booking-buddy/settings");
  await expect(page.getByLabel(label)).toBeChecked();

  await page.getByLabel(label).uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(label)).not.toBeChecked();
  // The other toggles are untouched.
  await expect(
    page.getByLabel("Email me a reminder before games I've said yes to, so I don't forget to show up"),
  ).toBeChecked();
});
