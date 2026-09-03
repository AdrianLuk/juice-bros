import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { deleteSlots } from "./support/slot-cleanup.ts";
import { addPlace, placeName, removePlace, selectDuration } from "./support/places.ts";
import { pickDate } from "./support/date-field.ts";

/**
 * The Slot Link + Guest RSVP journey (issue #10): the owner generates a
 * link, and a Guest with no account at all — a fresh, unauthenticated
 * browser context, not just a different User — views the Slot and RSVPs by
 * name through it.
 *
 * `slot_links` and `guest_rsvp_log` both cascade away with their Slot, so
 * `deleteSlots` (already used by `slots.spec.ts`) is sufficient cleanup here
 * too — no separate sweep needed.
 */

function row(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}

async function createSlot(
  page: Page,
  slot: { date: string; start: string; end: string; label: string },
): Promise<string> {
  await page.goto("/booking-buddy/slots");
  await pickDate(page, slot.date);
  await page.getByLabel("Start").selectOption(slot.start);
  await selectDuration(page, slot.start, slot.end);
  await page.getByRole("button", { name: "Post game" }).click();

  await row(page, slot.label).getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  return page.url().split("/").pop()!;
}

test.beforeEach(async ({ page, accounts }) => {
  await signIn(page, accounts.amy.email, "/booking-buddy/slots");
});

test("the owner can create an invite link and a guest can RSVP through it with no account", async ({
  page,
  browser,
  accounts,
}) => {
  const slotId = await createSlot(page, {
    date: "2031-04-04",
    start: "18:00",
    end: "19:00",
    label: "Apr 4, 2031",
  });

  try {
    await page.getByRole("button", { name: "Create invite link" }).click();
    const linkInput = page.getByLabel("Invite link");
    await expect(linkInput).toBeVisible();

    const url = await linkInput.inputValue();
    expect(url).toContain("/s/");

    // A fresh, unauthenticated context — not just a second User — since the
    // whole point of a Slot Link is working with no Booking Buddy account.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    await guestPage.goto(url);
    await expect(guestPage.getByRole("heading", { name: "Apr 4, 2031" })).toBeVisible();

    await guestPage.getByLabel("Your name").fill("Priya Guest");
    await guestPage.getByRole("button", { name: "Yes" }).click();

    await expect(
      guestPage.getByText("You're in. See you on the court."),
    ).toBeVisible();

    await guestContext.close();

    // Back on the owner's page: the Guest's RSVP shows up alongside any
    // signed-in Connection's, and no Connection was created by it.
    await page.reload();
    await expect(
      page.locator("li").filter({ hasText: "Priya Guest" }).filter({ hasText: "Yes" }),
    ).toBeVisible();

    await page.goto("/booking-buddy/friends");
    await expect(page.getByText("Priya Guest")).toHaveCount(0);
  } finally {
    await deleteSlots([slotId], { email: accounts.amy.email, password: accounts.password });
  }
});

test("a guest sees which facility the slot is for, even for a bare proposal", async ({
  page,
  browser,
  accounts,
}) => {
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy/slots");
  await pickDate(page, "2031-04-06");
  await page.getByLabel("Start").selectOption("18:00");
  await selectDuration(page, "18:00", "19:00");
  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByRole("button", { name: "Post game" }).click();

  await row(page, "Apr 6, 2031").getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  const slotId = page.url().split("/").pop()!;

  try {
    await page.getByRole("button", { name: "Create invite link" }).click();
    const url = await page.getByLabel("Invite link").inputValue();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(url);

    // No court booked — still a proposal — but the heading names the facility
    // the organizer is planning to book, so a guest arriving from WhatsApp
    // knows where the game would be.
    await expect(guestPage.getByRole("heading", { level: 1 })).toContainText(place);
    await expect(guestPage.getByRole("heading", { level: 1 })).toContainText("Apr 6, 2031");
    await expect(guestPage.getByText("still a proposal")).toBeVisible();

    await guestContext.close();
  } finally {
    await deleteSlots([slotId], { email: accounts.amy.email, password: accounts.password });
    await removePlace(page, place);
  }
});

test("generating an invite link twice reuses the same one", async ({ page, accounts }) => {
  const slotId = await createSlot(page, {
    date: "2031-04-05",
    start: "09:00",
    end: "10:00",
    label: "Apr 5, 2031",
  });

  try {
    await page.getByRole("button", { name: "Create invite link" }).click();
    const linkInput = page.getByLabel("Invite link");
    await expect(linkInput).toBeVisible();
    const firstUrl = await linkInput.inputValue();

    await page.reload();
    await expect(linkInput).toHaveValue(firstUrl);
  } finally {
    await deleteSlots([slotId], { email: accounts.amy.email, password: accounts.password });
  }
});

test("an unknown invite link reads as invalid, not a generic 404", async ({ page }) => {
  await page.goto("/s/this-token-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "This invite isn't valid" }),
  ).toBeVisible();
});
