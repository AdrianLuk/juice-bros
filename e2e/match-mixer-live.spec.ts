import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Match Mixer's Go Live (#687): a signed-in organizer draws a board, takes it
 * live, and the Player Link opens the same board in another browser with no
 * account. Also: signed out, Go Live asks for sign-in; a failed Go Live leaves
 * the board as it was; drawing alone sends nothing.
 *
 * Needs the local Supabase stack. The organizer is a throwaway account that
 * signs in with a password through Team Tally's form (Match Mixer's own is
 * Google only), as Mic Drop's spec does; deleting it afterwards deletes its
 * Live Mixers. Names are PPA Tour pros: this repo is public. No dates:
 * nothing here depends on the calendar.
 */

const ROUTE = "/tools/match-mixer";
const API_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ADMIN = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const PASSWORD = "pickleball123";

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

let organizer: { id: string; email: string } | undefined;

test.beforeAll(async () => {
  const email = `match-mixer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Creating the organizer failed: ${res.status} ${await res.text()}`);
  organizer = { id: ((await res.json()) as { id: string }).id, email };
});

test.afterAll(async () => {
  if (organizer) await fetch(`${API_URL}/auth/v1/admin/users/${organizer.id}`, { method: "DELETE", headers: ADMIN });
});

/** Signs the organizer in through Team Tally's password form; the session is site-wide. */
async function signIn(page: Page): Promise<void> {
  await page.goto("/tools/team-tally/sign-in");
  await expect(async () => {
    await page.getByRole("button", { name: "Sign in with a password" }).click();
    await expect(page.getByLabel("Password")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.getByLabel("Email").fill(organizer!.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

function boardGrid(page: Page): Locator {
  return page.getByRole("region", { name: "The board" }).getByRole("table");
}

/** The board's names and rounds, without the scores a Live Mixer writes under its Games. */
async function plates(page: Page): Promise<string> {
  await expect(boardGrid(page)).toBeVisible();
  return boardGrid(page).evaluate((table) => {
    const copy = table.cloneNode(true) as HTMLElement;
    for (const score of copy.querySelectorAll(".mm-score")) score.remove();
    return copy.textContent ?? "";
  });
}

/** Pastes the Roster and draws it, retrying the fill until React has hydrated. */
async function drawBoard(page: Page, roster = ROSTER): Promise<string> {
  await page.goto(ROUTE);
  const make = page.getByRole("button", { name: "Make the board" });
  await expect(async () => {
    await page.getByRole("textbox", { name: "Tonight" }).fill(roster);
    await expect(make).toBeEnabled({ timeout: 1_000 });
  }).toPass();
  await make.click();
  return plates(page);
}

test("a signed-in organizer goes live and the Player Link opens the same board elsewhere", async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page);
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });

  const drawn = await drawBoard(page);
  // Drawing a board sends nothing; only Go Live does.
  expect(posts).toEqual([]);

  await page.getByRole("button", { name: "Go live" }).click();
  await page.waitForURL(/\/tools\/match-mixer\/organizer\/[0-9a-f]{32}$/);
  expect(await plates(page)).toBe(drawn);

  const playerLink = await page.getByRole("textbox", { name: "Player Link" }).inputValue();
  expect(playerLink).toMatch(/\/tools\/match-mixer\/player\/[0-9a-f]{32}$/);
  const organizerLink = page.url();
  await expect(page.getByRole("textbox", { name: "Organizer Link" })).toHaveValue(organizerLink);

  // A phone in the group chat: another browser, nothing shared with this one.
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const player = await phone.newPage();
  await player.goto(playerLink);
  expect(await plates(player)).toBe(drawn);
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

test("a board with tonight's court numbers goes live with them on both links (#697)", async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page);
  await drawBoard(page);

  // A plus-sign venue, booking only its middle and right arm: courts 3 and 4.
  await page.getByRole("button", { name: "Use your venue’s court numbers" }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "Plus sign" }).click();
  await picker.getByRole("button", { name: "2. Tonight’s courts" }).click();
  for (const court of [1, 2, 5]) {
    await picker.getByRole("button", { name: `Court ${court}, booked tonight` }).click();
  }
  await picker.getByRole("button", { name: "Use courts 3 and 4" }).click();

  await page.getByRole("button", { name: "Go live" }).click();
  await page.waitForURL(/\/tools\/match-mixer\/organizer\/[0-9a-f]{32}$/);
  const headers = (on: Page) => boardGrid(on).getByRole("columnheader", { name: /^Court / });
  await expect(headers(page)).toHaveText(["Court 3", "Court 4"]);
  await page.getByRole("button", { name: "Round 1, Court 3: enter the score" }).click();
  await expect(page.getByRole("dialog", { name: "Round 1 · Court 3" })).toBeVisible();

  const playerLink = await page.getByRole("textbox", { name: "Player Link" }).inputValue();
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const player = await phone.newPage();
  await player.goto(playerLink);
  // A phone hides the header row and each Game's cell names its court instead.
  const cells = (name: RegExp) => boardGrid(player).getByRole("cell", { name });
  await expect(cells(/^Court 3 /).first()).toBeVisible();
  await expect(cells(/^Court 4 /).first()).toBeVisible();
  await expect(cells(/^Court 1 /)).toHaveCount(0);
  await phone.close();
});

