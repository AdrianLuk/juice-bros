import { expect, test } from "@playwright/test";

import { deleteTeamEventOrganizer, seedTeamEvent, type SeededTeamEvent } from "./support/team-tally.ts";

/**
 * Team Tally: a board that stops updating says so (issue #661).
 *
 * The venue TV keeps its last good read when reads fail. Past 30 seconds of
 * failures it says "Reconnecting…" and drops the LIVE mark, since ball yellow
 * means "now" and a stale board can't vouch for now; the next good read
 * clears it. Reads are blocked the way venue wifi with no internet blocks
 * them (the browser still thinks it's online), and the 30 seconds are run on
 * Playwright's clock rather than waited out.
 */

let night: SeededTeamEvent;

test.beforeAll(async () => {
  night = await seedTeamEvent();
});

test.afterAll(async () => {
  if (night) await deleteTeamEventOrganizer(night);
});

test("the TV says Reconnecting and drops LIVE when reads keep failing, and recovers", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const tv = await context.newPage();
  await tv.clock.install();
  await tv.goto(`/tools/team-tally/live/${night.publicToken}`);

  const stage = tv.locator(".tt-tv-stage");
  await expect(stage).toContainText("Round 1");
  await expect(stage).not.toContainText("Reconnecting");

  // The Public Link only reads, so every Server Action POST is a read.
  let blocked = true;
  await tv.route("**/tools/team-tally/live/**", (route) =>
    blocked && route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback(),
  );

  // A blip under 30 seconds stays quiet.
  await tv.clock.runFor(20_000);
  await expect(stage).toContainText("Round 1");

  await expect(async () => {
    await tv.clock.runFor(5_000);
    await expect(stage).toContainText("Reconnecting", { timeout: 500 });
  }).toPass({ timeout: 20_000 });
  await expect(stage).not.toContainText("Round 1");

  blocked = false;
  await expect(async () => {
    await tv.clock.runFor(5_000);
    await expect(stage).toContainText("Round 1", { timeout: 500 });
  }).toPass({ timeout: 20_000 });
  await expect(stage).not.toContainText("Reconnecting");

  await context.close();
});
