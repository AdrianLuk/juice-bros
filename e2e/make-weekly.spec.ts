import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  fixtureUserId,
  type FixtureUser,
} from "./support/fixture-token.ts";

/**
 * "Make this weekly" (issue #581): the organizer's own one-off game links to
 * Post a game with "Repeats weekly" ticked and the form filled from that game,
 * the friends who said yes ticked as Regulars. A second link seeds the form
 * again, even when it only changes the query string. The original game is
 * left alone, and while it's still to come its date counts as covered: the
 * new weekly game starts posting the week after, so there's no second game
 * that day.
 *
 * Games are made straight at PostgREST, at hours no other weekly-game spec
 * uses (6am and 9am), so concurrent runs on the same seeded account don't
 * match each other's rows. Friends are addressed by Username, never display
 * name: both of Amy's friends are called "Ben Backhand".
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NOTE_PREFIX = "Make weekly e2e";

/** `days` from today on Toronto's clock, as a date and its weekday. */
function daysOut(days: number): { date: string; weekday: number } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return { date: day.toISOString().slice(0, 10), weekday: day.getUTCDay() };
}

/** A `YYYY-MM-DD` date as the app writes a game's day: `"Tue, Oct 13"`. */
function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
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
    throw new Error(`make-weekly spec: ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const notesLike = `notes=like.${encodeURIComponent(`${NOTE_PREFIX}*`)}`;

async function cleanUp(owner: FixtureUser): Promise<void> {
  const games = (await rest(owner, `standing_games?${notesLike}&select=id`)) as { id: string }[];
  for (const game of games) {
    await rest(owner, `slots?standing_game_id=eq.${game.id}`, { method: "DELETE" });
    await rest(owner, `standing_games?id=eq.${game.id}`, { method: "DELETE" });
  }
  await rest(owner, `slots?${notesLike}`, { method: "DELETE" });
}

type Game = {
  days: number;
  startHour: number;
  endHour: number;
  division: string;
  notes: string;
  rotationBuffer: number;
  reminderOffsetMinutes: number;
};

async function postGame(owner: FixtureUser, game: Game): Promise<{ id: string; proposed_start: string }> {
  const { date } = daysOut(game.days);
  const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00:00`;
  const [slot] = (await rest(owner, "slots", {
    method: "POST",
    body: JSON.stringify({
      owner_id: await fixtureUserId(owner),
      proposed_start: `${date} ${clock(game.startHour)} America/Toronto`,
      proposed_end: `${date} ${clock(game.endHour)} America/Toronto`,
      time_zone: "America/Toronto",
      division: game.division,
      notes: game.notes,
      rotation_buffer: game.rotationBuffer,
      reminder_offset_minutes: game.reminderOffsetMinutes,
    }),
  })) as { id: string; proposed_start: string }[];
  return slot;
}

async function answer(user: FixtureUser, slotId: string, reply: "yes" | "no" | "maybe"): Promise<void> {
  await rest(user, "responses", {
    method: "POST",
    body: JSON.stringify({ slot_id: slotId, user_id: await fixtureUserId(user), answer: reply }),
  });
}

function section(page: Page, heading: string) {
  return page.locator(`xpath=//section[h2[normalize-space()="${heading}"]]`);
}

function regular(scope: Page | Locator, username: string) {
  return scope.getByLabel(`(@${username})`);
}

