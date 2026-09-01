import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: the Volunteer Link (issue #248). A per-Session URL the Organizer
 * shares grants the operational floor surface with no account — end a Game,
 * view the Queue — and stops working when the Session closes or its Floor Mode
 * drops volunteers. Denials that need no browser (wrong token, closed Session,
 * event-type scope) are pinned in supabase/tests/on_deck_volunteer_link.test.sql.
 *
 * Throwaway accounts per run, following on-deck.spec.ts.
 */
const HYBRID_ORGANIZER = `on-deck-vol-hybrid-${Date.now()}@example.com`;
const SELF_SERVE_ORGANIZER = `on-deck-vol-selfserve-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let hybridSessionId: string;
let hybridToken: string;
let selfServeSessionId: string;
let selfServeToken: string;

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

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test.beforeAll(async ({ browser }) => {
  // A fresh context per sign-up — the second would land on an
  // already-authenticated home screen otherwise.
  for (const email of [HYBRID_ORGANIZER, SELF_SERVE_ORGANIZER]) {
    const page = await browser.newPage();
    await signUp(page, email);
    await page.close();
  }

  const hybridClub = await seedClubForOrganizer(HYBRID_ORGANIZER, {
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId: hybridSessionId, volunteerToken: hybridToken } =
    await seedOpenSession(HYBRID_ORGANIZER, hybridClub, { floorMode: "hybrid" }));

  const selfServeClub = await seedClubForOrganizer(SELF_SERVE_ORGANIZER, {
    name: "Self Serve Club",
    venueName: "Trinity Bellwoods",
    floorMode: "self-serve",
  });
  ({ sessionId: selfServeSessionId, volunteerToken: selfServeToken } =
    await seedOpenSession(SELF_SERVE_ORGANIZER, selfServeClub, {
      floorMode: "self-serve",
    }));

  // Eight Players queued from their phones, so the volunteer has a Foursome to
  // send and a Queue to read.
  const stamp = Date.now();
  for (const [i, name] of ["Ana", "Bo", "Cy", "Di", "Ed", "Fi", "Gu", "Ha"].entries()) {
    const tok = `tok-vol-${stamp}-${i}`;
    await joinPlayerViaRpc(hybridSessionId, tok, name, name[0]);
    await queuePlayerViaRpc(hybridSessionId, tok);
  }
});

test.afterAll(async () => {
  await deleteClubForOrganizer(HYBRID_ORGANIZER);
  await deleteClubForOrganizer(SELF_SERVE_ORGANIZER);
});

test("a volunteer opens the link with no login, ends a game, and reads the queue", async ({
  page,
}) => {
  await page.goto(`/on-deck/session/${hybridSessionId}/volunteer/${hybridToken}`);

  await expect(page.getByText("Volunteer floor")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ramsden Park" }),
  ).toBeVisible();
  // The Queue is readable.
  await expect(page.getByRole("heading", { name: /^Queue/ })).toBeVisible();

  const court1 = page.getByTestId("court-1");
  await court1.getByRole("button", { name: "Send next four" }).click();
  await expect(court1.locator("ul > li")).toHaveCount(4);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/248-volunteer-floor-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/248-volunteer-floor-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  // End the Game the volunteer just started — a COURT_FINISHED fired as the
  // volunteer, which the fold turns over without complaint.
  const seated = await court1.locator("ul > li").allTextContents();
  await court1.getByRole("button", { name: "Court 1 done" }).click();
  await expect(court1.locator("ul > li")).toHaveCount(4);
  await expect(async () => {
    const now = await court1.locator("ul > li").allTextContents();
    expect(now).not.toEqual(seated);
  }).toPass();
  // The volunteer's turnover went through cleanly — no error on the board.
  await expect(page.getByTestId("floor-error")).toHaveCount(0);
});

test("a bogus token and a self-serve session's link both 404", async ({
  page,
}) => {
  await page.goto(
    `/on-deck/session/${hybridSessionId}/volunteer/not-a-real-token-not-a-real-token`,
  );
  await expect(page.getByText("Volunteer floor")).toHaveCount(0);
  await expect(page.getByTestId("court-1")).toHaveCount(0);

  // Floor Mode self-serve: the link is inert even with the right token.
  await page.goto(
    `/on-deck/session/${selfServeSessionId}/volunteer/${selfServeToken}`,
  );
  await expect(page.getByText("Volunteer floor")).toHaveCount(0);
  await expect(page.getByTestId("court-1")).toHaveCount(0);
});

test("the Organizer sees and copies the Volunteer Link on the floor screen", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, HYBRID_ORGANIZER);
  await page.goto(`/on-deck/session/${hybridSessionId}/floor`);

  await expect(page.getByRole("heading", { name: "Volunteer link" })).toBeVisible();
  const link = page.getByTestId("volunteer-link");
  await expect(link).toContainText(
    `/on-deck/session/${hybridSessionId}/volunteer/${hybridToken}`,
  );

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: "test-results/248-organizer-link-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/248-organizer-link-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(
    `/on-deck/session/${hybridSessionId}/volunteer/${hybridToken}`,
  );
});

test("the self-serve Organizer gets no Volunteer Link", async ({ page }) => {
  await signIn(page, SELF_SERVE_ORGANIZER);
  await page.goto(`/on-deck/session/${selfServeSessionId}/floor`);

  await expect(page.getByRole("heading", { name: /^Queue/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Volunteer link" }),
  ).toHaveCount(0);
});
