import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Match Mixer's Go Live (#687): draw a board, take it live, and the Player
 * Link opens the same board in another browser. Also: a failed Go Live leaves
 * the board as it was, and drawing alone sends nothing.
 *
 * Needs the local Supabase stack. The Live Mixers made here are deleted
 * afterwards through the service role (they have no Owner to cascade from).
 * Names are PPA Tour pros: this repo is public. No dates: nothing here
 * depends on the calendar.
 */

const ROUTE = "/tools/match-mixer";
const API_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ROSTER = [
  "Ben Johns",
  "Anna Leigh Waters",
  "Federico Staksrud",
  "Catherine Parenteau",
  "JW Johnson",
  "Anna Bright",
  "Tyson McGuffin",
  "Jorja Johnson",
  "Collin Johns",
  "Lea Jansen",
].join("\n");

const playerTokens: string[] = [];

test.afterAll(async () => {
  if (playerTokens.length === 0) return;
  const res = await fetch(
    `${API_URL}/rest/v1/match_mixer_live_mixers?player_token=in.(${playerTokens.join(",")})`,
    { method: "DELETE", headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );
  if (!res.ok) throw new Error(`Cleaning up Live Mixers failed: ${res.status} ${await res.text()}`);
});

function boardGrid(page: Page): Locator {
  return page.getByRole("region", { name: "The board" }).getByRole("table");
}

/** Pastes the Roster and draws it, retrying the fill until React has hydrated. */
async function drawBoard(page: Page): Promise<string> {
  await page.goto(ROUTE);
  const make = page.getByRole("button", { name: "Make the board" });
  await expect(async () => {
    await page.getByRole("textbox", { name: "Tonight" }).fill(ROSTER);
    await expect(make).toBeEnabled({ timeout: 1_000 });
  }).toPass();
  await make.click();
  await expect(boardGrid(page)).toBeVisible();
  return (await boardGrid(page).textContent()) ?? "";
}

test("a board goes live and the Player Link opens the same board elsewhere", async ({ page, browser, baseURL }) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });

  const drawn = await drawBoard(page);
  // Drawing a board sends nothing; only Go Live does.
  expect(posts).toEqual([]);

  await page.getByRole("button", { name: "Go live" }).click();
  await page.waitForURL(/\/tools\/match-mixer\/organizer\/[0-9a-f]{32}$/);
  await expect(boardGrid(page)).toHaveText(drawn);

  const playerLink = await page.getByRole("textbox", { name: "Player Link" }).inputValue();
  expect(playerLink).toMatch(/\/tools\/match-mixer\/player\/[0-9a-f]{32}$/);
  playerTokens.push(playerLink.split("/").pop()!);
  const organizerLink = page.url();
  await expect(page.getByRole("textbox", { name: "Organizer Link" })).toHaveValue(organizerLink);

  // A phone in the group chat: another browser, nothing shared with this one.
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const player = await phone.newPage();
  await player.goto(playerLink);
  await expect(boardGrid(player)).toHaveText(drawn);
  // The Player Link never shows the Organizer Link.
  await expect(player.getByRole("textbox", { name: "Organizer Link" })).toHaveCount(0);
  expect(await player.content()).not.toContain(organizerLink.split("/").pop()!);

  // Find-me works on the Player Link as it does on the tool.
  const name = player.getByRole("button", { name: "Lea Jansen" }).first();
  await name.click();
  await expect(name).toHaveAttribute("aria-pressed", "true");
  await phone.close();

  // Closing the tab doesn't lose control: the tool remembers the Organizer Link.
  await page.goto(ROUTE);
  await page.getByRole("link", { name: "Open its Organizer Link" }).click();
  await page.waitForURL(organizerLink);
});

test("a Go Live that never reaches the server leaves the board as it was", async ({ page }) => {
  const drawn = await drawBoard(page);
  await page.route(`**${ROUTE}`, (route) =>
    route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
  );

  await page.getByRole("button", { name: "Go live" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Couldn't reach Match Mixer" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`));
  await expect(boardGrid(page)).toHaveText(drawn);
  await expect(page.getByRole("button", { name: "Go live" })).toBeEnabled();
});

test("a link with nothing behind it says so", async ({ page }) => {
  await page.goto(`${ROUTE}/player/${"0".repeat(32)}`);
  await expect(page.getByRole("heading", { name: "No such board" })).toBeVisible();
});
