import { expect, test, type Locator, type Page } from "@playwright/test";

import { AMY, BEN2, signIn } from "./support/sign-in.ts";
import { deleteSlots } from "./support/slot-cleanup.ts";
import {
  addPlace,
  logBooking,
  placeName,
  removePlace,
  selectDuration,
} from "./support/places.ts";

/**
 * The Slot poll journey: post a bare proposal, a friend with slots Visibility
 * sees it and responds, and the owner sees the response — issue #8.
 *
 * There's no delete-a-slot UI yet (out of scope for this ticket), so every
 * Slot a test creates is swept up afterward direct against Postgres via
 * `deleteSlots`, the same pattern `google-places-mock.ts`'s
 * `deleteCachedPlaces` uses for the same reason.
 */

/** A "when" row is found by a distinctive month/day/year — each test uses its own date. */
function row(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}

/**
 * Posts a Slot and clicks into its detail page. `label` is the distinctive
 * "month day, year" substring `formatSlotWhen` will render for `date` — the
 * caller supplies it rather than this function deriving it, so each test's
 * own assertions and this lookup can't drift apart.
 */
async function createSlot(
  page: Page,
  slot: { date: string; start: string; end: string; label: string; division?: string },
): Promise<string> {
  await page.goto("/booking-buddy/slots");
  await page.getByLabel("Date").fill(slot.date);
  await page.getByLabel("Start").selectOption(slot.start);
  await selectDuration(page, slot.start, slot.end);
  if (slot.division) {
    await page.getByLabel("Division").selectOption(slot.division);
  }
  await page.getByRole("button", { name: "Post slot" }).click();

  await row(page, slot.label).getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  return page.url().split("/").pop()!;
}

