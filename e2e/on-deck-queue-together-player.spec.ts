import { expect, test, type Page } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: Queue Together, player-formed (issue #251). A Player forms a Group
 * from their own phone by picking other current-Session Players; the picked
 * members are added with no prompt. Any member can remove *themselves*, and a
 * Volunteer can dissolve any Group; the Group queues as one unit. The database
 * scope (anon form/leave RPCs, GROUP_DISSOLVED on the volunteer path) is pinned
 * in supabase/tests/on_deck_queue_together_player_formed.test.sql.
 */
const ORGANIZER = `on-deck-qtp-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let sessionId: string;
let clubId: string;
const STAMP = Date.now();

// Two players already set up and queued from other phones — with Ana that is
// three waiting, short of a foursome, so nobody is committed On Deck yet and
// Ana reads a plain queue position.
const OTHERS: [string, string, string][] = [
  [`tok-qtp-bea-${STAMP}`, "Bea", "B"],
  [`tok-qtp-cal-${STAMP}`, "Cal", "C"],
];

/** A signed-in Organizer page, kept for the whole spec. */
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
    name: "Player Group Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId } = await seedOpenSession(ORGANIZER, clubId, {
    floorMode: "hybrid",
  }));

  for (const [token, first, initial] of OTHERS) {
    await joinPlayerViaRpc(sessionId, token, first, initial);
    await queuePlayerViaRpc(sessionId, token);
  }
});

test.afterAll(async () => {
  await floor.context().close();
  await deleteClubForOrganizer(ORGANIZER);
});

test("a Player forms a Group from their phone; it queues as one unit, any member can leave it, a volunteer can break it up", async ({
  page,
}) => {
  // Ana does the two-tap setup and joins the Queue from her own phone.
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(/\/on-deck\/session\/[0-9a-f-]+$/);
  await page.getByLabel("First name").fill("Ana");
  await page.getByLabel("Last initial").fill("A");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Intermediate", exact: true }).click();
  await expect(page.getByText("You're in")).toBeVisible();
  await page.getByRole("button", { name: "Join the queue" }).click();
  await expect(page.getByTestId("queue-position")).toBeVisible();

  // She picks Bea and Cal to play together — no prompt on their phones.
  const picker = page.getByTestId("queue-together-player");
  await picker.getByText("Playing with friends?").click(); // open the <details>
  await picker.getByRole("button", { name: "Bea B.", exact: true }).click();
  await picker.getByRole("button", { name: "Cal C.", exact: true }).click();
  await picker.getByRole("button", { name: "Queue together" }).click(); // submit

  // Ana's own line now says she is queued with her group.
  await expect(page.getByTestId("queue-group-note")).toBeVisible();
  await expect(
    page.getByText("You're queued with your group", { exact: false }),
  ).toBeVisible();

  await page.screenshot({
    path: "test-results/251-player-group-phone.png",
    fullPage: true,
  });

  // The floor shows the three as one Queue unit, with the line-jump explainer.
  await floor.goto(`/on-deck/session/${sessionId}/floor`);
  const groupRow = floor.getByTestId("queue-group");
  await expect(groupRow).toHaveCount(1);
  for (const name of ["Ana A.", "Bea B.", "Cal C."]) {
    await expect(groupRow.getByText(name)).toBeVisible();
  }
  await expect(
    floor.getByText("nobody skips the queue by grouping up", { exact: false }),
  ).toBeVisible();

  // Ana removes herself from the Group (two-tap, since it can't be undone from
  // her side) — she stays in the Queue as a solo.
  await page.getByRole("button", { name: "Leave the group" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByTestId("queue-group-note")).toHaveCount(0);
  await expect(page.getByTestId("queue-position")).toBeVisible();

  // The Group lives on with Bea and Cal (a two-member Group).
  await floor.reload();
  const stillGrouped = floor.getByTestId("queue-group");
  await expect(stillGrouped.getByText("Bea B.")).toBeVisible();
  await expect(stillGrouped.getByText("Cal C.")).toBeVisible();
  await expect(stillGrouped.getByText("Ana A.")).toHaveCount(0);

  // A volunteer (here the Organizer) breaks up the player-formed Group.
  await stillGrouped.getByRole("button", { name: "Break up" }).click();
  await expect(floor.getByTestId("queue-group")).toHaveCount(0);
});
