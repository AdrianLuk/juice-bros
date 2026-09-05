import { type Page } from "@playwright/test";

import { expect, test, type Accounts } from "./support/accounts.ts";
import { signIn } from "./support/sign-in.ts";
import { clearConnectionBetween } from "./support/connection-request-link.ts";
import { deleteOrgs, resetDefaultFriendVisibility } from "./support/db-reset.ts";
import { addPlace, logBooking, placeName, removePlace } from "./support/places.ts";
import { deleteAvailabilityWindows, insertAvailabilityWindow } from "./support/availability.ts";

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

/**
 * Tomorrow, as a `YYYY-MM-DD` — always in the future, and (Saturday aside)
 * always still inside the current calendar week the friend calendar defaults
 * to. Mirrors `dashboard.spec.ts`'s own `requireTestBookingDate`, which isn't
 * exported from there.
 */
function requireTestBookingDate(): { iso: string } {
  const now = new Date();
  test.skip(now.getDay() === 6, "no future day is left in the current calendar week on a Saturday");

  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return {
    iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  };
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

test.describe("seeing each other's calendar after connecting", () => {
  // Safety net for a failed run's leftovers — same posture as
  // `dashboard.spec.ts`'s own `afterEach`. The test also sweeps its own
  // fixtures as part of what it asserts; this is only the backstop.
  test.afterEach(async ({ accounts }) => {
    const amy = { email: accounts.amy2.email, password: accounts.password };
    const ben = { email: accounts.ben2.email, password: accounts.password };
    await deleteOrgs(amy);
    await deleteOrgs(ben);
    await deleteAvailabilityWindows(amy);
    await deleteAvailabilityWindows(ben);
    await disconnect(accounts);
  });

  test("connecting with zero groups and zero overrides shows each other's game and Availability Window", async ({
    browser,
    accounts,
  }) => {
    const bookingDate = requireTestBookingDate();
    const amyUser = { email: accounts.amy2.email, password: accounts.password };
    const benUser = { email: accounts.ben2.email, password: accounts.password };

    const amyContext = await browser.newContext();
    const benContext = await browser.newContext();
    const amy = await amyContext.newPage();
    const ben = await benContext.newPage();

    await signIn(amy, accounts.amy2.email, "/booking-buddy/friends");
    await signIn(ben, accounts.ben2.email, "/booking-buddy/friends");
    await disconnect(accounts);
    await deleteAvailabilityWindows(amyUser);
    await deleteAvailabilityWindows(benUser);

    // Each seeds their own game and Availability Window while still
    // strangers — the point of this test is that accepting the Connection is
    // what opens them, with no Friend Group and no override on either side.
    const amyPlace = placeName("-amy");
    const benPlace = placeName("-ben");
    await addPlace(amy, amyPlace);
    await addPlace(ben, benPlace);
    await insertAvailabilityWindow(amyUser, {
      type: "looking",
      startsAt: `${bookingDate.iso}T22:00:00Z`,
      endsAt: `${bookingDate.iso}T23:00:00Z`,
    });
    await insertAvailabilityWindow(benUser, {
      type: "looking",
      startsAt: `${bookingDate.iso}T22:00:00Z`,
      endsAt: `${bookingDate.iso}T23:00:00Z`,
    });
    await logBooking(amy, {
      place: amyPlace,
      court: "12",
      date: bookingDate.iso,
      start: "08:00",
      end: "09:00",
    });
    // Wait for the logged row before moving on — the Server Action's round
    // trip would otherwise race the next navigation (same reasoning as
    // `dashboard.spec.ts`'s own booking tests). Filtered on the (unique,
    // random-suffixed) place name too — "Court 12" alone can collide with a
    // stray row a previous failed run left behind on this reused account.
    await amy
      .getByRole("listitem")
      .filter({ hasText: amyPlace })
      .filter({ hasText: "Court 12" })
      .waitFor();
    await logBooking(ben, {
      place: benPlace,
      court: "12",
      date: bookingDate.iso,
      start: "08:00",
      end: "09:00",
    });
    await ben
      .getByRole("listitem")
      .filter({ hasText: benPlace })
      .filter({ hasText: "Court 12" })
      .waitFor();

    // Amy asks, Ben accepts — no Friend Group, no override, either side.
    await amy.goto("/booking-buddy/friends");
    await search(amy, accounts.ben2.username);
    await searchRow(amy, accounts.ben2.username)
      .getByRole("button", { name: "Add friend" })
      .click();
    await expect(searchRow(amy, accounts.ben2.username)).toContainText("Request sent");

    // `goto`, not `reload` — Ben's last navigation was `logBooking`'s own
    // Bookings page, and the other tests' `.reload()` only works because
    // they never leave the Friends page in between.
    await ben.goto("/booking-buddy/friends");
    await section(ben, "Requests for you").getByRole("button", { name: "Accept" }).click();
    await expect(section(ben, "Requests for you")).toHaveCount(0);

    // The `calendar` default (ADR 0021) already grants everything, so each
    // can open the other's calendar with nothing else set up.
    await amy.goto("/booking-buddy/friends");
    await personRow(amy, accounts.ben2.username)
      .getByRole("button", { name: "View calendar" })
      .click();
    const bensCalendar = amy.getByRole("dialog");
    await expect(bensCalendar.getByRole("button", { name: benPlace, exact: false })).toBeVisible();
    await expect(bensCalendar.locator('[title^="Looking to play"]')).toHaveCount(1);

    await ben.goto("/booking-buddy/friends");
    await personRow(ben, accounts.amy2.username)
      .getByRole("button", { name: "View calendar" })
      .click();
    const amysCalendar = ben.getByRole("dialog");
    await expect(amysCalendar.getByRole("button", { name: amyPlace, exact: false })).toBeVisible();
    await expect(amysCalendar.locator('[title^="Looking to play"]')).toHaveCount(1);

    await removePlace(amy, amyPlace);
    await removePlace(ben, benPlace);
    await deleteAvailabilityWindows(amyUser);
    await deleteAvailabilityWindows(benUser);
    await disconnect(accounts);
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
