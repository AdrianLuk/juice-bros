import { expect, test } from "@playwright/test";

/**
 * The demo's three views, let it run, and reset (issue #522, on top of the
 * demo night itself, #519). `/on-deck/demo` needs no account and no seeded
 * data — the whole night folds in the browser — so this spec, unlike every
 * other On Deck spec, opens the route cold with nothing in `beforeAll`.
 *
 * Covers: opening the demo mid-night, one turnover, switching between the
 * Floor, the Display and the Kiosk without losing state, letting the night
 * run on its own, and resetting back to the opening state.
 *
 * Foursomes are read as `ul > li` text arrays rather than a panel's whole
 * `innerText`/`textContent`, following `on-deck-kiosk.spec.ts`: a Kiosk Court
 * panel and its own turnover button share a `kiosk-court-N` testid (a
 * pre-existing quirk this spec inherited rather than papered over), so a bare
 * `getByTestId` on it is ambiguous the moment that Court is occupied.
 */

function namesOn(page: import("@playwright/test").Page, testId: string) {
  return page.getByTestId(testId).locator("ul > li").allTextContents();
}

test("opens on a night already in progress, on the Floor", async ({ page }) => {
  await page.goto("/on-deck/demo");

  await expect(page.getByTestId("court-1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Court 1 done" })).toBeVisible();
  await expect(page.getByTestId("queue-list")).toBeVisible();
  // The synthetic tell: nothing on the board is a real Player.
  await expect(page.getByText(/ends in B/)).toBeVisible();
});

test("a turnover changes who is on the court", async ({ page }) => {
  await page.goto("/on-deck/demo");

  const before = await namesOn(page, "court-1");
  await page.getByRole("button", { name: "Court 1 done" }).click();

  await expect(async () => {
    expect(await namesOn(page, "court-1")).not.toEqual(before);
  }).toPass();
});

test("switches between the Floor, the Display and the Kiosk without losing the turnover", async ({
  page,
}) => {
  await page.goto("/on-deck/demo");

  await page.getByRole("button", { name: "Court 1 done" }).click();
  const afterTurnover = await namesOn(page, "court-1");

  await page.getByTestId("demo-screen-display").click();
  await expect(page.getByTestId("display-board")).toBeVisible();
  // Read-only, and no Club to scan into on the demo.
  await expect(page.getByTestId("display-join-qr")).not.toBeAttached();
  expect(await namesOn(page, "display-court-1")).toEqual(afterTurnover);

  await page.getByTestId("demo-screen-kiosk").click();
  await expect(page.getByTestId("kiosk-board")).toBeVisible();
  expect(await namesOn(page, "kiosk-court-1")).toEqual(afterTurnover);

  await page.getByTestId("demo-screen-floor").click();
  expect(await namesOn(page, "court-1")).toEqual(afterTurnover);
});

test("a tap on the Kiosk shows up back on the Floor", async ({ page }) => {
  await page.goto("/on-deck/demo");

  await page.getByTestId("demo-screen-kiosk").click();
  const before = await namesOn(page, "kiosk-court-2");
  await page.getByRole("button", { name: "Court 2 done" }).click();

  await expect(async () => {
    expect(await namesOn(page, "kiosk-court-2")).not.toEqual(before);
  }).toPass();
  const afterTurnover = await namesOn(page, "kiosk-court-2");

  await page.getByTestId("demo-screen-floor").click();
  expect(await namesOn(page, "court-2")).toEqual(afterTurnover);
});

test("let it run fires turnovers on its own, and can be stopped", async ({ page }) => {
  await page.goto("/on-deck/demo");

  const opening = await page.getByTestId("queue-list").textContent();

  await page.getByTestId("demo-let-it-run").click();
  await expect(page.getByTestId("demo-let-it-run")).toHaveText("Stop");

  await expect(async () => {
    expect(await page.getByTestId("queue-list").textContent()).not.toBe(opening);
  }).toPass({ timeout: 15_000 });

  await page.getByTestId("demo-let-it-run").click();
  await expect(page.getByTestId("demo-let-it-run")).toHaveText("Let it run");

  const stopped = await page.getByTestId("queue-list").textContent();
  // Give a would-be tick time to land, then confirm none did.
  await page.waitForTimeout(3_500);
  expect(await page.getByTestId("queue-list").textContent()).toBe(stopped);
});

test("reset returns the board to its opening state", async ({ page }) => {
  await page.goto("/on-deck/demo");

  const opening = await namesOn(page, "court-1");
  await page.getByRole("button", { name: "Court 1 done" }).click();
  await expect(async () => {
    expect(await namesOn(page, "court-1")).not.toEqual(opening);
  }).toPass();

  await page.getByTestId("demo-reset").click();
  await expect(async () => {
    expect(await namesOn(page, "court-1")).toEqual(opening);
  }).toPass();
});
