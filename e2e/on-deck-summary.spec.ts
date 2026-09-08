import { expect, test } from "@playwright/test";

import {
  deleteClubForOrganizer,
  finishCourtViaRpc,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
  seedClubForOrganizer,
  seedOpenSession,
} from "./support/on-deck.ts";

/**
 * On Deck: reading the Session Summary (issue #469).
 *
 * The projection itself is covered by `summary.test.ts` and the storage by
 * `on_deck_last_call_close.test.sql`. What is new here is the reader, so this
 * drives the one path nobody could take before: close a night, then find its
 * numbers from the Organizer's own screens without touching SQL.
 */

const ORGANIZER = `on-deck-summary-${Date.now()}@example.com`;
const OTHER = `on-deck-summary-other-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let clubId: string;
let sessionId: string;
let volunteerToken: string;

async function signUp(
  browser: import("@playwright/test").Browser,
  email: string,
) {
  const page = await browser.newPage();
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
  await page.close();
}

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test.beforeAll(async ({ browser }) => {
  await signUp(browser, ORGANIZER);
  await signUp(browser, OTHER);

  clubId = await seedClubForOrganizer(ORGANIZER, {
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
    // Explicit here so this club's dates are deterministic. The other Club
    // below is left unset on purpose, to exercise adoption.
    timeZone: "America/Toronto",
  });
  await seedClubForOrganizer(OTHER, {
    name: "Some Other Club",
    venueName: "Elsewhere",
    floorMode: "hybrid",
  });

  ({ sessionId, volunteerToken } = await seedOpenSession(ORGANIZER, clubId, {
    courtCount: 2,
    floorMode: "hybrid",
  }));

  // Eight players, two courts. Seat both, then turn them over twice, so the
  // Summary has games on both Courts and completed waits to distribute.
  const stamp = Date.now();
  const names = ["Ana", "Bo", "Cy", "Di", "Ed", "Fi", "Gu", "Ha"];
  for (const [i, name] of names.entries()) {
    const tok = `tok-sum-${stamp}-${i}`;
    await joinPlayerViaRpc(sessionId, tok, name, name[0]);
    await queuePlayerViaRpc(sessionId, tok);
  }
  await finishCourtViaRpc(sessionId, volunteerToken, 1);
  await finishCourtViaRpc(sessionId, volunteerToken, 2);
  await finishCourtViaRpc(sessionId, volunteerToken, 1);
  await finishCourtViaRpc(sessionId, volunteerToken, 2);
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER);
  await deleteClubForOrganizer(OTHER);
});

test("before any night has closed, past nights explains itself rather than sitting blank", async ({
  page,
}) => {
  await signIn(page, OTHER);
  await page.goto("/on-deck/home/summaries");

  await expect(page.getByRole("heading", { name: "Past nights" })).toBeVisible();
  await expect(page.getByText("No nights have finished yet")).toBeVisible();
  // And it does not advertise itself on home before there is anything to read.
  await page.goto("/on-deck/home");
  await expect(page.getByRole("heading", { name: "Past nights" })).toHaveCount(0);
});

test("closing a night puts its numbers on the Organizer's own screens, no SQL", async ({
  page,
}) => {
  await signIn(page, ORGANIZER);

  // End the night the way an Organizer would. Close is deliberately only
  // offered after Last Call — a night that has not been called cannot be
  // closed out from under the games still running.
  await page.goto(`/on-deck/session/${sessionId}/floor`);
  const wrapUp = page.getByTestId("wrap-up");
  await wrapUp.getByTestId("last-call-button").click();
  await wrapUp.getByTestId("last-call-confirm").click();
  await expect(page.getByTestId("last-call-banner")).toBeVisible();

  await wrapUp.getByTestId("close-session-button").click();
  await wrapUp.getByTestId("close-session-confirm").click();
  await expect(page.getByText("Session closed")).toBeVisible({ timeout: 10_000 });

  // Home now offers the way in, which it did not before.
  await page.goto("/on-deck/home");
  const pastNights = page.getByRole("heading", { name: "Past nights" });
  await expect(pastNights).toBeVisible();

  await page.getByRole("link", { name: "All past nights" }).click();
  await page.waitForURL(/\/on-deck\/home\/summaries$/);
  await expect(page.getByText("Ramsden Park")).toBeVisible();

  // Into the night itself.
  await page.getByRole("link", { name: /played, .* games/ }).first().click();
  await page.waitForURL(/\/on-deck\/home\/summaries\/[0-9a-f-]+$/);

  // Eight players joined; four turnovers happened on two Courts.
  const played = page.locator("div", { has: page.getByText("Played", { exact: true }) });
  await expect(played.getByText("8", { exact: true }).first()).toBeVisible();

  // Every section of the projection is read, not just the headline counts.
  await expect(
    page.getByRole("heading", { name: "How long people waited" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How hard each court worked" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Who was in the room" }),
  ).toBeVisible();

  // Both Courts are rows, and the wait buckets are named in words.
  await expect(page.getByRole("rowheader", { name: "Court 1" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Court 2" })).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "30 min or more" }),
  ).toBeVisible();

  // The average is qualified by how many waits it came from, never printed bare.
  await expect(page.getByText(/From \d+ wait/)).toBeVisible();

  // The roster is gone — a closed Session leaves numbers, not people.
  await expect(page.getByText("Ana")).toHaveCount(0);
  await expect(page.getByText("Bo", { exact: true })).toHaveCount(0);
});

test("an Organizer is never asked for a time zone -- their browser answers it", async ({
  page,
}) => {
  // Cal's Club was seeded from SQL, where no browser exists to ask, so it
  // starts with no clock at all. Loading home is what establishes one.
  await signIn(page, OTHER);
  await page.goto("/on-deck/home");
  await expect(page.getByRole("heading", { name: "Tonight" })).toBeVisible();

  // Settings shows a clock without anyone having chosen one. Playwright's
  // browser runs on UTC, so that is what it adopts here; the point is that a
  // value is there at all, and that nobody was prompted for it.
  await page.goto("/on-deck/home/settings");
  const picker = page.getByLabel("Time zone");
  await expect(picker).toBeVisible();
  await expect(picker).not.toHaveValue("");

  // And it is a correction, not a setup step: an Organizer can still say the
  // guess was wrong.
  await picker.selectOption("America/Toronto");
  await page.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByText("Defaults saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Time zone")).toHaveValue("America/Toronto");
});

test("another Club's night is not readable", async ({ page }) => {
  await signIn(page, OTHER);
  await page.goto(`/on-deck/home/summaries/${sessionId}`);

  // RLS makes it absent rather than forbidden, so the page 404s. Next serves
  // a soft 404 (200 plus the not-found screen), so assert on what renders.
  await expect(
    page.getByRole("heading", { name: "This page could not be found." }),
  ).toBeVisible();
});