test.describe("Make this weekly", () => {
  let amy: FixtureUser;
  let ben: FixtureUser;
  let ben2: FixtureUser;

  test.beforeEach(async ({ accounts }) => {
    amy = { email: accounts.amy.email, password: accounts.password };
    ben = { email: accounts.ben.email, password: accounts.password };
    ben2 = { email: accounts.ben2.email, password: accounts.password };
    await cleanUp(amy);
  });

  test.afterEach(async () => {
    await cleanUp(amy);
  });

  test("opens Post a game prefilled from the game, re-seeds from a second link, and leaves the game alone", async ({
    page,
    accounts,
  }) => {
    const stamp = Date.now();
    const gameA: Game = {
      days: 5,
      startHour: 6,
      endHour: 8,
      division: "mixed",
      notes: `${NOTE_PREFIX} A ${stamp}`,
      rotationBuffer: 3,
      reminderOffsetMinutes: 180,
    };
    const gameB: Game = {
      days: 6,
      startHour: 9,
      endHour: 12,
      division: "open",
      notes: `${NOTE_PREFIX} B ${stamp}`,
      rotationBuffer: 0,
      reminderOffsetMinutes: 60,
    };
    const slotA = await postGame(amy, gameA);
    const slotB = await postGame(amy, gameB);
    await answer(ben, slotA.id, "yes");
    await answer(ben2, slotA.id, "maybe");
    await answer(ben2, slotB.id, "yes");

    // A friend's view of the game has no "Make this weekly".
    await signIn(page, accounts.ben2.email, `/booking-buddy/slots/${slotA.id}`);
    await expect(page.getByRole("heading", { name: "Your response" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Make this weekly" })).toHaveCount(0);
    await page.context().clearCookies();

    // The organizer's game links to the form, prefilled from game B.
    await signIn(page, accounts.amy.email, `/booking-buddy/slots/${slotA.id}`);
    const hrefA = await page.getByRole("link", { name: "Make this weekly" }).getAttribute("href");
    expect(hrefA).toBeTruthy();

    await page.goto(`/booking-buddy/slots/${slotB.id}`);
    await page.getByRole("link", { name: "Make this weekly" }).click();
    await page.waitForURL(/\/booking-buddy\/slots\?weekly=1/);
    const form = section(page, "Post a game");
    await expect(form.getByLabel("Repeats weekly")).toBeChecked();
    await expect(form.getByLabel("Day", { exact: true })).toHaveValue(String(daysOut(gameB.days).weekday));
    await expect(form.getByLabel("Start", { exact: true })).toHaveValue("09:00");
    await expect(form.getByLabel("End", { exact: true })).toHaveValue("12:00 PM");
    await expect(form.getByLabel("Division")).toHaveValue("open");
    await expect(form.getByLabel("Notes (optional)")).toHaveValue(gameB.notes);
    await expect(regular(form, accounts.ben2.username)).toBeChecked();
    await expect(regular(form, accounts.ben.username)).not.toBeChecked();

    // Game A's link on the same route only changes the query string. A soft
    // navigation (Next's router, the same thing a <Link> click does) must
    // still re-seed the form.
    await page.evaluate((href) => {
      (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(href);
    }, hrefA!);
    await expect(form.getByLabel("Notes (optional)")).toHaveValue(gameA.notes);
    await expect(form.getByLabel("Repeats weekly")).toBeChecked();
    const weekdayA = daysOut(gameA.days).weekday;
    await expect(form.getByLabel("Day", { exact: true })).toHaveValue(String(weekdayA));
    await expect(form.getByLabel("Start", { exact: true })).toHaveValue("06:00");
    await expect(form.getByLabel("End", { exact: true })).toHaveValue("8:00 AM");
    await expect(form.getByLabel("Division")).toHaveValue("mixed");
    await expect(regular(form, accounts.ben.username)).toBeChecked();
    await expect(regular(form, accounts.ben2.username)).not.toBeChecked();

    await form.getByRole("button", { name: "Post weekly game" }).click();
    // Game A is 5 days out, so its date is covered and the weekly game's
    // first game is the week after: nothing posts yet.
    const coveredDate = daysOut(gameA.days).date;
    const weekAfter = daysOut(gameA.days + 7).date;
    const row = section(page, "Weekly games")
      .getByRole("listitem")
      .filter({ hasText: `Every ${DAYS[weekdayA]} · 6:00 AM` });
    await expect(row).toContainText("1 regular");
    await expect(row).toContainText(`Next game ${dayLabel(weekAfter)}`);

    // The new weekly game carries everything over, the fields this form has
    // no inputs for included.
    const [created] = (await rest(
      amy,
      `standing_games?notes=eq.${encodeURIComponent(gameA.notes)}&select=id,weekday,start_hour,end_hour,division,rotation_buffer,reminder_offset_minutes,standing_game_regulars(user_id)`,
    )) as {
      id: string;
      weekday: number;
      start_hour: number;
      end_hour: number;
      division: string;
      rotation_buffer: number;
      reminder_offset_minutes: number;
      standing_game_regulars: { user_id: string }[];
    }[];
    expect(created).toMatchObject({
      weekday: weekdayA,
      start_hour: 6,
      end_hour: 8,
      division: "mixed",
      rotation_buffer: 3,
      reminder_offset_minutes: 180,
    });
    expect(created.standing_game_regulars.map((row) => row.user_id)).toEqual([await fixtureUserId(ben)]);

    // No second game on the original's date: the week is recorded with no
    // Slot and no skip mark, and nothing was posted.
    expect(await rest(amy, `slots?standing_game_id=eq.${created.id}&select=id`)).toEqual([]);
    expect(
      await rest(amy, `standing_game_weeks?standing_game_id=eq.${created.id}&select=game_date,slot_id,skipped_at`),
    ).toEqual([{ game_date: coveredDate, slot_id: null, skipped_at: null }]);

    // The covered date isn't a skipped week.
    await row.getByRole("link").click();
    await page.waitForURL(new RegExp(`/booking-buddy/slots/weekly/${created.id}`));
    const skips = section(page, "Skip a week");
    await expect(skips.getByRole("button", { name: "Skip that week" })).toBeVisible();
    await expect(skips).not.toContainText(dayLabel(coveredDate));

    // The original game is untouched: not adopted, same time, no chip.
    const [original] = (await rest(amy, `slots?id=eq.${slotA.id}&select=standing_game_id,proposed_start`)) as {
      standing_game_id: string | null;
      proposed_start: string;
    }[];
    expect(original).toEqual({ standing_game_id: null, proposed_start: slotA.proposed_start });
    await page.goto(`/booking-buddy/slots/${slotA.id}`);
    await expect(page.getByRole("heading", { name: "Your response" })).toBeVisible();
    await expect(page.getByText(`Every ${DAYS[weekdayA]}`, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Make this weekly" })).toBeVisible();

    // A game the weekly game posts has no "Make this weekly" of its own.
    const postedId = (await rest(amy, "rpc/post_standing_game_week", {
      method: "POST",
      body: JSON.stringify({ target_standing_game: created.id, target_game_date: weekAfter }),
    })) as string;
    await page.goto(`/booking-buddy/slots/${postedId}`);
    await expect(page.getByRole("heading", { name: "Skip this week" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Make this weekly" })).toHaveCount(0);
  });
});
