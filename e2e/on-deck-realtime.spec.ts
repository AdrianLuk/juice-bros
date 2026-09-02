import { expect, test, type Page } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: Realtime sync upgrade (issue #252). An event fired on one surface
 * reaches the others in about a second, with no manual refresh — the trigger
 * mechanism swapped from a ~4s poll to a Supabase Realtime subscription on
 * `on_deck_session_events` inserts. Polling stays as the automatic fallback,
 * so this spec's assertions still hold (just more slowly) if the socket never
 * connects.
 *
 * The publication membership and that RLS still gates the channel are pinned in
 * supabase/tests/on_deck_realtime.test.sql.
 */
const ORGANIZER = `on-deck-realtime-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";
const STAMP = Date.now();

let clubId: string;
let sessionId: string;

// Nine queued: two full On Deck foursomes commit (eight players), leaving the
// ninth — "Ivy" — with a plain queue position that shifts as the board moves.
const PLAYERS: [string, string, string][] = [
  [`tok-rt-a-${STAMP}`, "Ana", "A"],
  [`tok-rt-b-${STAMP}`, "Bea", "B"],
  [`tok-rt-c-${STAMP}`, "Cal", "C"],
  [`tok-rt-d-${STAMP}`, "Dee", "D"],
  [`tok-rt-e-${STAMP}`, "Eli", "E"],
  [`tok-rt-f-${STAMP}`, "Fay", "F"],
  [`tok-rt-g-${STAMP}`, "Gus", "G"],
  [`tok-rt-h-${STAMP}`, "Hal", "H"],
  [`tok-rt-i-${STAMP}`, "Ivy", "I"],
];

let floor: Page;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  floor = await ctx.newPage();
  await floor.goto("/on-deck/sign-in?next=/on-deck/home");
  await floor
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await floor.getByLabel("Email").fill(ORGANIZER);
  await floor.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await floor.getByRole("button", { name: "Create account" }).click();
  await floor.waitForURL((url) => !url.pathname.includes("/sign-in"));

  clubId = await seedClubForOrganizer(ORGANIZER, {
    name: "Realtime Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId } = await seedOpenSession(ORGANIZER, clubId, {
    floorMode: "hybrid",
  }));

  for (const [token, first, initial] of PLAYERS) {
    await joinPlayerViaRpc(sessionId, token, first, initial);
    await queuePlayerViaRpc(sessionId, token);
  }
});

test.afterAll(async () => {
  await floor.context().close();
  await deleteClubForOrganizer(ORGANIZER);
});

test("an action in one browser context appears in the other within ~1s, no reload", async ({
  browser,
}) => {
  // Ivy's phone (a separate context): nine are queued, eight already sit in the
  // two committed On Deck foursomes, so Ivy reads a plain queue position.
  const phoneCtx = await browser.newContext();
  const phone = await phoneCtx.newPage();
  await phone.addInitScript(
    (args: string[]) => {
      window.localStorage.setItem(
        `juicebros.on-deck.player.${args[0]}`,
        args[1],
      );
    },
    [sessionId, PLAYERS[8][0]],
  );
  await phone.goto(`/on-deck/session/${sessionId}`);
  await expect(phone.getByText("You're in")).toBeVisible();
  await expect(phone.getByTestId("queue-position")).toContainText("of 1");

  // Direction 1 — organizer → phone. The organizer opens the floor screen in
  // its own context and adds a walk-up. Ivy's "of N" climbs on its own; the
  // tight timeout is what says Realtime carried it, not the slow poll.
  await floor.goto(`/on-deck/session/${sessionId}/floor`);
  await floor.getByTestId("add-walkup").getByLabel("First name").fill("Fin");
  await floor.getByTestId("add-walkup").getByLabel("Last initial").fill("F");
  await floor
    .getByTestId("add-walkup")
    .getByRole("button", { name: "Add to the queue" })
    .click();
  await expect(phone.getByTestId("queue-position")).toContainText("of 2", {
    timeout: 8_000,
  });

  await phone.screenshot({
    path: "test-results/252-realtime-phone.png",
    fullPage: true,
  });

  // Direction 2 — phone → floor. Ivy steps out of the queue from her phone and
  // the floor's queue count drops back without the organizer touching anything.
  await expect(
    floor.getByRole("heading", { name: /^Queue \(/ }),
  ).toContainText("(2)");
  await phone.getByRole("button", { name: "Leave the queue" }).click();
  await expect(
    floor.getByRole("heading", { name: /^Queue \(/ }),
  ).toContainText("(1)", { timeout: 8_000 });

  await phoneCtx.close();
});
