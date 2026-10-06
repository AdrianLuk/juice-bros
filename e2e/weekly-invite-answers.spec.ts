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
import {
  mintWeeklyInviteLink,
  responseOf,
  weeklyInviteToken,
} from "./support/weekly-invite-link.ts";

/**
 * Answering from the Weekly Invite with no sign-in (issue #580, ADR 0022).
 *
 * The email itself never reaches an @example.com inbox, but the token the
 * sender mints for it is the whole feature: each test reads it straight
 * from Postgres (service_role-only) and opens `/answer/<token>` in a context
 * with no session, the way a Regular taps it from their inbox.
 *
 * Every game here is 5 days out at 6am, a day and hour the other weekly-game
 * specs don't use, and cleanup removes only this spec's own Standing Games.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fiveDaysOut(): { index: number; name: string; date: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 5);
  const index = day.getUTCDay();
  return { index, name: DAYS[index], date: day.toISOString().slice(0, 10) };
}

async function rest<T = unknown>(user: FixtureUser, path: string, init: RequestInit = {}): Promise<T> {
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
    throw new Error(`weekly invite spec: ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const createdGames: { owner: FixtureUser; id: string }[] = [];

async function deleteCreatedGames(): Promise<void> {
  for (const { owner, id } of createdGames.splice(0)) {
    await rest(owner, `slots?standing_game_id=eq.${id}`, { method: "DELETE" });
    await rest(owner, `standing_games?id=eq.${id}`, { method: "DELETE" });
  }
}

/** A weekly game 5 days out with `regular` on its list and its first week posted, straight at PostgREST. */
async function postWeeklyGame(owner: FixtureUser, regular: FixtureUser): Promise<{ slotId: string }> {
  const day = fiveDaysOut();
  const [game] = await rest<{ id: string }[]>(owner, "standing_games", {
    method: "POST",
    body: JSON.stringify({
      owner_id: await fixtureUserId(owner),
      weekday: day.index,
      start_hour: 6,
      end_hour: 8,
      time_zone: "America/Toronto",
    }),
  });
  createdGames.push({ owner, id: game.id });
  await rest(owner, "standing_game_regulars", {
    method: "POST",
    body: JSON.stringify({ standing_game_id: game.id, user_id: await fixtureUserId(regular) }),
  });
  const slotId = await rest<string>(owner, "rpc/post_standing_game_week", {
    method: "POST",
    body: JSON.stringify({ target_standing_game: game.id, target_game_date: day.date }),
  });
  return { slotId };
}

/** Read through the service role: a Regular without Visibility can't read their own Response back. */
async function myAnswer(user: FixtureUser, slotId: string): Promise<string | null> {
  return responseOf(slotId, await fixtureUserId(user));
}

async function signedOutPage(page: Page): Promise<Page> {
  const context = await page.context().browser()!.newContext();
  return context.newPage();
}

test.afterEach(async () => {
  await deleteCreatedGames();
});

test("the invite's link opens the game signed out, writes nothing on GET, and answers on Confirm", async ({
  page,
  accounts,
}) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  const ben = { email: accounts.ben.email, password: accounts.password };
  const day = fiveDaysOut();

  // Amy posts a weekly game with Ben as a Regular: the invite sender mints his token.
  await signIn(page, accounts.amy.email, "/booking-buddy/slots");
  await page.getByLabel("Repeats weekly").check();
  await page.getByLabel("Day", { exact: true }).selectOption(String(day.index));
  await page.getByLabel("Start").selectOption("06:00");
  await selectDuration(page, "06:00", "08:00");
  await page.getByLabel(`(@${accounts.ben.username})`).check();
  await page.getByRole("button", { name: "Post weekly game" }).click();
  await expect(
    page
      .locator('xpath=//section[h2[normalize-space()="Weekly games"]]')
      .getByRole("listitem")
      .filter({ hasText: `Every ${day.name} · 6:00 AM` }),
  ).toBeVisible();

  const [game] = await rest<{ id: string }[]>(
    amy,
    `standing_games?weekday=eq.${day.index}&start_hour=eq.6&ended_at=is.null&order=created_at.desc&limit=1&select=id`,
  );
  createdGames.push({ owner: amy, id: game.id });
  const [slot] = await rest<{ id: string }[]>(amy, `slots?standing_game_id=eq.${game.id}&select=id`);
  const token = await weeklyInviteToken(slot.id, await fixtureUserId(ben));

  // A mail scanner fetching every link in the email changes nothing.
  for (const answer of ["yes", "maybe", "no"]) {
    const res = await fetch(new URL(`/answer/${token}?a=${answer}`, page.url()));
    expect(res.status).toBe(200);
  }
  expect(await myAnswer(ben, slot.id)).toBeNull();

  // Ben taps Yes in his inbox, signed out.
  const inbox = await signedOutPage(page);
  await inbox.goto(`/answer/${token}?a=yes`);
  await expect(inbox.getByRole("heading", { level: 1 })).toContainText("6:00");
  await expect(inbox.getByText("Amy Ace's weekly game")).toBeVisible();
  await expect(inbox.getByRole("radio", { name: "Yes" })).toBeChecked();
  expect(await myAnswer(ben, slot.id)).toBeNull();

  await inbox.getByRole("button", { name: "Confirm" }).click();
  await expect(inbox.getByRole("status")).toContainText("You're in");
  expect(await myAnswer(ben, slot.id)).toBe("yes");

  // Later he opens the No link: it shows his current answer and lets him change it.
  await inbox.goto(`/answer/${token}?a=no`);
  await expect(inbox.getByText("Your answer now: Yes")).toBeVisible();
  await expect(inbox.getByRole("radio", { name: "No" })).toBeChecked();
  expect(await myAnswer(ben, slot.id)).toBe("yes");
  await inbox.getByRole("button", { name: "Confirm" }).click();
  await expect(inbox.getByRole("status")).toContainText("Thanks for letting them know");
  expect(await myAnswer(ben, slot.id)).toBe("no");

  // The organizer sees it as Ben's own Response.
  await page.goto(`/booking-buddy/slots/${slot.id}`);
  await expect(page.getByText("Ben Backhand").first()).toBeVisible();
  await inbox.context().close();
});

