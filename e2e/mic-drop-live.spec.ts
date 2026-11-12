import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { deleteHost, seedPoll, type SeededPoll } from "./support/mic-drop.ts";

/**
 * Mic Drop: the Leaderboard updates live (issue #670).
 *
 *   - the Host and a Guest side by side: the Guest votes and the Host's
 *     line-up counts move with no reload; the Guest switches and both counts
 *     move; the Guest reloads and keeps their pick;
 *   - a Contestant the Host adds shows up on the open Guest screen;
 *   - a dropped connection says "Reconnecting…" until it recovers;
 *   - the night's end (issue #671): the Host removes Contestants, with a
 *     warning when they have Votes, and the Guest whose pick went is told;
 *     the Guest takes a Vote back; the Host closes the Poll, the Guest sees
 *     it closed and can't vote; the Host reopens it and Votes count again.
 *
 * The Host and their Poll are seeded through the database's own functions
 * (e2e/support/mic-drop.ts). Names are PPA Tour pros.
 */

const LINE_UP = ["Anna Leigh Waters", "Ben Johns", "JW Johnson & Dylan Frazier"];
const PHONE = { viewport: { width: 390, height: 844 } };

/**
 * Under the 4-second fallback poll, so a live assertion can only pass on the
 * broadcast, never on polling alone.
 */
const LIVE = { timeout: 3_000 };

let poll: SeededPoll;

test.beforeAll(async () => {
  poll = await seedPoll("Dink Dine & Drink karaoke", LINE_UP);
});

test.afterAll(async () => {
  if (poll) await deleteHost(poll);
});

/**
 * Resolves once the page has joined the Poll's Realtime topic. Call before
 * the page opens: until it has joined, updates arrive only by polling.
 */
function joined(page: Page, seeded: SeededPoll = poll): Promise<unknown> {
  return page.waitForEvent("websocket").then((socket) =>
    socket.waitForEvent("framereceived", {
      predicate: (frame) => String(frame.payload).includes(`"realtime:mic-drop:${seeded.pollId}","phx_reply"`),
    }),
  );
}

