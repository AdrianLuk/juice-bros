import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Mic Drop's signed-out landing: a preview with a demo chart that runs in the
 * browser only. A visitor votes, switches, closes voting to see No. 1, and
 * finds the Host's sign-in at the bottom. No database involved.
 */

const PHONE = { viewport: { width: 390, height: 844 } };

function row(page: Page, name: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^${name},`) });
}

/** Taps until the row is the visitor's Vote, in case the first tap beat hydration. */
async function voteFor(page: Page, name: string) {
  await expect(async () => {
    await row(page, name).click();
    await expect(row(page, name)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test("a visitor votes in the demo, switches, and closes voting to see No. 1", async ({ browser }) => {
  const page = await (await browser.newContext(PHONE)).newPage();
  await page.goto("/tools/mic-drop");

  await expect(page.getByRole("heading", { level: 1, name: "Mic Drop" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Live demo")).toBeVisible();

  await voteFor(page, "Anna Bright");
  await expect(page.getByText("Your vote: Anna Bright.")).toBeVisible();
  await voteFor(page, "Federico Staksrud");
  await expect(row(page, "Anna Bright")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Your vote: Federico Staksrud.")).toBeVisible();

  await page.getByRole("button", { name: "Close voting" }).click();
  await expect(page.getByText("Final chart")).toBeVisible();
  await expect(page.getByRole("region", { name: /Winner|Joint winners/ })).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByText("Live demo")).toBeVisible();
  await expect(page.getByText("Tap a name to vote.")).toBeVisible();

  await expect(page.getByRole("heading", { level: 2, name: "Hosting a night?" })).toBeVisible();
});