test("a Regular who can't see the organizer's games still answers this one through the link", async ({
  page,
  accounts,
}) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  const ben = { email: accounts.ben.email, password: accounts.password };
  const benId = await fixtureUserId(ben);
  const { slotId } = await postWeeklyGame(amy, ben);
  const token = await mintWeeklyInviteLink(slotId, benId);

  // Amy hides her games from Ben.
  const [connection] = await rest<{ id: string }[]>(
    amy,
    `connections?status=eq.accepted&or=(requester_id.eq.${benId},addressee_id.eq.${benId})&select=id`,
  );
  const amyId = await fixtureUserId(amy);
  await rest(amy, "visibility_overrides", {
    method: "POST",
    body: JSON.stringify({ connection_id: connection.id, owner_id: amyId, level: "none" }),
  });

  try {
    await signIn(page, accounts.ben.email, `/booking-buddy/slots/${slotId}`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();

    await page.goto(`/answer/${token}?a=maybe`);
    await expect(page.getByText("Amy Ace's weekly game")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("status")).toContainText("Marked as a maybe");
    expect(await myAnswer(ben, slotId)).toBe("maybe");

    // The answer opens nothing else of Amy's.
    await page.goto(`/booking-buddy/slots/${slotId}`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  } finally {
    await rest(amy, `visibility_overrides?connection_id=eq.${connection.id}&owner_id=eq.${amyId}`, {
      method: "DELETE",
    });
  }
});

test("the link is done once the game starts, and once the game is deleted", async ({ page, accounts }) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  const ben = { email: accounts.ben.email, password: accounts.password };
  const { slotId } = await postWeeklyGame(amy, ben);
  const token = await mintWeeklyInviteLink(slotId, await fixtureUserId(ben));
  const inbox = await signedOutPage(page);

  await inbox.goto(`/answer/${token}?a=yes`);
  await expect(inbox.getByRole("button", { name: "Confirm" })).toBeVisible();

  // The game starts.
  const started = new Date(Date.now() - 60_000).toISOString();
  const ends = new Date(Date.now() + 60 * 60_000).toISOString();
  await rest(amy, `slots?id=eq.${slotId}`, {
    method: "PATCH",
    body: JSON.stringify({ proposed_start: started, proposed_end: ends }),
  });
  await inbox.goto(`/answer/${token}?a=yes`);
  await expect(inbox.getByRole("heading", { name: "This game has started" })).toBeVisible();
  await expect(inbox.getByRole("button", { name: "Confirm" })).toHaveCount(0);
  expect(await myAnswer(ben, slotId)).toBeNull();

  // The game is deleted (a skipped week deletes it the same way).
  await rest(amy, `slots?id=eq.${slotId}`, { method: "DELETE" });
  await inbox.goto(`/answer/${token}?a=yes`);
  await expect(inbox.getByRole("heading", { name: "This link isn't working" })).toBeVisible();

  // A made-up token gets the same friendly page.
  await inbox.goto("/answer/00000000-0000-4000-8000-000000000000?a=yes");
  await expect(inbox.getByRole("heading", { name: "This link isn't working" })).toBeVisible();
  await inbox.context().close();
});

test("taking a Regular off the list kills their link, so a yes can't put them back", async ({
  page,
  accounts,
}) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  const ben = { email: accounts.ben.email, password: accounts.password };
  const benId = await fixtureUserId(ben);
  const { slotId } = await postWeeklyGame(amy, ben);
  const token = await mintWeeklyInviteLink(slotId, benId);
  const [{ id: gameId }] = createdGames.slice(-1);
  const inbox = await signedOutPage(page);

  // Ben has the answer page open when Amy un-ticks him.
  await inbox.goto(`/answer/${token}?a=yes`);
  await expect(inbox.getByRole("button", { name: "Confirm" })).toBeVisible();
  await rest(amy, `standing_game_regulars?standing_game_id=eq.${gameId}&user_id=eq.${benId}`, {
    method: "DELETE",
  });

  // His yes goes nowhere: no Response, and he stays off the list.
  await inbox.getByRole("button", { name: "Confirm" }).click();
  await expect(inbox.getByRole("heading", { name: "This link isn't working" })).toBeVisible();
  expect(await myAnswer(ben, slotId)).toBeNull();
  const regulars = await rest<{ user_id: string }[]>(
    amy,
    `standing_game_regulars?standing_game_id=eq.${gameId}&select=user_id`,
  );
  expect(regulars).toEqual([]);

  // Opening the link again shows the same dead-link page.
  await inbox.goto(`/answer/${token}?a=yes`);
  await expect(inbox.getByRole("heading", { name: "This link isn't working" })).toBeVisible();
  await inbox.context().close();
});
