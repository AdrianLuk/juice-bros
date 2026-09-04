import { type Page } from "@playwright/test";

import { expect, test, type Accounts } from "./support/accounts.ts";
import { signIn } from "./support/sign-in.ts";
import { clearConnectionBetween } from "./support/connection-request-link.ts";
import { resetDefaultFriendVisibility } from "./support/db-reset.ts";

/**
 * The two-sided half of Connections: a request only means anything once the
 * other person answers it, and only they can.
 *
 * Two browser contexts rather than two tests, because the point is that the
 * two Users see different things about the same row at the same moment. One
 * context signing in as the other would replace the session, not add one.
 *
 * This worker's `accounts.amy`/`accounts.ben` are seeded friends; its
 * `accounts.amy2`/`accounts.ben2` are seeded strangers, and every test in the
 * first describe changes that and resets it.
 */

function section(page: Page, heading: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: heading }) })
    .last();
}

function personRow(page: Page, handle: string) {
  return page.getByRole("listitem").filter({ hasText: `@${handle}` });
}

function searchRow(page: Page, handle: string) {
  return section(page, "Find a friend")
    .getByRole("listitem")
    .filter({ hasText: `@${handle}` });
}

async function search(page: Page, handle: string) {
  await page.getByLabel("Search for someone").fill(handle);
  await expect(searchRow(page, handle)).toBeVisible();
}

/**
 * Puts the pair back to strangers, whichever state they ended in — straight at
 * Postgres, not by clicking through the friends page.
 *
 * These two accounts start unconnected and every test here changes that, so
 * without a reset the second test finds a friendship the first left. The old
 * click-through version raced `friends/loading.tsx`'s stream — `count()`
 * doesn't retry — and left the pair half-connected often enough to be the
 * suite's flakiest spot.
 */
async function disconnect(accounts: Accounts) {
  await clearConnectionBetween(accounts.amy2.username, accounts.ben2.username);
}

test.describe("two Users, one Connection", () => {
  test("a request is sent, seen by the other side, and accepted by them", async ({
    browser,
    accounts,
  }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, accounts.amy2.email, "/booking-buddy/friends");
    await signIn(ben, accounts.ben2.email, "/booking-buddy/friends");
    await disconnect(accounts);

    // Amy finds Ben by his handle and asks.
    await search(amy, accounts.ben2.username);
    await searchRow(amy, accounts.ben2.username)
      .getByRole("button", { name: "Add friend" })
      .click();
    await expect(searchRow(amy, accounts.ben2.username)).toContainText("Request sent");

    // Ben sees it as his to answer, with her name on it — not an anonymous row.
    await ben.reload();
    const requestForBen = section(ben, "Requests for you");
    await expect(requestForBen).toContainText(`@${accounts.amy2.username}`);

    // Amy sees the same row as hers to wait on, and cannot accept it herself.
    await amy.goto("/booking-buddy/friends");
    const sentByAmy = section(amy, "Requests you've sent");
    await expect(sentByAmy).toContainText(`@${accounts.ben2.username}`);
    await expect(sentByAmy.getByRole("button", { name: "Accept" })).toHaveCount(0);

    await requestForBen.getByRole("button", { name: "Accept" }).click();
    // The section disappears once the request is no longer pending. Waiting on
    // that rather than navigating straight away — the Server Action revalidates
    // the page, and a goto fired mid-flight reads the state from before it.
    await expect(section(ben, "Requests for you")).toHaveCount(0);

    // Both sides now hold the same friendship.
    for (const [page, handle] of [
      [ben, accounts.amy2.username],
      [amy, accounts.ben2.username],
    ] as const) {
      await page.goto("/booking-buddy/friends");
      const friends = section(page, "Your friends");
      await expect(friends).toContainText(`@${handle}`);
    }

    await disconnect(accounts);
    await amyContext.close();
    await benContext.close();
  });

  test("a request can be declined, and the pair are strangers again", async ({
    browser,
    accounts,
  }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, accounts.amy2.email, "/booking-buddy/friends");
    await signIn(ben, accounts.ben2.email, "/booking-buddy/friends");
    await disconnect(accounts);

    await search(amy, accounts.ben2.username);
    await searchRow(amy, accounts.ben2.username)
      .getByRole("button", { name: "Add friend" })
      .click();
    await expect(searchRow(amy, accounts.ben2.username)).toContainText("Request sent");

    await ben.reload();
    // Declining is deliberately not behind a confirmation: it is re-sendable.
    await section(ben, "Requests for you")
      .getByRole("listitem")
      .filter({ hasText: `@${accounts.amy2.username}` })
      .getByRole("button", { name: "Decline" })
      .click();

    await expect(section(ben, "Requests for you")).toHaveCount(0);

    // And Amy can ask again — declining removes the row rather than blocking.
    await amy.goto("/booking-buddy/friends");
    await search(amy, accounts.ben2.username);
    await expect(
      searchRow(amy, accounts.ben2.username).getByRole("button", { name: "Add friend" }),
    ).toBeVisible();

    await amyContext.close();
    await benContext.close();
  });

  test("removing a friend needs the confirmation dialog", async ({ browser, accounts }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, accounts.amy2.email, "/booking-buddy/friends");
    await signIn(ben, accounts.ben2.email, "/booking-buddy/friends");
    await disconnect(accounts);

    await search(amy, accounts.ben2.username);
    await searchRow(amy, accounts.ben2.username)
      .getByRole("button", { name: "Add friend" })
      .click();
    // Wait for the request to actually land before Ben looks for it —
    // otherwise his reload races Amy's Server Action and finds no row to
    // accept (tests above already wait on this; this one didn't).
    await expect(searchRow(amy, accounts.ben2.username)).toContainText("Request sent");

    await ben.reload();
    await section(ben, "Requests for you")
      .getByRole("button", { name: "Accept" })
      .click();
    await expect(section(ben, "Requests for you")).toHaveCount(0);

    await amy.goto("/booking-buddy/friends");
    const friends = section(amy, "Your friends");

    // Opening the dialog and backing out must leave the Connection alone —
    // the row's button opens it, the dialog's button is what destroys.
    await friends.getByRole("button", { name: "Remove" }).first().click();
    await amy.getByRole("button", { name: "Keep friend" }).click();
    await expect(personRow(amy, accounts.ben2.username)).toBeVisible();

    await friends.getByRole("button", { name: "Remove" }).first().click();
    await amy.getByRole("button", { name: "Remove", exact: true }).last().click();

    await amy.goto("/booking-buddy/friends");
    await expect(
      section(amy, "Your friends").getByRole("listitem").filter({
        hasText: `@${accounts.ben2.username}`,
      }),
    ).toHaveCount(0);

    await amyContext.close();
    await benContext.close();
  });
});

