import { type Page } from "@playwright/test";

import { expect, test, type Accounts } from "./support/accounts.ts";
import { signIn } from "./support/sign-in.ts";
import {
  clearConnectionBetween,
  connectionRequestToken,
} from "./support/connection-request-link.ts";

/**
 * The friend-request email's one-click Accept / Decline links (issue #228).
 *
 * The email itself isn't sent on the local stack (no RESEND_API_KEY), but the
 * link it would carry — `/connect/<token>` — is the whole feature, and it works
 * with no session at all. Each test sends a real request through the Friends
 * page, reads the `connection_request_links` token direct from Postgres (it's
 * service_role-only, same as `slot_links`), and drives the public page.
 *
 * `accounts.amy2` and `accounts.ben2` are this worker's seeded strangers.
 */

// These two aren't connected in the seed data, and every test here changes
// that — so each starts from a hard reset direct against Postgres rather than
// clicking the previous test's friendship apart through the UI.
test.beforeEach(async ({ accounts }) => {
  await clearConnectionBetween(accounts.amy2.username, accounts.ben2.username);
});

test.afterAll(async ({ accounts }) => {
  await clearConnectionBetween(accounts.amy2.username, accounts.ben2.username);
});

function section(page: Page, heading: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: heading }) })
    .last();
}

function personRow(page: Page, handle: string) {
  return page.getByRole("listitem").filter({ hasText: `@${handle}` });
}

async function amySendsBenARequest(amy: Page, accounts: Accounts): Promise<string> {
  await amy.goto("/booking-buddy/friends");
  await amy.getByLabel("Search for someone").fill(accounts.ben2.username);
  const searchRow = section(amy, "Find a friend")
    .getByRole("listitem")
    .filter({ hasText: `@${accounts.ben2.username}` });
  await expect(searchRow).toBeVisible();
  await searchRow.getByRole("button", { name: "Add friend" }).click();
  await expect(searchRow).toContainText("Request sent");

  return connectionRequestToken(accounts.amy2.username, accounts.ben2.username);
}

test.describe("friend-request email links", () => {
  test("Accept from the link connects both sides, and the link is single-use", async ({
    browser,
    accounts,
  }) => {
    const amyContext = await browser.newContext();
    const amy = await amyContext.newPage();
    await signIn(amy, accounts.amy2.email, "/booking-buddy/friends");

    const token = await amySendsBenARequest(amy, accounts);

    // Ben opens the link straight from his inbox — no session.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/connect/${token}`);

    await expect(
      guest.getByRole("heading", { name: /wants to connect/ }),
    ).toContainText(accounts.amy2.username);

    await guest.getByRole("button", { name: "Accept" }).click();
    await expect(guest.getByRole("heading", { name: "You're connected" })).toBeVisible();

    // Re-opening the same link is spent.
    await guest.goto(`/connect/${token}`);
    await expect(
      guest.getByRole("heading", { name: "This one's already sorted" }),
    ).toBeVisible();

    // The friendship is real on both sides.
    await amy.goto("/booking-buddy/friends");
    await expect(section(amy, "Your friends")).toContainText(`@${accounts.ben2.username}`);

    const benContext = await browser.newContext();
    const ben = await benContext.newPage();
    await signIn(ben, accounts.ben2.email, "/booking-buddy/friends");
    await expect(section(ben, "Your friends")).toContainText(`@${accounts.amy2.username}`);

    await amyContext.close();
    await benContext.close();
    await guestContext.close();
  });

  test("Decline from the link removes the request and the pair can try again", async ({
    browser,
    accounts,
  }) => {
    const amyContext = await browser.newContext();
    const amy = await amyContext.newPage();
    await signIn(amy, accounts.amy2.email, "/booking-buddy/friends");

    const token = await amySendsBenARequest(amy, accounts);

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/connect/${token}`);
    await guest.getByRole("button", { name: "Decline" }).click();
    await expect(guest.getByRole("heading", { name: "Request declined" })).toBeVisible();

    // The request is gone, and Amy can send a fresh one.
    await amy.goto("/booking-buddy/friends");
    await expect(personRow(amy, accounts.ben2.username)).toHaveCount(0);
    await amy.getByLabel("Search for someone").fill(accounts.ben2.username);
    await expect(
      section(amy, "Find a friend")
        .getByRole("listitem")
        .filter({ hasText: `@${accounts.ben2.username}` })
        .getByRole("button", { name: "Add friend" }),
    ).toBeVisible();

    await amyContext.close();
    await guestContext.close();
  });

  test("an unknown token shows a friendly dead end, not a crash", async ({ page }) => {
    await page.goto("/connect/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByRole("heading", { name: "This link isn't valid" }),
    ).toBeVisible();
  });
});
