import type { Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { addPlace, logBooking, placeName, removePlace, row, selectDuration } from "./support/places.ts";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_API_URL,
  fixtureToken,
  type FixtureUser,
} from "./support/fixture-token.ts";

/**
 * "Attach your court?" (issue #582): a weekly game's posted game with no
 * court, and an unattached Booking at its facility over its hours, offers
 * that Booking on the Weekly games row and on the game's own page. Several
 * matches are each offered, nothing is attached until the organizer taps,
 * and a friend never sees it.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Two days from today on Toronto's clock, the zone a hand-named facility gets. */
function dayAfterTomorrow(): { index: number; name: string; date: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const at = new Date(`${today}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 2);
  const index = at.getUTCDay();
  return { index, name: DAYS[index], date: at.toISOString().slice(0, 10) };
}

async function rest(owner: FixtureUser, path: string, method = "GET"): Promise<unknown> {
  const token = await fixtureToken(owner);
  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: LOCAL_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return method === "GET" ? res.json() : null;
}

async function deleteStandingGames(owner: FixtureUser): Promise<void> {
  await rest(owner, "slots?standing_game_id=not.is.null", "DELETE");
  await rest(owner, "standing_games?owner_id=not.is.null", "DELETE");
}

/** Courts attached to the account's weekly games, read straight from the database. */
async function attachedToWeeklyGames(owner: FixtureUser): Promise<unknown[]> {
  return (await rest(
    owner,
    "slot_bookings?select=booking_id,slots!inner(standing_game_id)&slots.standing_game_id=not.is.null",
  )) as unknown[];
}

function section(page: Page, heading: string) {
  return page.locator(`xpath=//section[h2[normalize-space()="${heading}"]]`);
}

const suggestions = (page: Page) => page.getByRole("list", { name: "Courts to attach" }).getByRole("listitem");

test.beforeEach(async ({ accounts }) => {
  await deleteStandingGames({ email: accounts.amy.email, password: accounts.password });
});

test("a weekly game's matching courts are offered, and only the organizer's tap attaches one", async ({
  page,
  accounts,
}) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  const day = dayAfterTomorrow();
  const place = placeName();

  await signIn(page, accounts.amy.email, "/booking-buddy/bookings");
  try {
    await addPlace(page, place);
    await logBooking(page, { place, court: "3", date: day.date, start: "20:00", end: "22:00" });
    await expect(row(page, "Court 3")).toBeVisible();
    await logBooking(page, { place, court: "4", date: day.date, start: "20:00", end: "22:00" });
    await expect(row(page, "Court 4")).toBeVisible();

    await page.goto("/booking-buddy/slots");
    await page.getByLabel("Repeats weekly").check();
    await page.getByLabel("Day", { exact: true }).selectOption(String(day.index));
    await page.getByLabel("Start").selectOption("20:00");
    await selectDuration(page, "20:00", "22:00");
    await page.getByLabel("Facility").selectOption({ label: place });
    await page.getByRole("button", { name: "Post weekly game" }).click();

    // The Weekly games row offers both courts, each naming the game it's for.
    const weekly = section(page, "Weekly games");
    await expect(weekly.getByRole("listitem").filter({ hasText: `Every ${day.name}` }).first()).toBeVisible();
    await expect(suggestions(page)).toHaveCount(2);
    await expect(suggestions(page).first()).toContainText(`Attach your 8:00 PM court at ${place}?`);
    await expect(suggestions(page).filter({ hasText: "Court 3" })).toContainText("For ");
    await expect(suggestions(page).filter({ hasText: "Court 4" })).toBeVisible();

    // Offering is not attaching.
    expect(await attachedToWeeklyGames(amy)).toHaveLength(0);

    // The game's own page offers the same two.
    await section(page, "Your games").getByRole("listitem").filter({ hasText: `Every ${day.name}` }).getByRole("link").click();
    await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
    const gameUrl = new URL(page.url()).pathname;
    await expect(suggestions(page)).toHaveCount(2);
    expect(await attachedToWeeklyGames(amy)).toHaveLength(0);

    // A friend opening the same game sees no suggestion.
    const friend = await page.context().browser()!.newContext();
    const friendPage = await friend.newPage();
    await signIn(friendPage, accounts.ben2.email, gameUrl);
    await expect(friendPage.getByText(`Every ${day.name}`, { exact: true })).toBeVisible();
    await expect(friendPage.getByRole("list", { name: "Courts to attach" })).toHaveCount(0);
    await friend.close();

    // One tap attaches Court 3; the game is booked and the suggestion goes.
    await suggestions(page).filter({ hasText: "Court 3" }).getByRole("button", { name: "Attach court" }).click();
    await expect(page.getByText("Court booked")).toBeVisible();
    await expect(page.getByRole("list", { name: "Courts to attach" })).toHaveCount(0);
    expect(await attachedToWeeklyGames(amy)).toHaveLength(1);

    // And it's gone from the Weekly games row too.
    await page.goto("/booking-buddy/slots");
    await expect(weekly.getByRole("listitem").filter({ hasText: `Every ${day.name}` }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Courts to attach" })).toHaveCount(0);
  } finally {
    await deleteStandingGames(amy);
    await removePlace(page, place);
  }
});
