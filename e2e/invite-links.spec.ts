import { expect, test, type Page } from "@playwright/test";

import { signIn, TEST_PASSWORD } from "./support/sign-in.ts";
import { clearAllConnectionsFor } from "./support/connection-request-link.ts";

/**
 * Personal invite link (issue #175): a cold-start User with no friends on
 * Booking Buddy shares their `/booking-buddy/join/<token>` link; the friend
 * opens it, signs up, and lands as a pending request the inviter accepts.
 *
 * The inviter is `amyace2` — an account `friends.spec.ts` already treats as
 * "starts unconnected, every test changes that" — and the invitee is either a
 * fresh throwaway signup or `benbackhand2`, so no seeded friendship is
 * disturbed. `resetInviter` clears every connection `amyace2` is on, straight
 * at Postgres — which covers the other side too, whoever it was, without
 * touching that account's own seeded friendships.
 */

const INVITER = "amyace2@example.com";
const INVITER_HANDLE = "amyace2";

function section(page: Page, heading: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: heading }) })
    .last();
}

async function resetInviter() {
  await clearAllConnectionsFor(INVITER_HANDLE);
}

async function readInviteUrl(page: Page): Promise<string> {
  await page.goto("/booking-buddy/friends");
  return page.getByLabel("Your invite link").inputValue();
}

test("a fresh signup through an invite link becomes a pending request the inviter accepts", async ({
  browser,
}) => {
  const inviterContext = await browser.newContext();
  const inviter = await inviterContext.newPage();
  await signIn(inviter, INVITER, "/booking-buddy/friends");
  await resetInviter();

  const url = await readInviteUrl(inviter);
  expect(url).toContain("/booking-buddy/join/");

  const newbieContext = await browser.newContext();
  const newbie = await newbieContext.newPage();
  const email = `invite${Date.now()}@example.com`;
  const newbieHandle = email.split("@")[0];

  try {
    // The invitee, with no account, opens the link and is walked into signup.
    await newbie.goto(url);
    await expect(
      newbie.getByRole("heading", { name: /invited you to Booking Buddy/ }),
    ).toBeVisible();

    await newbie
      .getByRole("button", { name: "Sign in or create an account" })
      .click();
    await newbie.waitForURL(/\/booking-buddy\/sign-in/);

    await newbie
      .getByRole("button", { name: "Create an account with a password" })
      .click();
    await newbie.getByLabel("Email").fill(email);
    await newbie.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await newbie.getByRole("button", { name: "Create account" }).click();
    await newbie.waitForURL((u) => !u.pathname.includes("/sign-in"));

    // The inviter sees an incoming request from the new account and accepts
    // it. The account has no display name, so its Username is what shows —
    // with nothing better, `PersonName` renders it as the primary label (no
    // "@" prefix).
    await inviter.goto("/booking-buddy/friends");
    const requests = section(inviter, "Requests for you");
    await expect(requests).toContainText(newbieHandle);
    await requests
      .getByRole("listitem")
      .filter({ hasText: newbieHandle })
      .getByRole("button", { name: "Accept" })
      .click();
    await expect(section(inviter, "Requests for you")).toHaveCount(0);

    // Both sides now hold the friendship.
    await newbie.goto("/booking-buddy/friends");
    await expect(section(newbie, "Your friends")).toContainText(
      `@${INVITER_HANDLE}`,
    );

    // Opening the link again once connected is a friendly no-op, not a dupe.
    await newbie.goto(url);
    await expect(newbie.getByText(/already connected/i)).toBeVisible();
    // No second pending request appeared — "Requests you've sent" is a
    // section that renders only when non-empty.
    await newbie.goto("/booking-buddy/friends");
    await expect(section(newbie, "Requests you've sent")).toHaveCount(0);

    // The owner opening their own link just sees it's theirs.
    await inviter.goto(url);
    await expect(inviter.getByText(/your own invite link/i)).toBeVisible();
  } finally {
    await resetInviter();
    await inviterContext.close();
    await newbieContext.close();
  }
});

test("a signed-in User who isn't connected can send the request straight from the link", async ({
  browser,
}) => {
  const inviterContext = await browser.newContext();
  const inviter = await inviterContext.newPage();
  await signIn(inviter, INVITER, "/booking-buddy/friends");
  // Clears amyace2 <-> benbackhand2 too (amyace2 is on it), without touching
  // benbackhand2's own seeded amyace friendship — so `other` needs no reset.
  await resetInviter();
  const url = await readInviteUrl(inviter);

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signIn(other, "benbackhand2@example.com", "/booking-buddy/friends");

  try {
    await other.goto(url);
    await other
      .getByRole("button", { name: /Send .* a friend request/ })
      .click();
    // The action revalidates and the join page re-renders into its
    // already-in-flight state.
    await expect(other.getByText(/friend request to .* is still pending/i)).toBeVisible();

    await inviter.goto("/booking-buddy/friends");
    await expect(section(inviter, "Requests for you")).toContainText(
      "@benbackhand2",
    );
  } finally {
    await resetInviter();
    await inviterContext.close();
    await otherContext.close();
  }
});

test("resetting the link mints a new URL and kills the old one", async ({
  page,
}) => {
  await signIn(page, "benbackhand@example.com", "/booking-buddy/friends");

  const before = await page.getByLabel("Your invite link").inputValue();
  expect(before).toContain("/booking-buddy/join/");

  await page.getByRole("button", { name: "Reset link" }).click();
  await page
    .getByRole("button", { name: /Reset \(the old link stops working\)/ })
    .click();

  await expect
    .poll(() => page.getByLabel("Your invite link").inputValue())
    .not.toBe(before);

  const after = await page.getByLabel("Your invite link").inputValue();

  // A fresh, unauthenticated context: the old link no longer resolves to an
  // invite, the new one does.
  const guest = await page.context().browser()!.newContext();
  const guestPage = await guest.newPage();
  try {
    await guestPage.goto(before);
    await expect(
      guestPage.getByRole("heading", { name: "This invite isn't valid" }),
    ).toBeVisible();

    await guestPage.goto(after);
    await expect(
      guestPage.getByRole("heading", { name: /invited you to Booking Buddy/ }),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
});

test("an unknown invite link reads as invalid, not a generic 404", async ({
  page,
}) => {
  await page.goto("/booking-buddy/join/ThisTokenDoesNotExist99");
  await expect(
    page.getByRole("heading", { name: "This invite isn't valid" }),
  ).toBeVisible();
});
