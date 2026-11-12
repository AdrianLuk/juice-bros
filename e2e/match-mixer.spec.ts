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

/** The board's column headers, "Court 1" and so on, in order. */
function courtHeaders(page: Page): Locator {
  return boardGrid(page).getByRole("columnheader", { name: /^Court / });
}

test("a venue drawn, saved and used names the board's courts, across a reload and a link (#697)", async ({
  page,
  browser,
  baseURL,
}) => {
  await drawBoard(page, OWN_ROSTER);
  await expect(courtHeaders(page)).toHaveText(["Court 1", "Court 2"]);

  // Draw the venue: a plus sign, with the middle court renumbered to 14.
  await page.getByRole("button", { name: "Use your venue’s court numbers" }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "Plus sign" }).click();
  await picker.getByRole("button", { name: "Court 3", exact: true }).click();
  const number = picker.getByRole("textbox", { name: "Court number" });
  await number.fill("14");
  await number.press("Enter");
  await expect(picker.getByRole("button", { name: "Court 14, selected" })).toBeVisible();

  await picker.getByLabel("Save this venue as").fill("Rec Centre North");
  await picker.getByRole("button", { name: "Save", exact: true }).click();
  await expect(picker.getByText("Saved Rec Centre North.")).toBeVisible();

  // Tonight only the middle and the right arm are booked.
  await picker.getByRole("button", { name: "2. Tonight’s courts" }).click();
  for (const court of [1, 2, 5]) {
    await picker.getByRole("button", { name: `Court ${court}, booked tonight` }).click();
  }
  await picker.getByRole("button", { name: "Use courts 4, 14" }).click();
  await expect(picker).toBeHidden();

  // The same seats, under the facility's numbers: no redraw needed.
  await expect(courtHeaders(page)).toHaveText(["Court 4", "Court 14"]);
  await expect(page.getByText("Tonight: courts 4 and 14.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Wipe & redraw" })).toBeVisible();

  // A reload keeps the labels, and the venue is still saved.
  await page.reload();
  await expect(courtHeaders(page)).toHaveText(["Court 4", "Court 14"]);
  await page.getByRole("button", { name: "Change courts" }).click();
  const again = page.getByRole("dialog");
  await expect(again.getByRole("button", { name: "Rec Centre North", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(again.getByRole("button", { name: "Use courts 4, 14" })).toBeVisible();
  await again.getByRole("button", { name: "Cancel" }).click();

  // Whoever opens the link sees the same court numbers.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy the link to this board" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied." })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const reader = await browser.newContext({ baseURL });
  const theirs = await reader.newPage();
  await theirs.goto(link);
  await expect(courtHeaders(theirs)).toHaveText(["Court 4", "Court 14"]);
  await reader.close();

  // Numbering 1 to N again puts the plain board back.
  await page.getByRole("button", { name: "Number 1 to 2" }).click();
  await expect(courtHeaders(page)).toHaveText(["Court 1", "Court 2"]);
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
