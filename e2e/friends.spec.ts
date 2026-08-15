import { expect, test, type Page } from "@playwright/test";

import { AMY, BEN, signIn } from "./support/sign-in.ts";

/**
 * The two-sided half of Connections: a request only means anything once the
 * other person answers it, and only they can.
 *
 * Two browser contexts rather than two tests, because the point is that the
 * two Users see different things about the same row at the same moment. One
 * context signing in as the other would replace the session, not add one.
 */

/** Amy and Ben are already friends in the seeded data; these two are not. */
const AMY_2 = "amyace2@example.com";
const BEN_2 = "benbackhand2@example.com";

const AMY_2_HANDLE = "amyace2";
const BEN_2_HANDLE = "benbackhand2";

/**
 * One of the friends page's sections, by its heading.
 *
 * Scoped rather than page-wide because the same person appears in up to three
 * of them at once — a search result, a pending request and a friend all carry
 * the same handle, and an unscoped locator matches whichever it finds. `.last()`
 * picks the innermost match, since the page's own wrapper <section> contains
 * every heading too.
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
 * Puts the pair back to strangers, whichever state they ended in.
 *
 * These two accounts start unconnected, and every test here changes that, so
 * without a reset the second test would find a friendship the first left.
 */
async function disconnect(page: Page) {
  await page.goto("/booking-buddy/friends");

  const row = personRow(page, BEN_2_HANDLE).or(personRow(page, AMY_2_HANDLE));
  const buttons = row.getByRole("button", { name: /^(Remove|Cancel|Decline)$/ });

  while ((await buttons.count()) > 0) {
    const label = await buttons.first().textContent();
    await buttons.first().click();
    // Only unfriending is behind a dialog; declining and cancelling are not.
    if (label?.trim() === "Remove") {
      await page.getByRole("button", { name: "Remove", exact: true }).last().click();
    }
    await page.waitForTimeout(250);
    await page.goto("/booking-buddy/friends");
  }
}

test.describe("two Users, one Connection", () => {
  test("a request is sent, seen by the other side, and accepted by them", async ({
    browser,
  }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, AMY_2, "/booking-buddy/friends");
    await signIn(ben, BEN_2, "/booking-buddy/friends");
    await disconnect(amy);

    // Amy finds Ben by his handle and asks.
    await search(amy, BEN_2_HANDLE);
    await searchRow(amy, BEN_2_HANDLE)
      .getByRole("button", { name: "Add friend" })
      .click();
    await expect(searchRow(amy, BEN_2_HANDLE)).toContainText("Request sent");

    // Ben sees it as his to answer, with her name on it — not an anonymous row.
    await ben.reload();
    const requestForBen = section(ben, "Requests for you");
    await expect(requestForBen).toContainText(`@${AMY_2_HANDLE}`);

    // Amy sees the same row as hers to wait on, and cannot accept it herself.
    await amy.goto("/booking-buddy/friends");
    const sentByAmy = section(amy, "Requests you've sent");
    await expect(sentByAmy).toContainText(`@${BEN_2_HANDLE}`);
    await expect(sentByAmy.getByRole("button", { name: "Accept" })).toHaveCount(0);

    await requestForBen.getByRole("button", { name: "Accept" }).click();
    // The section disappears once the request is no longer pending. Waiting on
    // that rather than navigating straight away — the Server Action revalidates
    // the page, and a goto fired mid-flight reads the state from before it.
    await expect(section(ben, "Requests for you")).toHaveCount(0);

    // Both sides now hold the same friendship.
    for (const [page, handle] of [
      [ben, AMY_2_HANDLE],
      [amy, BEN_2_HANDLE],
    ] as const) {
      await page.goto("/booking-buddy/friends");
      const friends = section(page, "Your friends");
      await expect(friends).toContainText(`@${handle}`);
    }

    await disconnect(amy);
    await amyContext.close();
    await benContext.close();
  });

  test("a request can be declined, and the pair are strangers again", async ({
    browser,
  }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, AMY_2, "/booking-buddy/friends");
    await signIn(ben, BEN_2, "/booking-buddy/friends");
    await disconnect(amy);

    await search(amy, BEN_2_HANDLE);
    await searchRow(amy, BEN_2_HANDLE)
      .getByRole("button", { name: "Add friend" })
      .click();
    await expect(searchRow(amy, BEN_2_HANDLE)).toContainText("Request sent");

    await ben.reload();
    // Declining is deliberately not behind a confirmation: it is re-sendable.
    await section(ben, "Requests for you")
      .getByRole("listitem")
      .filter({ hasText: `@${AMY_2_HANDLE}` })
      .getByRole("button", { name: "Decline" })
      .click();

    await expect(section(ben, "Requests for you")).toHaveCount(0);

    // And Amy can ask again — declining removes the row rather than blocking.
    await amy.goto("/booking-buddy/friends");
    await search(amy, BEN_2_HANDLE);
    await expect(
      searchRow(amy, BEN_2_HANDLE).getByRole("button", { name: "Add friend" }),
    ).toBeVisible();

    await amyContext.close();
    await benContext.close();
  });

  test("removing a friend needs the confirmation dialog", async ({ browser }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, AMY_2, "/booking-buddy/friends");
    await signIn(ben, BEN_2, "/booking-buddy/friends");
    await disconnect(amy);

    await search(amy, BEN_2_HANDLE);
    await searchRow(amy, BEN_2_HANDLE)
      .getByRole("button", { name: "Add friend" })
      .click();
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
    await expect(personRow(amy, BEN_2_HANDLE)).toBeVisible();

    await friends.getByRole("button", { name: "Remove" }).first().click();
    await amy.getByRole("button", { name: "Remove", exact: true }).last().click();

    await amy.goto("/booking-buddy/friends");
    await expect(
      section(amy, "Your friends").getByRole("listitem").filter({
        hasText: `@${BEN_2_HANDLE}`,
      }),
    ).toHaveCount(0);

    await amyContext.close();
    await benContext.close();
  });
});

test.describe("the friends Amy already has", () => {
  test("an existing friendship shows on both sides", async ({ browser }) => {
    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, AMY, "/booking-buddy/friends");
    await signIn(ben, BEN, "/booking-buddy/friends");

    await expect(personRow(amy, "benbackhand").first()).toBeVisible();
    await expect(personRow(ben, "amyace").first()).toBeVisible();

    await amyContext.close();
    await benContext.close();
  });
});
