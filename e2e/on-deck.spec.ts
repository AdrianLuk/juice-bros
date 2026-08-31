import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
} from "./support/on-deck.ts";

/**
 * On Deck's tenant backbone (issue #241): an Organizer signs in, sees their
 * Club, taps Start to open a Session from the saved defaults, and the stable
 * Club QR path resolves to that open Session.
 *
 * The Club is seeded straight against PostgREST — self-serve club creation is
 * out of scope (#238) and there is no app path that writes `on_deck_clubs`.
 * A throwaway account per run (never deleted — there is no delete-account
 * feature), following `onboarding.spec.ts`'s posture.
 */
const ORGANIZER_EMAIL = `on-deck-organizer-${Date.now()}@example.com`;
const ORGANIZER_PASSWORD = "pickleball123";

let clubId: string;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
  await page.close();

  clubId = await seedClubForOrganizer(ORGANIZER_EMAIL, {
    name: "TO Pickleball Club",
    venueName: "Ramsden Park",
    courtCount: 8,
    floorMode: "hybrid",
  });
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER_EMAIL);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test("the Club QR shows 'nothing running' before a Session is started", async ({
  page,
}) => {
  await page.goto(`/on-deck/c/${clubId}`);
  await expect(
    page.getByRole("heading", { name: "Nothing running right now" }),
  ).toBeVisible();
});

test("an Organizer signs in, sees their Club, and Start opens a Session the QR then resolves to", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/on-deck/home");
  await expect(
    page.getByRole("heading", { name: "TO Pickleball Club" }),
  ).toBeVisible();
  await expect(page.getByText("Ramsden Park")).toBeVisible();

  await page.getByRole("button", { name: "Start", exact: true }).click();

  // Lands on the live Session view.
  await page.waitForURL(/\/on-deck\/session\/[0-9a-f-]+$/);
  await expect(page.getByText("Session running")).toBeVisible();
  const sessionUrl = page.url();

  // The stable Club QR path now redirects to that same open Session.
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(sessionUrl);
  await expect(page.getByText("Session running")).toBeVisible();

  // Back on the home screen, Start is replaced by a link to the running one.
  await page.goto("/on-deck/home");
  await expect(page.getByText("A session is running.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(
    0,
  );
});

test("a Player scans the Club QR, does the two-tap setup, and is recognized on return", async ({
  page,
}) => {
  // The session opened by the test above is still running (there is no close
  // feature yet), so the QR resolves straight to it.
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(/\/on-deck\/session\/[0-9a-f-]+$/);
  const sessionUrl = page.url();
  await expect(page.getByText("Session running")).toBeVisible();

  // Tap one: name.
  await page.getByLabel("First name").fill("Sarah");
  await page.getByLabel("Last initial").fill("K");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Tap two: skill level — which submits.
  await page.getByRole("button", { name: "Intermediate", exact: true }).click();

  await expect(page.getByText("You're in")).toBeVisible();
  await expect(page.getByText("Sarah K.", { exact: true })).toBeVisible();
  await expect(page.getByText("Playing as Intermediate")).toBeVisible();

  // Reopening the QR on the same device recognizes the returning token —
  // straight to "you're in", no setup form.
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(sessionUrl);
  await expect(page.getByText("You're in")).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveCount(0);
});

test("the rotation loop: a Player joins the Queue, is called onto a Court, and re-queues when it finishes", async ({
  page,
  context,
}) => {
  await page.goto(`/on-deck/c/${clubId}`);
  await page.waitForURL(/\/on-deck\/session\/([0-9a-f-]+)$/);
  const sessionId = page.url().split("/").pop()!;

  // Two Players already queued from their own phones (driven through the same
  // anon RPCs the join/queue taps hit).
  const stamp = Date.now();
  for (const [i, name] of ["Anna", "Ben"].entries()) {
    const tok = `tok-${name}-${stamp}-${i}`;
    await joinPlayerViaRpc(sessionId, tok, name, name[0]);
    await queuePlayerViaRpc(sessionId, tok);
  }

  // Our Player does the two-tap setup, then joins the Queue.
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last initial").fill("R");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Intermediate", exact: true }).click();
  await expect(page.getByText("You're in")).toBeVisible();

  await page.getByRole("button", { name: "Join the queue" }).click();
  await expect(page.getByTestId("queue-position")).toBeVisible();

  // A fourth Player queues — enough for a foursome.
  const cyrus = `tok-cyrus-${stamp}`;
  await joinPlayerViaRpc(sessionId, cyrus, "Cyrus", "C");
  await queuePlayerViaRpc(sessionId, cyrus);

  // The Organizer, on the floor screen, sends the next four onto Court 1.
  const organizer = await context.newPage();
  await organizer.goto("/on-deck/sign-in?next=/on-deck/home");
  await organizer
    .getByRole("button", { name: "Sign in with a password" })
    .click();
  await organizer.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await organizer.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await organizer.getByRole("button", { name: "Sign in", exact: true }).click();
  await organizer.waitForURL((url) => !url.pathname.includes("/sign-in"));

  await organizer.goto(`/on-deck/session/${sessionId}/floor`);
  const court1 = organizer.getByTestId("court-1");
  await expect(court1.getByText("Dana R.")).toHaveCount(0);

  // On Deck (#245): with four waiting, the "Up next" Foursome is committed and
  // named on the floor screen before any Court frees.
  const upNext = organizer.getByTestId("on-deck-0");
  await expect(upNext).toBeVisible();
  await expect(upNext.getByText("Up next")).toBeVisible();
  await expect(upNext.getByText("Dana R.")).toBeVisible();

  await organizer.setViewportSize({ width: 1280, height: 900 });
  await organizer.screenshot({ path: "test-results/on-deck-floor-desktop.png", fullPage: true });
  await organizer.setViewportSize({ width: 390, height: 844 });
  await organizer.screenshot({ path: "test-results/on-deck-floor-mobile.png", fullPage: true });
  await organizer.setViewportSize({ width: 1280, height: 720 });

  await court1.getByRole("button", { name: "Send next four" }).click();
  await expect(court1.getByText("Dana R.")).toBeVisible();
  // The committed Foursome walked straight onto the Court — On Deck is empty
  // again until more Players queue.
  await expect(organizer.getByTestId("on-deck-0")).toHaveCount(0);

  // Our Player's own screen updates within a poll interval: they're up.
  await expect(page.getByText("You're up, Court 1")).toBeVisible({
    timeout: 10_000,
  });

  // Four more Players queue, then the Organizer taps Court 1 done: the four
  // coming off re-queue and the next four walk on.
  for (const name of ["Dee", "Eli", "Fay", "Gus"]) {
    const tok = `tok-${name}-${stamp}`;
    await joinPlayerViaRpc(sessionId, tok, name, name[0]);
    await queuePlayerViaRpc(sessionId, tok);
  }

  await court1.getByRole("button", { name: "Court 1 done" }).click();
  await expect(court1.getByText("Dana R.")).toHaveCount(0);

  // The four coming off re-queue; with eight now waiting they land in the
  // second On Deck Foursome, and our Player's own screen says so.
  await expect(page.getByText("You're on deck — the foursome after next")).toBeVisible({
    timeout: 10_000,
  });
});
