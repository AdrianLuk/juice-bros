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
  await expect(boardGrid(page)).toHaveText(drawn);

  const playerLink = await page.getByRole("textbox", { name: "Player Link" }).inputValue();
  expect(playerLink).toMatch(/\/tools\/match-mixer\/player\/[0-9a-f]{32}$/);
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
