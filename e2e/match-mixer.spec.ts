import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Match Mixer is client-side only (no auth, no Supabase): the Config lives in
 * `localStorage` and a Share Link carries it in the query string. Every test
 * starts from a clean browser context, so nothing saved leaks between them.
 *
 * Smoke tests over how the screen combines the engine, persistence and the
 * Share Link (#613). The engine modules have their own `node --test` suites;
 * these only pin what a reader sees across a reload or a link.
 *
 * The route server-renders an example board ("Last week's board") that the
 * restore effect replaces, so every read waits for the restored content first:
 * the roster box's value, or the board region, which the example never fills
 * (its grid is `aria-hidden` and carries no "The board" heading).
 */
const ROUTE = "/tools/match-mixer";

const OWN_ROSTER = [
  "Ben Johns",
  "Anna Leigh Waters",
  "Federico Staksrud",
  "Catherine Parenteau",
  "JW Johnson",
  "Anna Bright",
  "Tyson McGuffin",
  "Jorja Johnson",
].join("\n");

const BORROWED_ROSTER = [
  "Collin Johns",
  "Riley Newman",
  "Andrei Daescu",
  "Lea Jansen",
  "Hayden Patriquin",
  "Parris Todd",
  "Dylan Frazier",
  "Callie Smith",
].join("\n");

function rosterBox(page: Page): Locator {
  return page.getByRole("textbox", { name: "Tonight" });
}

/** The drawn board's grid. The example sheet never matches this. */
function boardGrid(page: Page): Locator {
  return page.getByRole("region", { name: "The board" }).getByRole("table");
}

/** Pastes a Roster into an empty screen and draws it; returns the grid's text. */
async function drawBoard(page: Page, roster: string): Promise<string> {
  await page.goto(ROUTE);
  const make = page.getByRole("button", { name: "Make the board" });
  // The server-rendered box is already empty and the button already there, so
  // neither says the page has hydrated. A fill before hydration (or before the
  // restore effect empties the box) is lost, and the button stays disabled
  // until React has read a drawable Roster, so retry until it has.
  await expect(async () => {
    await rosterBox(page).fill(roster);
    await expect(make).toBeEnabled({ timeout: 1_000 });
  }).toPass();
  await expect(rosterBox(page)).toHaveValue(roster);
  await make.click();
  await expect(boardGrid(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Wipe & redraw" })).toBeVisible();
  return (await boardGrid(page).textContent()) ?? "";
}

test("a pasted Roster and its board come back after a reload", async ({ page }) => {
  const drawn = await drawBoard(page, OWN_ROSTER);
  expect(drawn).toContain("Ben Johns");

  await page.reload();

  await expect(rosterBox(page)).toHaveValue(OWN_ROSTER);
  // The same board down to the seat: the Seed is saved and the Schedule is
  // generated again from it, not stored as a grid.
  await expect(boardGrid(page)).toHaveText(drawn);
  await expect(page.getByRole("button", { name: "Wipe & redraw" })).toBeVisible();
});

test("opening a Share Link leaves your own saved Roster untouched", async ({
  page,
  browser,
  baseURL,
}) => {
  // Somebody else's board, drawn in somebody else's browser and copied off the
  // page's own share control.
  const organizer = await browser.newContext({
    baseURL,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const theirs = await organizer.newPage();
  const borrowedGrid = await drawBoard(theirs, BORROWED_ROSTER);
  await theirs.getByRole("button", { name: "Copy the link to this board" }).click();
  await expect(theirs.getByRole("status").filter({ hasText: "Copied." })).toBeVisible();
  const link = await theirs.evaluate(() => navigator.clipboard.readText());
  await organizer.close();
  expect(new URL(link).searchParams.get("b")).toBeTruthy();

  // This browser's own club night, saved by a reload.
  const ownGrid = await drawBoard(page, OWN_ROSTER);
  await page.reload();
  await expect(rosterBox(page)).toHaveValue(OWN_ROSTER);

  // The link shows the Borrowed board, and keeps showing it across a reload.
  await page.goto(link);
  await expect(rosterBox(page)).toHaveValue(BORROWED_ROSTER);
  await expect(boardGrid(page)).toHaveText(borrowedGrid);
  await page.reload();
  await expect(rosterBox(page)).toHaveValue(BORROWED_ROSTER);
  await expect(boardGrid(page)).toHaveText(borrowedGrid);

  // Back on the plain route, the saved Roster and its board are still this
  // browser's own: reading the link wrote nothing.
  await page.goto(ROUTE);
  await expect(rosterBox(page)).toHaveValue(OWN_ROSTER);
  await expect(boardGrid(page)).toHaveText(ownGrid);
});

test("editing the Roster after drawing marks the board stale", async ({ page }) => {
  const drawn = await drawBoard(page, OWN_ROSTER);
  await expect(page.getByText(/^Superseded · /)).toHaveCount(0);

  await rosterBox(page).fill(`${OWN_ROSTER}\nJames Ignatowich`);

  await expect(page.getByText(/^Superseded · you now have /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Redraw the board" })).toBeVisible();
  await expect(
    page.getByText("The board on screen is the previous draw, not this one."),
  ).toBeVisible();
  // Still the previous draw underneath the flag, not a new one.
  await expect(boardGrid(page)).toHaveText(drawn);
});