/** The first row of a Standings table, as [rank, W, L, +/-]. */
function topRow(page: Page): Locator {
  return page.getByRole("region", { name: "Standings" }).getByRole("table").first().locator("tbody tr").first().getByRole("cell");
}

test("the organizer enters a score and the Player Link shows it, with the Standings moved", async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page);
  await drawBoard(page);

  // The Game Rule is set at Go Live.
  await page.getByRole("radio", { name: "To 15" }).check();
  await page.getByRole("button", { name: "Go live" }).click();
  await page.waitForURL(/\/tools\/match-mixer\/organizer\/[0-9a-f]{32}$/);
  await expect(page.getByRole("radio", { name: "To 15" })).toBeChecked();
  const playerLink = await page.getByRole("textbox", { name: "Player Link" }).inputValue();

  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const player = await phone.newPage();
  await player.goto(playerLink);
  await expect(player.getByText("To 15, win by 2")).toBeVisible();
  await expect(topRow(player)).toHaveText(["1", "0", "0", "0"]);
  // Without a Selection, the Player Link can't score.
  await expect(player.getByRole("button", { name: /enter the score/ })).toHaveCount(0);

  // Tap a Game, the keypad, two scores.
  await page.getByRole("button", { name: "Round 1, Court 1: enter the score" }).click();
  const keypad = page.getByRole("dialog", { name: "Round 1 · Court 1" });
  await expect(keypad).toBeVisible();
  for (const key of ["1", "5", "1", "4"]) await keypad.getByRole("button", { name: key, exact: true }).click();
  await keypad.getByRole("button", { name: "Save score" }).click();
  // 15 to 14 isn't over playing to 15, win by 2: refused before anything is sent.
  await expect(keypad.getByRole("status")).toHaveText(/Win by 2/);

  await keypad.getByRole("button", { name: "Delete" }).click();
  await keypad.getByRole("button", { name: "Delete" }).click();
  await keypad.getByRole("button", { name: "9", exact: true }).click();
  await keypad.getByRole("button", { name: "Save score" }).click();
  await expect(keypad).toBeHidden();
  await expect(page.getByRole("button", { name: "Round 1, Court 1: 15 to 9. Change the score" })).toBeVisible();

  // Another phone sees it within a few seconds, and the winners top the table.
  await expect(player.getByText("Score 15 to 9")).toBeAttached({ timeout: 10_000 });
  await expect(topRow(player)).toHaveText(["1", "1", "0", "+6"]);
  await phone.close();
});

test("a player with a Selection scores their own Game, up to the Current Round, and the server refuses anyone else's", async ({
  page,
  browser,
  baseURL,
}) => {
  // Eight Players on two courts: everyone plays every Round, so no Byes to step around.
  await signIn(page);
  await drawBoard(page, ROSTER.split("\n").slice(0, 8).join("\n"));
  await page.getByRole("button", { name: "Go live" }).click();
  await page.waitForURL(/\/tools\/match-mixer\/organizer\/[0-9a-f]{32}$/);
  const playerLink = await page.getByRole("textbox", { name: "Player Link" }).inputValue();
  await expect(page.getByText("Round 1 of", { exact: false })).toBeVisible();

  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const player = await phone.newPage();
  await player.goto(playerLink);

  // No Selection: told to pick a name, and nothing to score.
  await expect(player.getByText("Tap your name on the board first.", { exact: false })).toBeVisible();
  await expect(player.getByRole("button", { name: /enter the score/ })).toHaveCount(0);

  const name = player.getByRole("button", { name: "Ben Johns" }).first();
  await name.click();
  await expect(name).toHaveAttribute("aria-pressed", "true");
  // Their own Game in Round 1, and only that one; Round 2 hasn't started.
  const own = player.getByRole("button", { name: /^Round 1, Court \d: enter the score$/ });
  await expect(own).toHaveCount(1);
  await expect(player.getByRole("button", { name: /^Round 2, / })).toHaveCount(0);
  await expect(player.getByText("Round 2 hasn't started yet.")).toBeAttached();

  // The organizer's one Round control starts Round 2, and the player can score it now.
  await page.getByRole("button", { name: "Start round 2" }).click();
  await expect(page.getByRole("button", { name: "Start round 3" })).toBeVisible();
  await expect(player.getByRole("button", { name: /^Round 2, Court \d: enter the score$/ })).toHaveCount(1, {
    timeout: 10_000,
  });
  await expect(player.getByText("Round 3 hasn't started yet.")).toBeAttached();

  const court = Number((await own.getAttribute("aria-label"))!.match(/Court (\d)/)![1]);
  const other = court === 1 ? 2 : 1;
  await own.click();
  const keypad = player.getByRole("dialog", { name: `Round 1 · Court ${court}` });
  for (const key of ["1", "1", "7"]) await keypad.getByRole("button", { name: key, exact: true }).click();

  // The phone's own check is a convenience: a write for a Game the Selection
  // isn't in, sent anyway, is refused by the server.
  await player.route("**/tools/match-mixer/player/**", (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"court":')) return route.continue();
    return route.continue({ postData: body.replace(`"court":${court - 1}`, `"court":${other - 1}`) });
  });
  await keypad.getByRole("button", { name: "Save score" }).click();
  await expect(keypad.getByRole("status")).toHaveText("You can score your own Games only. The organizer can fix any other.");
  await player.unroute("**/tools/match-mixer/player/**");

  await keypad.getByRole("button", { name: "Save score" }).click();
  await expect(keypad).toBeHidden();
  await expect(page.getByRole("button", { name: `Round 1, Court ${court}: 11 to 7. Change the score` })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("button", { name: `Round 1, Court ${other}: enter the score` })).toBeVisible();

  // Clearing the Selection takes the Score controls away again.
  await name.click();
  await expect(player.getByRole("button", { name: /enter the score|Change the score/ })).toHaveCount(0);
  await phone.close();
});

