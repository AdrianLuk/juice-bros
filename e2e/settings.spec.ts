import { expect, test } from "@playwright/test";

import { AMY, signIn } from "./support/sign-in.ts";

/**
 * Changing a Username.
 *
 * Every test here puts the handle back to `amyace` before it ends: the rest of
 * the suite finds Amy by that handle, and the seed script won't restore it
 * without a database reset.
 */
const ORIGINAL = "amyace";

/** Taken by another seeded account, so it can never be claimed. */
const TAKEN = "benbackhand";

/**
 * The form's own error, not Next's route announcer — that is also
 * role="alert", and an unscoped locator matches both.
 */
const alertIn = (page: import("@playwright/test").Page) =>
  page.locator("form").getByRole("alert");

test.beforeEach(async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy/settings");
});

test.afterEach(async ({ page }) => {
  await page.goto("/booking-buddy/settings");
  const field = page.getByLabel("Username");

  if ((await field.inputValue()) !== ORIGINAL) {
    await field.fill(ORIGINAL);
    await page.getByRole("button", { name: "Save username" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  }
});

test("the handle assigned at signup is what the form starts on", async ({ page }) => {
  await expect(page.getByLabel("Username")).toHaveValue(ORIGINAL);
});

test("a new handle can be chosen, and it sticks", async ({ page }) => {
  const chosen = `amy_the_ace_${Date.now().toString().slice(-6)}`;

  await page.getByLabel("Username").fill(chosen);
  await page.getByRole("button", { name: "Save username" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // Not just the optimistic form state — it survives a fresh read.
  await page.reload();
  await expect(page.getByLabel("Username")).toHaveValue(chosen);
});

test("a handle someone else holds is refused", async ({ page }) => {
  await page.getByLabel("Username").fill(TAKEN);
  await page.getByRole("button", { name: "Save username" }).click();

  await expect(alertIn(page)).toContainText("taken");

  await page.reload();
  await expect(page.getByLabel("Username")).toHaveValue(ORIGINAL);
});

test("the same handle in different case is still someone else's", async ({ page }) => {
  // Uniqueness is on lower(username): `BenBackhand` and `benbackhand` are one
  // handle, or impersonation would be a matter of pressing shift.
  await page.getByLabel("Username").fill(TAKEN.toUpperCase());
  await page.getByRole("button", { name: "Save username" }).click();

  await expect(alertIn(page)).toContainText("taken");
});

test("your own handle in a different case is not a collision", async ({ page }) => {
  // It normalises to what is already stored, so this is a no-op, not a clash
  // with yourself.
  await page.getByLabel("Username").fill(ORIGINAL.toUpperCase());
  await page.getByRole("button", { name: "Save username" }).click();

  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByLabel("Username")).toHaveValue(ORIGINAL);
});

test("punctuation is refused with a reason, not silently stripped", async ({
  page,
}) => {
  // The browser's own minlength/maxlength cover the length rules, so this
  // checks the one the server has to make: which characters are allowed.
  await page.getByLabel("Username").fill("amy.ace");
  await page.getByRole("button", { name: "Save username" }).click();

  await expect(alertIn(page)).toContainText(
    "letters, numbers and underscores",
  );
});
