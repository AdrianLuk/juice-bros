import { expect, test, type Locator, type Page } from "@playwright/test";

import { AMY, signIn } from "./support/sign-in.ts";

/**
 * The Friend Group journey, clicked rather than asserted against the database.
 *
 * Every group this file makes is named with a unique suffix and deleted at the
 * end, so a failed run leaves at most one stray group rather than colliding
 * with the next one.
 *
 * Friends are always addressed by Username, never by display name: the local
 * data deliberately holds two "Ben Backhand"s (see
 * booking-buddy/docs/local-test-accounts.md), and a test that matched on the
 * name would silently assert against whichever one it happened to find.
 */
const FRIEND = "benbackhand2";

/** Every group these tests make starts with this, so strays are findable. */
const PREFIX = "Playwright";

const groupName = (suffix = "") =>
  `${PREFIX} ${Date.now()}${Math.random().toString(36).slice(2, 6)}${suffix}`;

/** The card for one group — `section` filtered by its heading. */
function groupCard(page: Page, name: string): Locator {
  return page.locator("section").filter({ hasText: name }).last();
}

/**
 * The "Your friends" row for one friend, found by their handle.
 *
 * Lives on the friends page, not the groups page — callers must navigate
 * there first. Scoped to that section on purpose: the same handle also
 * appears in the pending-request sections above it.
 */
function friendRow(page: Page, username: string): Locator {
  return (
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Your friends" }) })
      // The page's own wrapper <section> contains that heading too; the
      // innermost match is the one that starts last in document order.
      .last()
      .getByRole("listitem")
      .filter({ hasText: `@${username}` })
  );
}

async function createGroup(page: Page, name: string, level: string) {
  await page.getByLabel("Group name").fill(name);
  await page.getByLabel("What they can see").selectOption(level);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function addFriend(page: Page, name: string, username: string) {
  const card = groupCard(page, name);
  const picker = card.getByLabel("Add a friend");
  // By Connection id, read off the option carrying the handle — selectOption's
  // own label matcher takes no regex, and the display name is ambiguous.
  const value = await picker
    .locator("option", { hasText: `@${username})` })
    .getAttribute("value");
  await picker.selectOption(value!);
  await card.getByRole("button", { name: "Add" }).click();
}

async function deleteGroup(page: Page, name: string) {
  await groupCard(page, name).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete group" }).click();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy/groups");
});

/**
 * Sweeps up anything a failed run left behind.
 *
 * Without this, a test that dies mid-way leaves its group in the local
 * database for good — and they accumulate, one per broken run, until the page
 * is unusable. Each test still deletes its own group as part of what it
 * asserts; this is only the safety net.
 */
test.afterEach(async ({ page }) => {
  await page.goto("/booking-buddy/groups");

  const strays = page.getByRole("heading", { name: new RegExp(`^${PREFIX} `) });

  for (let left = await strays.count(); left > 0; left--) {
    const name = (await strays.first().textContent())!;
    await groupCard(page, name).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete group" }).click();
    await expect(page.getByRole("heading", { name })).toHaveCount(0);
  }
});

test("a group can be created, filled, and emptied again", async ({ page }) => {
  const name = groupName();

  await createGroup(page, name, "calendar");
  await expect(groupCard(page, name)).toContainText("0 friends");

  await addFriend(page, name, FRIEND);
  const filled = groupCard(page, name);
  await expect(filled).toContainText("1 friend");
  await expect(filled).toContainText(`@${FRIEND}`);

  // Confirm-before-remove, same shape as everywhere else in the app — but
  // unlike Delete/"Delete group", this trigger and its confirm button share
  // the exact same accessible name ("Remove"), so the confirm click has to
  // be scoped to the dialog itself (portal-rendered outside `filled`) rather
  // than disambiguated by text.
  await filled.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(groupCard(page, name)).toContainText("0 friends");

  await deleteGroup(page, name);
});

test("a per-friend override beats the group default, and clearing it restores", async ({
  page,
}) => {
  const name = groupName();

  await createGroup(page, name, "calendar");
  await addFriend(page, name, FRIEND);

  await page.goto("/booking-buddy/friends");

  // The group grants the most it can, so that is what the friend now sees.
  await expect(friendRow(page, FRIEND)).toContainText(
    "From your groups: Slots and my open time",
  );

  // Pinning them shut must win over the group.
  await friendRow(page, FRIEND).getByRole("combobox").selectOption("none");
  await friendRow(page, FRIEND).getByRole("button", { name: "Save" }).click();
  await expect(friendRow(page, FRIEND)).toContainText("Set just for them: Nothing");

  // Clearing the pin drops them back to what the group gives.
  await friendRow(page, FRIEND).getByRole("combobox").selectOption("clear");
  await friendRow(page, FRIEND).getByRole("button", { name: "Save" }).click();
  await expect(friendRow(page, FRIEND)).toContainText(
    "From your groups: Slots and my open time",
  );

  await page.goto("/booking-buddy/groups");
  await deleteGroup(page, name);
});

test("two groups resolve to the most permissive of them", async ({ page }) => {
  const open = groupName("-open");
  const shut = groupName("-shut");

  await createGroup(page, open, "calendar");
  await createGroup(page, shut, "none");
  await addFriend(page, open, FRIEND);
  await addFriend(page, shut, FRIEND);

  await page.goto("/booking-buddy/friends");

  // In one group showing everything and one showing nothing, the open one
  // wins — adding someone to a group can only ever expand what they see.
  await expect(friendRow(page, FRIEND)).toContainText(
    "From your groups: Slots and my open time",
  );

  await page.goto("/booking-buddy/groups");
  await deleteGroup(page, open);
  await deleteGroup(page, shut);
});

test("a group cannot be given a name you have already used", async ({ page }) => {
  const name = groupName();

  await createGroup(page, name, "slots");

  await page.getByLabel("Group name").fill(name.toUpperCase());
  await page.getByRole("button", { name: "Create group" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "already have a group" }),
  ).toBeVisible();

  await deleteGroup(page, name);
});