/** The Host signs in with a password through Team Tally's form (Mic Drop's own is Google only), then opens the Poll. */
async function openAsHost(browser: Browser, seeded: SeededPoll = poll): Promise<Page> {
  const page = await (await browser.newContext(PHONE)).newPage();
  await page.goto("/tools/team-tally/sign-in");
  await expect(async () => {
    await page.getByRole("button", { name: "Sign in with a password" }).click();
    await expect(page.getByLabel("Password")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.getByLabel("Email").fill(seeded.hostEmail);
  await page.getByLabel("Password").fill(seeded.hostPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
  const live = joined(page, seeded);
  await page.goto(`/tools/mic-drop/polls/${seeded.pollId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await live;
  return page;
}

function hostCount(host: Page, name: string): Locator {
  return host.locator(".md-lineup li").filter({ hasText: name }).locator(".md-count");
}

function guestRow(guest: Page, name: string): Locator {
  return guest.getByRole("button", { name: new RegExp(`^${name},`) });
}

/** Taps until the row is this phone's Vote, in case the first tap beat hydration. */
async function voteFor(guest: Page, name: string) {
  const row = guestRow(guest, name);
  await expect(async () => {
    await row.click();
    await expect(row).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test("a Guest's Vote moves the Host's counts live, and a reload keeps the pick", async ({ browser }) => {
  const host = await openAsHost(browser);
  const guest = await (await browser.newContext(PHONE)).newPage();
  const guestLive = joined(guest);
  await guest.goto(`/tools/mic-drop/vote/${poll.guestToken}`);
  await expect(guest.getByText("Live chart")).toBeVisible();
  await guestLive;

  await expect(host.getByText("0 phones in")).toBeVisible();
  await expect(hostCount(host, "Anna Leigh Waters")).toHaveText("0");

  await voteFor(guest, "Anna Leigh Waters");
  await expect(hostCount(host, "Anna Leigh Waters")).toHaveText("1", LIVE);
  await expect(host.getByText("1 phone in")).toBeVisible();

  // Switching moves the Vote: the old count drops as the new one rises.
  await voteFor(guest, "Ben Johns");
  await expect(hostCount(host, "Ben Johns")).toHaveText("1", LIVE);
  await expect(hostCount(host, "Anna Leigh Waters")).toHaveText("0", LIVE);
  await expect(host.getByText("1 phone in")).toBeVisible();

  const rejoined = joined(guest);
  await guest.reload();
  await expect(guestRow(guest, "Ben Johns")).toHaveAttribute("aria-pressed", "true");
  await expect(guest.getByText("Your vote: Ben Johns.")).toBeVisible();
  await rejoined;

  // A Contestant added on the spot shows up on the open Guest screen.
  await host.getByLabel("Add a Contestant").fill("Tyson McGuffin");
  await host.getByRole("button", { name: "Add", exact: true }).click();
  await expect(guestRow(guest, "Tyson McGuffin")).toBeVisible(LIVE);
});

test("a dropped connection says Reconnecting until it recovers", async ({ browser }) => {
  const guest = await (await browser.newContext(PHONE)).newPage();
  let dropped = false;
  const sockets: { close: () => Promise<void> }[] = [];
  // Supabase Realtime's socket, held shut while "dropped", as when the signal goes.
  await guest.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
    if (dropped) return void socket.close();
    socket.connectToServer();
    sockets.push(socket);
  });

  await guest.goto(`/tools/mic-drop/vote/${poll.guestToken}`);
  await expect(guest.getByText("Live chart")).toBeVisible();
  await expect(guest.getByText("Reconnecting…")).toHaveCount(0);

  dropped = true;
  await Promise.all(sockets.map((socket) => socket.close()));
  await expect(guest.getByText("Reconnecting…")).toBeVisible();
  await expect(guest.getByText("Live chart")).toHaveCount(0);

  dropped = false;
  await expect(guest.getByText("Live chart")).toBeVisible({ timeout: 30_000 });
  await expect(guest.getByText("Reconnecting…")).toHaveCount(0);
});

test("the Host removes, closes and reopens while the Guest watches, and a Vote can be taken back", async ({ browser }) => {
  const night = await seedPoll("Last call karaoke", ["Anna Leigh Waters", "Ben Johns", "Tyson McGuffin"]);
  try {
    const host = await openAsHost(browser, night);
    const guest = await (await browser.newContext(PHONE)).newPage();
    const guestLive = joined(guest, night);
    await guest.goto(`/tools/mic-drop/vote/${night.guestToken}`);
    await guestLive;

    // Removing a Contestant with a Vote warns first, and the Guest whose pick it was is told.
    await voteFor(guest, "Tyson McGuffin");
    await expect(hostCount(host, "Tyson McGuffin")).toHaveText("1", LIVE);
    await host.getByRole("button", { name: "Remove Tyson McGuffin" }).click();
    const warning = host.getByRole("group", { name: "Remove Tyson McGuffin?" });
    await expect(warning).toContainText("Their 1 vote goes too");
    await warning.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(guestRow(guest, "Tyson McGuffin")).toHaveCount(0, LIVE);
    await expect(guest.getByText("Your pick was taken off the line-up")).toBeVisible();

    // One with no Votes goes at once.
    await host.getByRole("button", { name: "Remove Ben Johns" }).click();
    await expect(guestRow(guest, "Ben Johns")).toHaveCount(0, LIVE);

    // Tapping your own pick again takes it back.
    await voteFor(guest, "Anna Leigh Waters");
    await expect(hostCount(host, "Anna Leigh Waters")).toHaveText("1", LIVE);
    await guestRow(guest, "Anna Leigh Waters").click();
    await expect(guestRow(guest, "Anna Leigh Waters")).toHaveAttribute("aria-pressed", "false");
    await expect(hostCount(host, "Anna Leigh Waters")).toHaveText("0", LIVE);
    await expect(host.getByText("0 phones in")).toBeVisible();
    await voteFor(guest, "Anna Leigh Waters");

    // Closing asks first, then freezes the chart on every phone.
    await host.getByRole("button", { name: "Close the Poll" }).click();
    const confirm = host.getByRole("group", { name: "Close the Poll?" });
    await confirm.getByRole("button", { name: "Close the Poll" }).click();
    await expect(host.getByText("No. 1: Anna Leigh Waters, with 1 vote.")).toBeVisible();
    await expect(guest.getByText("Final chart")).toBeVisible(LIVE);
    await expect(guest.getByRole("region", { name: "Winner" })).toContainText("Anna Leigh Waters");
    // A closed row is aria-disabled, which Playwright won't click; a thumb still taps it.
    await guestRow(guest, "Anna Leigh Waters").click({ force: true });
    await expect(guest.getByText("Voting's closed, so that tap didn't count.")).toBeVisible();
    await expect(guestRow(guest, "Anna Leigh Waters")).toHaveAttribute("aria-pressed", "true");

    // Reopening takes Votes again.
    await host.getByRole("button", { name: "Reopen the Poll" }).click();
    await expect(guest.getByText("Live chart")).toBeVisible(LIVE);
    await guestRow(guest, "Anna Leigh Waters").click();
    await expect(hostCount(host, "Anna Leigh Waters")).toHaveText("0", LIVE);
  } finally {
    await deleteHost(night);
  }
});
