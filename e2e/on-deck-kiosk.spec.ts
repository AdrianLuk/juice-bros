import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: the courtside Kiosk (issue #259). A tablet stood by the courts shows
 * the same live board as the Display plus the turnover buttons any Player can
 * tap — Court done, a player short, add me — with no account and no token. It
 * works under `self-serve` and `hybrid` Floor Mode and is inert under
 * `volunteer-run`. Every tap is recorded as a `kiosk` Operator.
 *
 * The database-level scope (`on_deck_kiosk_append` accepts only the four
 * courtside events, stamps `kiosk`, rejects a volunteer-run / closed Session)
 * is pinned in supabase/tests/on_deck_kiosk.test.sql. Here: a full self-serve
 * turnover on the Kiosk with no Volunteer Link ever issued.
 */
const SELF_SERVE_ORGANIZER = `on-deck-kiosk-selfserve-${Date.now()}@example.com`;
const VOLUNTEER_RUN_ORGANIZER = `on-deck-kiosk-volrun-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let selfServeSessionId: string;
let volunteerRunSessionId: string;

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test.beforeAll(async ({ browser }) => {
  for (const email of [SELF_SERVE_ORGANIZER, VOLUNTEER_RUN_ORGANIZER]) {
    const page = await browser.newPage();
    await signUp(page, email);
    await page.close();
  }

  const selfServeClub = await seedClubForOrganizer(SELF_SERVE_ORGANIZER, {
    name: "Self Serve Kiosk Club",
    venueName: "Trinity Bellwoods",
    floorMode: "self-serve",
  });
  ({ sessionId: selfServeSessionId } = await seedOpenSession(
    SELF_SERVE_ORGANIZER,
    selfServeClub,
    { floorMode: "self-serve", venueName: "Trinity Bellwoods" },
  ));

  const volunteerRunClub = await seedClubForOrganizer(VOLUNTEER_RUN_ORGANIZER, {
    name: "Volunteer Run Club",
    venueName: "Ramsden Park",
    floorMode: "volunteer-run",
  });
  ({ sessionId: volunteerRunSessionId } = await seedOpenSession(
    VOLUNTEER_RUN_ORGANIZER,
    volunteerRunClub,
    { floorMode: "volunteer-run" },
  ));

  // Fourteen Players queued from their phones — enough that after a Foursome is
  // seated and two more are committed On Deck (up to eight), there is still a
  // real waiter for "a player short" to pull in.
  const stamp = Date.now();
  const names = [
    "Ana", "Bo", "Cy", "Di", "Ed", "Fi", "Gu", "Ha",
    "Ivy", "Jo", "Ky", "Lu", "Mo", "Ne",
  ];
  for (const [i, name] of names.entries()) {
    const tok = `tok-kiosk-${stamp}-${i}`;
    await joinPlayerViaRpc(selfServeSessionId, tok, name, name[0]);
    await queuePlayerViaRpc(selfServeSessionId, tok);
  }
});

test.afterAll(async () => {
  await deleteClubForOrganizer(SELF_SERVE_ORGANIZER);
  await deleteClubForOrganizer(VOLUNTEER_RUN_ORGANIZER);
});

test("a full self-serve turnover runs on the kiosk alone — court done, add me, a player short", async ({
  page,
}) => {
  // No login, no token — just the session URL.
  await page.goto(`/on-deck/session/${selfServeSessionId}/kiosk`);

  await expect(page.getByText("Kiosk", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trinity Bellwoods" }),
  ).toBeVisible();
  await expect(page.getByTestId("kiosk-board")).toBeVisible();

  // "Add me" — a walk-up with no phone joins the Queue from the Kiosk.
  await page.getByTestId("add-me").click();
  const addMe = page.getByTestId("add-me-form");
  await addMe.getByLabel("First name").fill("Walter");
  await addMe.getByLabel("Last initial").fill("K");
  await addMe.getByLabel("Skill level").selectOption("Intermediate");
  await addMe.getByRole("button", { name: "Add me", exact: true }).click();
  await expect(page.getByTestId("kiosk-queue").getByText("Walter K.")).toBeVisible();
  await expect(page.getByTestId("kiosk-error")).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: "test-results/259-kiosk-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/259-kiosk-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  // "Court 1 done" — with a queued Foursome and no volunteer anywhere, the next
  // four walk on.
  const court1 = page.getByTestId("kiosk-court-1");
  await court1.getByRole("button", { name: "Send next four" }).click();
  await expect(court1.locator("ul > li")).toHaveCount(4);
  await expect(page.getByTestId("kiosk-error")).toHaveCount(0);

  const seated = await court1.locator("ul > li").allTextContents();

  // "A player short" — the three who showed flag the missing fourth; Match Me
  // pulls a replacement in without restarting the game.
  await page.getByTestId("player-short-1").click();
  await court1
    .getByRole("button", { name: "Bring them in" })
    .click();
  await expect(page.getByTestId("kiosk-error")).toHaveCount(0);
  await expect(async () => {
    const now = await court1.locator("ul > li").allTextContents();
    expect(now).not.toEqual(seated);
  }).toPass();
  // Still four on the court — a swap, not a turnover.
  await expect(court1.locator("ul > li")).toHaveCount(4);
});

test("the kiosk URL is inert under volunteer-run Floor Mode", async ({ page }) => {
  await page.goto(`/on-deck/session/${volunteerRunSessionId}/kiosk`);
  await expect(page.getByTestId("kiosk-board")).toHaveCount(0);
  await expect(page.getByTestId("kiosk-court-1")).toHaveCount(0);
});
