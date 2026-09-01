import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { deleteFriendGroups, deleteVisibilityOverrides } from "./support/db-reset.ts";

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
 *
 * The friend grouped here is this worker's `accounts.ben2` — seeded as a
 * friend of `accounts.amy`, since a group only holds people you're already
 * connected to.
 */

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

test.beforeEach(async ({ page, accounts }) => {
  await signIn(page, accounts.amy.email, "/booking-buddy/groups");
});

/**
 * Sweeps up anything a failed run left behind — straight at Postgres, since
 * under parallel load the click-through delete raced `revalidatePath` and left
 * groups (and the Visibility they grant) behind, poisoning the next test. Each
 * test still deletes its own group through the UI as part of what it asserts;
 * this is only the safety net.
 */
test.afterEach(async ({ accounts }) => {
  const amy = { email: accounts.amy.email, password: accounts.password };
  await deleteFriendGroups(amy, PREFIX);
  await deleteVisibilityOverrides(amy);
});

test("a group can be created, filled, and emptied again", async ({ page, accounts }) => {
  const name = groupName();

  await createGroup(page, name, "calendar");
  await expect(groupCard(page, name)).toContainText("0 friends");

  await addFriend(page, name, accounts.ben2.username);
  const filled = groupCard(page, name);
  await expect(filled).toContainText("1 friend");
  await expect(filled).toContainText(`@${accounts.ben2.username}`);

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
  accounts,
}) => {
  const name = groupName();

  await createGroup(page, name, "calendar");
  await addFriend(page, name, accounts.ben2.username);

  await page.goto("/booking-buddy/friends");

  // The group grants the most it can, so that is what the friend now sees.
  await expect(friendRow(page, accounts.ben2.username)).toContainText(
    "From your groups: Slots and my availability",
  );

  // Pinning them shut must win over the group.
  await friendRow(page, accounts.ben2.username).getByRole("combobox").selectOption("none");
  await friendRow(page, accounts.ben2.username).getByRole("button", { name: "Save" }).click();
  await expect(friendRow(page, accounts.ben2.username)).toContainText("Set just for them: Nothing");

  // Clearing the pin drops them back to what the group gives.
  await friendRow(page, accounts.ben2.username).getByRole("combobox").selectOption("clear");
  await friendRow(page, accounts.ben2.username).getByRole("button", { name: "Save" }).click();
  await expect(friendRow(page, accounts.ben2.username)).toContainText(
    "From your groups: Slots and my availability",
  );

  await page.goto("/booking-buddy/groups");
  await deleteGroup(page, name);
});

test("two groups resolve to the most permissive of them", async ({ page, accounts }) => {
  const open = groupName("-open");
  const shut = groupName("-shut");

  await createGroup(page, open, "calendar");
  await createGroup(page, shut, "none");
  await addFriend(page, open, accounts.ben2.username);
  await addFriend(page, shut, accounts.ben2.username);

  await page.goto("/booking-buddy/friends");

  // In one group showing everything and one showing nothing, the open one
  // wins — adding someone to a group can only ever expand what they see.
  await expect(friendRow(page, accounts.ben2.username)).toContainText(
    "From your groups: Slots and my availability",
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
