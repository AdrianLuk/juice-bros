import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
  finishCourtViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck: Last Call, close, and the Session Summary (issue #255).
 *
 * The end-of-night journey: the Organizer taps Last Call → the board flips to
 * "final games" and stops assigning Foursomes → the Game already on a Court
 * finishes → the Organizer closes the Session → the Club QR resolves to
 * "nothing running". The fold rules and the purge are pinned without a browser
 * in reduce.test.ts / summary.test.ts / on_deck_last_call_close.test.sql.
 */
const ORGANIZER = `on-deck-last-call-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let clubId: string;
let sessionId: string;
let volunteerToken: string;

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await page.getByLabel("Email").fill(ORGANIZER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
  await page.close();

  clubId = await seedClubForOrganizer(ORGANIZER, {
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId, volunteerToken } = await seedOpenSession(ORGANIZER, clubId, {
    courtCount: 2,
    floorMode: "hybrid",
  }));

  const stamp = Date.now();
  for (const [i, name] of ["Ana", "Bo", "Cy", "Di", "Ed", "Fi", "Gu", "Ha"].entries()) {
    const tok = `tok-lc-${stamp}-${i}`;
    await joinPlayerViaRpc(sessionId, tok, name, name[0]);
    await queuePlayerViaRpc(sessionId, tok);
  }
  // Seat Court 1 so there is a Game in progress when Last Call is tapped
  // ("send next four" on an empty Court).
  await finishCourtViaRpc(sessionId, volunteerToken, 1);
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER);
});

test("last call → finish → close → the QR shows nothing running", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/on-deck/session/${sessionId}/floor`);

  const court1 = page.getByTestId("court-1");
  const court2 = page.getByTestId("court-2");
  // Court 1 is in play, Court 2 is empty with a foursome waiting.
  await expect(court1.getByText("Ana A.")).toBeVisible();
  await expect(
    court2.getByRole("button", { name: "Send next four" }),
  ).toBeEnabled();

  // Last Call — takes a confirm.
  const wrapUp = page.getByTestId("wrap-up");
  await wrapUp.getByTestId("last-call-button").click();
  await wrapUp.getByTestId("last-call-confirm").click();

  // The board flips to "final games": no new foursomes assign.
  await expect(page.getByTestId("last-call-banner")).toBeVisible();
  await expect(
    court2.getByRole("button", { name: "Send next four" }),
  ).toBeDisabled();
  // The On Deck foursomes are cleared — queued players are done.
  await expect(page.getByTestId("on-deck-0")).toHaveCount(0);

  // The Game already on Court 1 still finishes normally.
  await court1.getByRole("button", { name: "Court 1 done" }).click();
  await expect(court1.getByText("Ana A.")).toHaveCount(0);
  // ...and nobody walks back on.
  await expect(court1.getByText("Waiting for a foursome")).toBeVisible();

  // Close the Session — also a confirm.
  await wrapUp.getByTestId("close-session-button").click();
  await wrapUp.getByTestId("close-session-confirm").click();

  await expect(page.getByText("Session closed")).toBeVisible({ timeout: 10_000 });

  // The Club QR now resolves to "nothing running right now".
  await page.goto(`/on-deck/c/${clubId}`);
  await expect(
    page.getByRole("heading", { name: "Nothing running right now" }),
  ).toBeVisible();
});