test.describe("the default-visibility control", () => {
  test.afterEach(async ({ accounts }) => {
    const amy2 = { email: accounts.amy2.email, password: accounts.password };
    await resetDefaultFriendVisibility(amy2);
    await disconnect(accounts);
  });

  test("lowering the default drops a friend still on it; raising it restores them", async ({
    browser,
    accounts,
  }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, accounts.amy2.email, "/booking-buddy/friends");
    await signIn(ben, accounts.ben2.email, "/booking-buddy/friends");
    await disconnect(accounts);

    await search(amy, accounts.ben2.username);
    await searchRow(amy, accounts.ben2.username)
      .getByRole("button", { name: "Add friend" })
      .click();
    await expect(searchRow(amy, accounts.ben2.username)).toContainText("Request sent");

    await ben.reload();
    await section(ben, "Requests for you").getByRole("button", { name: "Accept" }).click();
    await expect(section(ben, "Requests for you")).toHaveCount(0);

    await amy.goto("/booking-buddy/friends");
    const defaults = section(amy, "What friends see by default");

    // The `calendar` default (ADR 0021) already grants everything on connect —
    // no group or override needed.
    await expect(personRow(amy, accounts.ben2.username)).toContainText(
      "Sees: Games and my availability",
    );

    // Turning the default down drops Ben immediately: he has no override and
    // is in no group to raise him back up.
    await defaults.getByLabel("Every friend starts at").selectOption("none");
    await defaults.getByRole("button", { name: "Save" }).click();
    await expect(personRow(amy, accounts.ben2.username)).toContainText("Sees: Nothing");

    // Turning it back up restores him.
    await defaults.getByLabel("Every friend starts at").selectOption("calendar");
    await defaults.getByRole("button", { name: "Save" }).click();
    await expect(personRow(amy, accounts.ben2.username)).toContainText(
      "Sees: Games and my availability",
    );

    await amyContext.close();
    await benContext.close();
  });
});

test.describe("the friends Amy already has", () => {
  test("an existing friendship shows on both sides", async ({ browser, accounts }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, accounts.amy.email, "/booking-buddy/friends");
    await signIn(ben, accounts.ben.email, "/booking-buddy/friends");

    await expect(personRow(amy, accounts.ben.username).first()).toBeVisible();
    await expect(personRow(ben, accounts.amy.username).first()).toBeVisible();

    await amyContext.close();
    await benContext.close();
  });
});