/** Sets the signed-in User's own Gender (issue #79) through Settings, so a Slot's gendered Capacity signal (issue #80) has something real to break down. */
async function setGender(page: Page, label: "Male" | "Female") {
  await page.goto("/booking-buddy/settings");
  await page.getByRole("radio", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "Save gender" }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

/** Puts Gender back to unset — the seeded accounts' default, and what every other spec expects. */
async function resetGender(page: Page) {
  await page.goto("/booking-buddy/settings");
  await page.getByRole("radio", { name: "Prefer not to say" }).click();
  await page.getByRole("button", { name: "Save gender" }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy/slots");
});

/**
 * Grants Ben2 `slots` Visibility into Amy for the duration of one test — the
 * same "Playwright"-prefixed, delete-at-the-end convention friend-groups.spec.ts
 * uses. Amy and Ben2 are already a Connection per the seed data
 * (booking-buddy/docs/local-test-accounts.md); this only adds the group.
 */
async function grantBen2SlotsVisibility(page: Page): Promise<string> {
  const name = `Playwright slots ${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

  await page.goto("/booking-buddy/groups");
  await page.getByLabel("Group name").fill(name);
  await page.getByLabel("What they can see").selectOption("slots");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  const card = page.locator("section").filter({ hasText: name }).last();
  const picker = card.getByLabel("Add a friend");
  const value = await picker
    .locator("option", { hasText: "@benbackhand2)" })
    .getAttribute("value");
  await picker.selectOption(value!);
  await card.getByRole("button", { name: "Add" }).click();
  await expect(card).toContainText("1 friend");

  return name;
}

async function revokeBen2SlotsVisibility(page: Page, name: string) {
  await page.goto("/booking-buddy/groups");
  const card = page.locator("section").filter({ hasText: name }).last();
  await card.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete group" }).click();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
}

test("a bare-proposal slot can be posted and shows up for its owner", async ({
  page,
}) => {
  const slotId = await createSlot(page, {
    date: "2031-03-03",
    start: "13:00",
    end: "14:00",
    label: "Mar 3, 2031",
  });

  try {
    await expect(page.getByRole("heading", { name: /Mar 3, 2031/ })).toBeVisible();
    await expect(page.getByText("Proposed by you")).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Your response" }).getByRole("button"),
    ).toHaveCount(3);

    await page.goto("/booking-buddy/slots");
    await expect(row(page, "Mar 3, 2031")).toBeVisible();
  } finally {
    await deleteSlots([slotId]);
  }
});

test("a slot's notes can be set at posting time, and edited afterward", async ({ page }) => {
  const originalNotes = "Playwright need 2 more players";
  const updatedNotes = "Playwright bring your own paddle";

  await page.goto("/booking-buddy/slots");
  await page.getByLabel("Date").fill("2031-11-11");
  await page.getByLabel("Start").selectOption("13:00");
  await selectDuration(page, "13:00", "14:00");
  await page.getByLabel("Notes").fill(originalNotes);
  await page.getByRole("button", { name: "Post slot" }).click();

  await row(page, "Nov 11, 2031").getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  const slotId = page.url().split("/").pop()!;

  try {
    // Set at posting time, already showing in the owner's own edit control.
    await expect(page.getByLabel("Notes")).toHaveValue(originalNotes);

    await page.getByLabel("Notes").fill(updatedNotes);
    await page.getByRole("button", { name: "Save notes" }).click();
    // Waits for the round trip to actually resolve (button leaves its
    // "Saving…" pending state) before reloading — otherwise the reload below
    // can race the Server Action and read the database before it wrote.
    await expect(page.getByRole("button", { name: "Save notes" })).toBeEnabled();

    // Not just the optimistic form state — it survives a fresh read.
    await page.reload();
    await expect(page.getByLabel("Notes")).toHaveValue(updatedNotes);
  } finally {
    await deleteSlots([slotId]);
  }
});

test("a slot cannot be posted for a date that's already passed", async ({ page }) => {
  await page.goto("/booking-buddy/slots");
  await page.getByLabel("Date").fill("2020-01-01");
  await page.getByLabel("Start").selectOption("13:00");
  await selectDuration(page, "13:00", "14:00");
  await page.getByRole("button", { name: "Post slot" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "already passed" }),
  ).toBeVisible();
  await expect(row(page, "2020")).toHaveCount(0);
});

test("a friend with slots Visibility can respond, and the owner sees it", async ({
  page,
  browser,
}) => {
  const groupName = await grantBen2SlotsVisibility(page);

  const slotId = await createSlot(page, {
    date: "2031-04-04",
    start: "10:00",
    end: "11:00",
    label: "Apr 4, 2031",
  });

  try {
    // Ben2 can see it from his own slots list, and can respond.
    const ben2Context = await browser.newContext();
    const ben2 = await ben2Context.newPage();

    try {
      await signIn(ben2, BEN2, "/booking-buddy/slots");
      await expect(row(ben2, "Apr 4, 2031")).toBeVisible();

      await ben2.goto(`/booking-buddy/slots/${slotId}`);
      await expect(ben2.getByText(/Proposed by/)).toBeVisible();
      await ben2
        .getByRole("group", { name: "Your response" })
        .getByRole("button", { name: "Maybe" })
        .click();
      await expect(
        ben2.getByRole("button", { name: "Maybe", pressed: true }),
      ).toBeVisible();
    } finally {
      await ben2Context.close();
    }

    // Amy sees Ben2's response on her own copy of the page. Ben and Ben2
    // share a display name (local-test-accounts.md), but only Ben2 has
    // responded to this Slot, so the row is unambiguous within it.
    await page.reload();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Ben Backhand" }),
    ).toContainText("Maybe");
  } finally {
    await deleteSlots([slotId]);
    await revokeBen2SlotsVisibility(page, groupName);
  }
});

test("a Connection with no slots Visibility cannot see or reach the slot", async ({
  page,
  browser,
}) => {
  // No group granted here — Amy and Ben2 are Connections per the seed data,
  // but a friend with no group and no override defaults to no access.
  const slotId = await createSlot(page, {
    date: "2031-06-06",
    start: "08:00",
    end: "09:00",
    label: "Jun 6, 2031",
  });

  try {
    const ben2Context = await browser.newContext();
    const ben2 = await ben2Context.newPage();

    try {
      await signIn(ben2, BEN2, "/booking-buddy/slots");
      await expect(row(ben2, "Jun 6, 2031")).toHaveCount(0);

      // RLS filters the row itself, so this reads as "not found" rather than
      // a permission error, same as getSlotDetail's stated contract.
      const response = await ben2.goto(`/booking-buddy/slots/${slotId}`);
      expect(response?.status()).toBe(404);
    } finally {
      await ben2Context.close();
    }
  } finally {
    await deleteSlots([slotId]);
  }
});

test("attaching a booking gives a proposal real capacity, and detaching takes it away", async ({
  page,
}) => {
  const place = placeName();
  await addPlace(page, place);
  await logBooking(page, {
    place,
    // formatCourtLabel prepends "Court " for display — the field itself is
    // numbers-only (type="number"), so the row/option text is still "Court 7".
    court: "7",
    date: "2031-07-07",
    start: "09:00",
    end: "10:00",
  });
  await logBooking(page, {
    place,
    court: "8",
    date: "2031-07-07",
    start: "09:00",
    end: "10:00",
    format: "Singles",
  });
  // The inserts have to land before the next navigation, or the picker this
  // test drives has nothing to select — `logBooking` submits but doesn't wait.
  await expect(row(page, "Court 7")).toBeVisible();
  await expect(row(page, "Court 8")).toBeVisible();

  const slotId = await createSlot(page, {
    date: "2031-07-07",
    start: "09:00",
    end: "10:00",
    label: "Jul 7, 2031",
  });

  try {
    // A bare proposal: nothing to fill yet (ADR 0001).
    await expect(page.getByText("still a proposal")).toBeVisible();

    // Picked by the option's own value: its label is the whole Booking
    // ("when — where · court"), which no exact-label match would survive.
    const picker = page.getByLabel("Add a court");
    const value = await picker
      .locator("option", { hasText: "Court 7" })
      .getAttribute("value");
    await picker.selectOption(value!);
    await page.getByRole("button", { name: "Attach booking" }).click();

    // One court, no buffer — four spots, and nobody has said yes.
    await expect(page.getByText("0 of 4 spots taken")).toBeVisible();
    await expect(page.getByText("1 court")).toBeVisible();

    await page.getByLabel("Rotation buffer").fill("2");
    await page.getByRole("button", { name: "Save buffer" }).click();
    await expect(page.getByText("0 of 6 spots taken")).toBeVisible();

    // A second, singles court adds its own two spots — not another four — on
    // top of what's already there (ADR 0008: each attached booking counts its
    // own format, doubles and singles summed independently).
    const secondValue = await picker
      .locator("option", { hasText: "Court 8" })
      .getAttribute("value");
    await picker.selectOption(secondValue!);
    await page.getByRole("button", { name: "Attach booking" }).click();
    await expect(page.getByText("0 of 8 spots taken")).toBeVisible();
    await expect(page.getByText("2 courts")).toBeVisible();

    // Confirm-before-detach, same convention as removing a booking or
    // deleting a slot — the row's button opens the dialog, the dialog's own
    // (differently-labelled) button is what actually detaches.
    const detachButtons = page.getByRole("button", { name: "Detach" });
    await detachButtons.first().click();
    await page.getByRole("button", { name: "Detach booking" }).click();
    await expect(detachButtons).toHaveCount(1);
    await detachButtons.click();
    await page.getByRole("button", { name: "Detach booking" }).click();
    await expect(page.getByText("still a proposal")).toBeVisible();
  } finally {
    await deleteSlots([slotId]);
    await removePlace(page, place);
  }
});

test("the reminder timing defaults to 60 minutes and the owner can change it", async ({
  page,
}) => {
  const slotId = await createSlot(page, {
    date: "2031-08-08",
    start: "09:00",
    end: "10:00",
    label: "Aug 8, 2031",
  });

  try {
    const reminderSelect = page.getByLabel("Remind attendees");
    await expect(reminderSelect).toHaveValue("60");

    await reminderSelect.selectOption("120");
    await page.getByRole("button", { name: "Save reminder timing" }).click();

    // Not just the optimistic form state — it survives a fresh read.
    await page.reload();
    await expect(page.getByLabel("Remind attendees")).toHaveValue("120");
  } finally {
    await deleteSlots([slotId]);
  }
});

test("the organizer can set an intended org for a still-bare-proposal slot", async ({
  page,
}) => {
  const place = placeName();
  await addPlace(page, place);

  const slotId = await createSlot(page, {
    date: "2031-09-09",
    start: "09:00",
    end: "10:00",
    label: "Sep 9, 2031",
  });

  try {
    // Still a bare proposal — no court attached — but the organizer can
    // already say which facility they're planning to book at.
    const intendedOrgSelect = page.getByLabel("Planning to book at");
    await intendedOrgSelect.selectOption({ label: place });
    const orgId = await intendedOrgSelect.inputValue();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    // Not just the optimistic form state — it survives a fresh read.
    await page.reload();
    await expect(page.getByLabel("Planning to book at")).toHaveValue(orgId);
  } finally {
    await deleteSlots([slotId]);
    await removePlace(page, place);
  }
});

test("a facility picked at creation is already the slot's intended org", async ({
  page,
}) => {
  const place = placeName();
  await addPlace(page, place);

  await page.goto("/booking-buddy/slots");
  await page.getByLabel("Date").fill("2031-10-10");
  await page.getByLabel("Start").selectOption("09:00");
  await selectDuration(page, "09:00", "10:00");
  await page.getByLabel("Facility").selectOption({ label: place });
  await page.getByRole("button", { name: "Post slot" }).click();

  await row(page, "Oct 10, 2031").getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  const slotId = page.url().split("/").pop()!;

  try {
    // No separate "Planning to book at" save needed — creation already set it.
    await expect(
      page.getByLabel("Planning to book at").locator("option:checked"),
    ).toHaveText(place);
  } finally {
    await deleteSlots([slotId]);
    await removePlace(page, place);
  }
});

test("tapping a response shows an optimistic update before the server confirms it", async ({
  page,
}) => {
  const slotId = await createSlot(page, {
    date: "2031-05-05",
    start: "15:00",
    end: "16:00",
    label: "May 5, 2031",
  });

  try {
    // Delay only the mutation's own round trip — registered after the initial
    // navigation so the page itself loads at full speed.
    let releaseResponse: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route(`**/booking-buddy/slots/${slotId}`, async (route) => {
      if (route.request().method() === "POST") {
        await held;
      }
      await route.continue();
    });

    const yesButton = page
      .getByRole("group", { name: "Your response" })
      .getByRole("button", { name: "Yes" });

    await yesButton.click();

    // Optimistic: highlighted immediately, while the POST above is still held.
    await expect(page.getByRole("button", { name: "Yes", pressed: true })).toBeVisible();

    releaseResponse!();

    // Still correct once the real response lands.
    await expect(page.getByRole("button", { name: "Yes", pressed: true })).toBeVisible();
  } finally {
    await deleteSlots([slotId]);
  }
});

test("a mixed-division slot with a real capacity breaks the signal down by gender — over on one side, under on the other", async ({
  page,
  browser,
}) => {
  const groupName = await grantBen2SlotsVisibility(page);
  const place = placeName();
  await addPlace(page, place);
  await setGender(page, "Male");

  // A singles court is capacity 2 — a mixed Slot splits that 1 male / 1
  // female, small enough that two male "yes"es push the male side over
  // while the female side stays untouched (the exact shape issue #80 asks
  // for: "3/2 male, 1/2 female", not a misleading flat "2/2, full").
  await logBooking(page, {
    place,
    court: "9",
    date: "2031-10-10",
    start: "09:00",
    end: "10:00",
    format: "Singles",
  });
  await expect(row(page, "Court 9")).toBeVisible();

  const slotId = await createSlot(page, {
    date: "2031-10-10",
    start: "09:00",
    end: "10:00",
    label: "Oct 10, 2031",
    division: "mixed",
  });

  try {
    const picker = page.getByLabel("Add a court");
    const value = await picker.locator("option", { hasText: "Court 9" }).getAttribute("value");
    await picker.selectOption(value!);
    await page.getByRole("button", { name: "Attach booking" }).click();

    // exact: true throughout — "Female: ..." contains "male: ..." as a
    // case-insensitive substring, the same collision settings.spec.ts's
    // gender radios hit (issue #79).
    await expect(page.getByText("Male: 0 of 1 spots taken", { exact: true })).toBeVisible();
    await expect(page.getByText("Female: 0 of 1 spots taken", { exact: true })).toBeVisible();

    await page
      .getByRole("group", { name: "Your response" })
      .getByRole("button", { name: "Yes" })
      .click();
    await expect(page.getByText("Male: 1 of 1 spots taken", { exact: true })).toBeVisible();

    const ben2Context = await browser.newContext();
    const ben2 = await ben2Context.newPage();
    try {
      await signIn(ben2, BEN2, "/booking-buddy/slots");
      await setGender(ben2, "Male");

      await ben2.goto(`/booking-buddy/slots/${slotId}`);
      await ben2
        .getByRole("group", { name: "Your response" })
        .getByRole("button", { name: "Yes" })
        .click();
      await expect(
        ben2.getByRole("button", { name: "Yes", pressed: true }),
      ).toBeVisible();

      // Two male yeses against a one-spot male bucket: over on that side.
      // Female's own bucket is untouched — still 0 of 1, not folded into one
      // misleadingly-full flat number. Asserted before resetting Ben2's
      // gender below, which would otherwise erase the very thing under test —
      // the breakdown reads each responder's *current* Gender at fetch time.
      await page.reload();
      await expect(page.getByText("Male: 2 of 1 spots taken", { exact: true })).toBeVisible();
      await expect(page.getByText("Female: 0 of 1 spots taken", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "More yeses than spots for Male" }),
      ).toBeVisible();

      await resetGender(ben2);
    } finally {
      await ben2Context.close();
    }
  } finally {
    await resetGender(page);
    await deleteSlots([slotId]);
    await removePlace(page, place);
    await revokeBen2SlotsVisibility(page, groupName);
  }
});
