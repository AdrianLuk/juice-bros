import { expect, test, type Page } from "@playwright/test";

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
const alertIn = (page: Page) => page.locator("form").getByRole("alert");

/**
 * Two independent preference forms both have a "Save" button — the account
 * settings page's `NotificationPreferencesForm` and `BookingWindowPreferenceForm`
 * are separate `<form>`s, each with the same exact button text. Scoping to
 * "the form containing this field" is what makes each one's save button
 * unambiguous.
 */
const formWithField = (page: Page, labelText: string) =>
  page.locator("form").filter({ has: page.getByLabel(labelText) });

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

  // Same reasoning as the username reset above: the seed script won't put
  // these back on their own, so a test that flips either off has to flip it
  // back.
  const emailReminders = page.getByLabel("Email me a reminder before slots I've said yes to, so I don't forget to show up");
  if (!(await emailReminders.isChecked())) {
    await emailReminders.check();
    await formWithField(page, "Email me a reminder before slots I've said yes to, so I don't forget to show up")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(page.getByRole("status")).toBeVisible();
  }

  const bookingWindowReminders = page.getByLabel("Email me once a facility's booking window opens, so I don't forget to reserve a court");
  if (!(await bookingWindowReminders.isChecked())) {
    await bookingWindowReminders.check();
    await formWithField(page, "Email me once a facility's booking window opens, so I don't forget to reserve a court")
      .getByRole("button", { name: "Save", exact: true })
      .click();
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

test("email reminders default to enabled", async ({ page }) => {
  await expect(
    page.getByLabel("Email me a reminder before slots I've said yes to, so I don't forget to show up"),
  ).toBeChecked();
});

test("turning email reminders off sticks", async ({ page }) => {
  const emailReminders = page.getByLabel("Email me a reminder before slots I've said yes to, so I don't forget to show up");

  await emailReminders.uncheck();
  await formWithField(page, "Email me a reminder before slots I've said yes to, so I don't forget to show up")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // Not just the optimistic form state — it survives a fresh read.
  await page.reload();
  await expect(emailReminders).not.toBeChecked();
});

test("booking window reminders default to enabled", async ({ page }) => {
  await expect(
    page.getByLabel("Email me once a facility's booking window opens, so I don't forget to reserve a court"),
  ).toBeChecked();
});

test("turning booking window reminders off sticks, independently of the other toggle", async ({
  page,
}) => {
  const bookingWindowReminders = page.getByLabel("Email me once a facility's booking window opens, so I don't forget to reserve a court");
  const emailReminders = page.getByLabel("Email me a reminder before slots I've said yes to, so I don't forget to show up");

  await bookingWindowReminders.uncheck();
  await formWithField(page, "Email me once a facility's booking window opens, so I don't forget to reserve a court")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // Not just the optimistic form state — it survives a fresh read.
  await page.reload();
  await expect(page.getByLabel("Email me once a facility's booking window opens, so I don't forget to reserve a court")).not.toBeChecked();

  // The other preference is untouched — these are two separate settings,
  // not one control wearing two labels.
  await expect(emailReminders).toBeChecked();
});