/**
 * Holds a page's view of the night where it is: its re-reads (server action
 * POSTs without a Game in them) never arrive, while its writes go through.
 */
async function freeze(on: Page): Promise<void> {
  await on.route("**/tools/match-mixer/**", (route) => {
    const post = route.request().method() === "POST";
    return post && !(route.request().postData() ?? "").includes('"court":') ? route.abort() : route.continue();
  });
}

test("the organizer finishes the night, and then a score from either link is refused (#690)", async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page);
  await drawBoard(page, ROSTER.split("\n").slice(0, 8).join("\n"));
  await page.getByRole("button", { name: "Go live" }).click();
  await page.waitForURL(/\/tools\/match-mixer\/organizer\/[0-9a-f]{32}$/);
  const playerLink = await page.getByRole("textbox", { name: "Player Link" }).inputValue();
  await page.getByRole("button", { name: "Round 1, Court 1: enter the score" }).click();
  const keypad = page.getByRole("dialog", { name: "Round 1 · Court 1" });
  for (const key of ["1", "1", "4"]) await keypad.getByRole("button", { name: key, exact: true }).click();

  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const player = await phone.newPage();
  await player.goto(playerLink);
  await player.getByRole("button", { name: "Ben Johns" }).first().click();
  await player.getByRole("button", { name: /^Round 1, Court \d: enter the score$/ }).click();
  const playerKeypad = player.getByRole("dialog", { name: /^Round 1 · Court \d$/ });
  for (const key of ["1", "1", "7"]) await playerKeypad.getByRole("button", { name: key, exact: true }).click();

  // Both keypads stay open on the night as it was, as on a phone that missed the news.
  await freeze(page);
  await freeze(player);

  // The organizer finishes from another tab, behind a second tap.
  const desk = await page.context().newPage();
  await desk.goto(page.url());
  await desk.getByRole("button", { name: "Finish Mixer" }).click();
  await expect(desk.getByText("Finish now? After this, nobody can change a score.")).toBeVisible();
  await desk.getByRole("button", { name: "Keep playing" }).click();
  await expect(desk.getByRole("button", { name: "Yes, finish the night" })).toHaveCount(0);
  await desk.getByRole("button", { name: "Finish Mixer" }).click();
  await desk.getByRole("button", { name: "Yes, finish the night" }).click();
  await expect(desk.getByRole("heading", { name: "Final Standings" })).toBeVisible();
  await expect(desk.getByText("Finished ·", { exact: false })).toBeVisible();
  await expect(desk.getByRole("button", { name: /enter the score|Finish Mixer|Start round/ })).toHaveCount(0);

  // The server refuses both writes.
  const finished = "This Live Mixer has finished, so its scores and Standings are final.";
  await keypad.getByRole("button", { name: "Save score" }).click();
  await expect(keypad.getByRole("status")).toHaveText(finished);
  await playerKeypad.getByRole("button", { name: "Save score" }).click();
  await expect(playerKeypad.getByRole("status")).toHaveText(finished);

  // Read afresh, the Player Link shows the final Standings and nothing to score.
  await player.unroute("**/tools/match-mixer/**");
  await player.reload();
  await expect(player.getByRole("heading", { name: "Final Standings" })).toBeVisible();
  await expect(player.getByText("This Live Mixer has finished.", { exact: false })).toBeVisible();
  await expect(player.getByRole("button", { name: /enter the score/ })).toHaveCount(0);
  await expect(topRow(player)).toHaveText(["1", "0", "0", "0"]);
  await phone.close();
});

test("signed out, Go Live asks for sign-in and leaves the board as it was", async ({ page }) => {
  const drawn = await drawBoard(page);

  await page.getByRole("button", { name: "Go live" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Sign in with Google to go live." })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`));
  await expect(boardGrid(page)).toHaveText(drawn);
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
