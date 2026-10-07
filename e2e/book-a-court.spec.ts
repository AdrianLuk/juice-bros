import type { Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { deleteSlots } from "./support/slot-cleanup.ts";
import { pickDate } from "./support/date-field.ts";
import { addPlace, logBooking, placeName, removePlace, row, selectDuration } from "./support/places.ts";

/**
 * "Book a court" (issue #573): an organizer's game with no court, at a
 * facility whose Booking Window is open, carries a notice on the dashboard and
 * on the game's own page. Attaching a Booking clears it from both, and a
 * friend opening the same game never sees it.
 */

/** Two days from today on Toronto's clock, the zone a hand-named facility gets. */
function dayAfterTomorrow(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const at = new Date(`${today}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 2);
  return at.toISOString().slice(0, 10);
}

const notesFor = (page: Page, place: string) =>
  page.getByRole("list", { name: "Courts to book" }).getByRole("listitem").filter({ hasText: place });

test("an unbooked game whose window is open says so until a court is attached, to its organizer only", async ({
  page,
  accounts,
}) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  const date = dayAfterTomorrow();
  const place = placeName();
  let slotId: string | null = null;

  await signIn(page, accounts.amy.email, "/booking-buddy/bookings");
  try {
    // A facility that opens bookings 3 days ahead at 6am: for a game two days
    // out, that was yesterday morning.
    await addPlace(page, place);
    const placeRow = row(page, place);
    await placeRow.getByLabel("Days before").selectOption("3");
    await placeRow.getByLabel("Time the window opens").selectOption("06:00");
    await placeRow.getByRole("button", { name: "Save" }).click();
    await expect(placeRow).toContainText("Opens 3 days before, at 6:00 AM");

    await logBooking(page, { place, court: "5", date, start: "20:00", end: "22:00" });
    await expect(row(page, "Court 5")).toBeVisible();

    await page.goto("/booking-buddy/slots");
    await pickDate(page, date);
    await page.getByLabel("Start").selectOption("20:00");
    await selectDuration(page, "20:00", "22:00");
    await page.getByLabel("Facility").selectOption({ label: place });
    await page.getByRole("button", { name: "Post game" }).click();
    const gameRow = row(page, place).filter({ has: page.getByRole("link") }).first();
    await expect(gameRow).toBeVisible();
    await gameRow.getByRole("link").click();
    await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
    slotId = page.url().split("/").pop()!;
    const gameUrl = new URL(page.url()).pathname;

    // The game's own page: names the game and the facility, says when it opened.
    await expect(notesFor(page, place)).toHaveCount(1);
    await expect(notesFor(page, place)).toContainText("Book a court for");
    await expect(notesFor(page, place)).toContainText("8:00 PM");
    await expect(notesFor(page, place)).toContainText(`${place} opened bookings yesterday.`);

    // The dashboard carries the same notice, linking back to the game.
    await page.goto("/booking-buddy");
    await expect(notesFor(page, place)).toHaveCount(1);
    await expect(notesFor(page, place).getByRole("link", { name: "Open the game" })).toHaveAttribute(
      "href",
      gameUrl,
    );

    // A friend opening the same game never sees the organizer's to-do.
    const friend = await page.context().browser()!.newContext();
    const friendPage = await friend.newPage();
    await signIn(friendPage, accounts.ben2.email, gameUrl);
    await expect(friendPage.getByRole("heading", { name: "Your response" })).toBeVisible();
    await expect(friendPage.getByRole("list", { name: "Courts to book" })).toHaveCount(0);
    await friend.close();

    // Attaching the court clears it from the game page...
    await page.goto(gameUrl);
    await expect(notesFor(page, place)).toHaveCount(1);
    const picker = page.getByLabel("Add a court");
    const value = await picker.locator("option", { hasText: "Court 5" }).getAttribute("value");
    await picker.selectOption(value!);
    await page.getByRole("button", { name: "Attach booking" }).click();
    await expect(page.getByText("Court booked")).toBeVisible();
    await expect(notesFor(page, place)).toHaveCount(0);

    // ...and from the dashboard. Wait for the board's own content first: the
    // route streams behind a skeleton, and a count before it lands reads zero.
    await page.goto("/booking-buddy");
    await expect(page.getByText("Post a new game")).toBeVisible();
    await expect(notesFor(page, place)).toHaveCount(0);
  } finally {
    if (slotId) {
      await deleteSlots([slotId], amy);
    }
    await removePlace(page, place);
  }
});
