import { expect, test } from "./support/accounts.ts";
import { signIn } from "./support/sign-in.ts";
import { deleteAvailabilityWindows } from "./support/availability.ts";

/**
 * The "Availability" page (issue #197) — Plan's second child. Its own list of the
 * User's Availability Windows, plus the inline "Block off time" form, clicked
 * rather than asserted against the database.
 *
 * The dashboard calendar's own rendering of these windows is
 * `dashboard.spec.ts`'s; this is only the standalone page and its create /
 * delete round trip.
 */
test.afterEach(async ({ accounts }) => {
  // Safety net for a failed run — the test itself removes its window through
  // the UI as part of what it asserts.
  await deleteAvailabilityWindows({ email: accounts.amy.email, password: accounts.password });
});

test("the Availability pill shows in the Plan section's secondary nav", async ({ page, accounts }) => {
  await signIn(page, accounts.amy.email, "/booking-buddy/availability");

  const pills = page.getByRole("navigation", { name: "Section" });
  await expect(pills.getByRole("link", { name: "Games" })).toBeVisible();
  await expect(pills.getByRole("link", { name: "Availability" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("an availability window can be blocked off, listed, and removed again", async ({ page, accounts }) => {
  await deleteAvailabilityWindows({ email: accounts.amy.email, password: accounts.password });
  await signIn(page, accounts.amy.email, "/booking-buddy/availability");

  // All day is the default; a fixed, far-future range keeps this "upcoming"
  // for years and reads as "Jun 1 - Jun 7" (en dash) once saved.
  await page.getByLabel("From", { exact: true }).fill("2027-06-01");
  await page.getByLabel("To", { exact: true }).fill("2027-06-07");
  await page.getByRole("button", { name: "Save" }).click();

  const windowRow = page
    .getByRole("listitem")
    .filter({ hasText: /Jun 1.*Jun 7/ });
  await expect(windowRow).toBeVisible();
  await expect(windowRow).toContainText("Busy");

  // The confirm button in the dialog is also labelled "Remove", so scope the
  // second click to the dialog itself. It's a plain dismissable Dialog
  // (role "dialog"), not an AlertDialog — matched to DeleteBookingButton in #256.
  await windowRow.getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Remove this availability?")).toBeVisible();
  await dialog.getByRole("button", { name: "Remove" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: /Jun 1.*Jun 7/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Nothing upcoming.", { exact: false }),
  ).toBeVisible();
});
