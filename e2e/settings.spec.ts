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
 * The account settings page has several `<form>`s, and the Username / Gender
 * ones each carry their own "Save …" button. Scoping to "the form containing
 * this field" keeps the plain "Save" button unambiguous. All three email
 * notification toggles now live in one form behind a single "Save", so every
 * notification label resolves to that same form.
 */
const formWithField = (page: Page, labelText: string) =>
  page.locator("form").filter({ has: page.getByLabel(labelText) });

/** Gender (issue #79) is a radiogroup, not a labelled field `formWithField` can find — scoped by its own "Prefer not to say" choice instead. */
const genderForm = (page: Page) =>
  page.locator("form").filter({ has: page.getByRole("radio", { name: "Prefer not to say" }) });

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
  const emailReminders = page.getByLabel("Email me a reminder before games I've said yes to, so I don't forget to show up");
  if (!(await emailReminders.isChecked())) {
    await emailReminders.check();
    await formWithField(page, "Email me a reminder before games I've said yes to, so I don't forget to show up")
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

  const friendRequestEmails = page.getByLabel("Email me when someone sends me a friend request, so I can accept it right away");
  if (!(await friendRequestEmails.isChecked())) {
    await friendRequestEmails.check();
    await formWithField(page, "Email me when someone sends me a friend request, so I can accept it right away")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(page.getByRole("status")).toBeVisible();
  }

  // Same reasoning as Username above — Gender (issue #79) is unset by
  // default for the seeded account, and a test that sets it has to unset it.
  const genderUnset = page.getByRole("radio", { name: "Prefer not to say" });
  if ((await genderUnset.getAttribute("aria-checked")) !== "true") {
    await genderUnset.click();
    await genderForm(page).getByRole("button", { name: "Save gender" }).click();
    await expect(genderForm(page).getByRole("status")).toBeVisible();
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

test("the three email toggles share one Save button, with push at the top", async ({
  page,
}) => {
  const notificationsCard = page
    .locator(".bb-card")
    .filter({ has: page.getByLabel("Push me a reminder on this device") });

  // Every email toggle sits in the one form, behind a single "Save".
  await expect(
    notificationsCard.getByRole("button", { name: "Save", exact: true }),
  ).toHaveCount(1);

  // "Push me a reminder" is the first checkbox in the card.
  await expect(notificationsCard.getByRole("checkbox").first()).toHaveAttribute(
    "id",
    "push-enabled",
  );
});

test("email reminders default to enabled", async ({ page }) => {
  await expect(
    page.getByLabel("Email me a reminder before games I've said yes to, so I don't forget to show up"),
  ).toBeChecked();
});

test("turning email reminders off sticks", async ({ page }) => {
  const emailReminders = page.getByLabel("Email me a reminder before games I've said yes to, so I don't forget to show up");

  await emailReminders.uncheck();
  await formWithField(page, "Email me a reminder before games I've said yes to, so I don't forget to show up")
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
  const emailReminders = page.getByLabel("Email me a reminder before games I've said yes to, so I don't forget to show up");

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

test("the friend-request email defaults to enabled", async ({ page }) => {
  await expect(
    page.getByLabel("Email me when someone sends me a friend request, so I can accept it right away"),
  ).toBeChecked();
});

test("turning the friend-request email off sticks, independently of the reminder toggles", async ({
  page,
}) => {
  const friendRequestEmails = page.getByLabel("Email me when someone sends me a friend request, so I can accept it right away");
  const emailReminders = page.getByLabel("Email me a reminder before games I've said yes to, so I don't forget to show up");

  await friendRequestEmails.uncheck();
  await formWithField(page, "Email me when someone sends me a friend request, so I can accept it right away")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.reload();
  await expect(
    page.getByLabel("Email me when someone sends me a friend request, so I can accept it right away"),
  ).not.toBeChecked();

  // The game reminder toggle is a separate setting and stays on.
  await expect(emailReminders).toBeChecked();
});

test("the request-accepted email defaults to enabled", async ({ page }) => {
  await expect(
    page.getByLabel("Email me when someone accepts a friend request I sent, so I know we're connected"),
  ).toBeChecked();
});

test("turning the request-accepted email off sticks, independently of the other toggles", async ({
  page,
}) => {
  const acceptedEmails = page.getByLabel("Email me when someone accepts a friend request I sent, so I know we're connected");
  const friendRequestEmails = page.getByLabel("Email me when someone sends me a friend request, so I can accept it right away");

  await acceptedEmails.uncheck();
  await formWithField(page, "Email me when someone accepts a friend request I sent, so I know we're connected")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.reload();
  await expect(
    page.getByLabel("Email me when someone accepts a friend request I sent, so I know we're connected"),
  ).not.toBeChecked();

  // The incoming friend-request email is a separate setting and stays on.
  await expect(friendRequestEmails).toBeChecked();
});

test("gender is unset by default", async ({ page }) => {
  await expect(page.getByRole("radio", { name: "Prefer not to say" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("a gender can be chosen, and it sticks — independently of Username", async ({ page }) => {
  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await genderForm(page).getByRole("button", { name: "Save gender" }).click();
  await expect(genderForm(page).getByRole("status")).toContainText("Saved");

  // Not just the optimistic form state — it survives a fresh read.
  await page.reload();
  await expect(page.getByRole("radio", { name: "Male", exact: true })).toHaveAttribute("aria-checked", "true");
  // Choosing a Gender never touched the Username saved right next to it.
  await expect(page.getByLabel("Username")).toHaveValue(ORIGINAL);
});

test("a gender can be cleared back to unset", async ({ page }) => {
  await page.getByRole("radio", { name: "Female" }).click();
  await genderForm(page).getByRole("button", { name: "Save gender" }).click();
  await expect(genderForm(page).getByRole("status")).toBeVisible();

  await page.getByRole("radio", { name: "Prefer not to say" }).click();
  await genderForm(page).getByRole("button", { name: "Save gender" }).click();
  await expect(genderForm(page).getByRole("status")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("radio", { name: "Prefer not to say" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
