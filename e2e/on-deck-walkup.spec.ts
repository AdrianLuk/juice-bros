import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
} from "./support/on-deck.ts";

/**
 * On Deck: walk-up Players and Skill Level override (issue #249). An Operator
 * on the floor adds a Player with no phone (name + last initial + Skill Level)
 * and they queue and get called exactly like a self-registered Player; the
 * Operator can also correct an obviously wrong self-rating. The database-level
 * scope (volunteer append accepts the two new event types, with guards) is
 * pinned in supabase/tests/on_deck_walkup_skill.test.sql.
 *
 * A dedicated seeded Session with nobody else in it, so the four walk-ups are
 * the whole Queue and one "Send next four" calls them.
 */
const ORGANIZER = `on-deck-walkup-${Date.now()}@example.com`;
const PASSWORD = "pickleball123";

let sessionId: string;

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

  const clubId = await seedClubForOrganizer(ORGANIZER, {
    name: "Walk-up Club",
    venueName: "Ramsden Park",
    floorMode: "hybrid",
  });
  ({ sessionId } = await seedOpenSession(ORGANIZER, clubId, {
    floorMode: "hybrid",
  }));
});

test.afterAll(async () => {
  await deleteClubForOrganizer(ORGANIZER);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/on-deck/sign-in?next=/on-deck/home");
  await page.getByRole("button", { name: "Sign in with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"));
}

test("an operator adds four walk-ups, corrects a rating, and 'Send next four' calls them", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/on-deck/session/${sessionId}/floor`);

  const form = page.getByTestId("add-walkup");
  const walkups: [string, string, string][] = [
    ["Wanda", "W", "Beginner"],
    ["Xavier", "X", "Intermediate"],
    ["Yusuf", "Y", "Newbie"],
    ["Zara", "Z", "Advanced"],
  ];
  for (const [first, initial, skill] of walkups) {
    await form.getByLabel("First name").fill(first);
    await form.getByLabel("Last initial").fill(initial);
    await form.getByLabel("Skill level").selectOption(skill);
    await form.getByRole("button", { name: "Add to the queue" }).click();
    // They're on the board within a poll — in the Queue, or (once four are
    // waiting) the committed "Up next" On Deck Foursome.
    await expect(
      page.getByText(`${first} ${initial}.`).first(),
    ).toBeVisible();
  }

  await expect(page.getByTestId("floor-error")).toHaveCount(0);
  // Four waiting commits the first On Deck Foursome (#245) — all four walk-ups.
  const upNext = page.getByTestId("on-deck-0");
  for (const [first, initial] of walkups) {
    await expect(upNext.getByText(`${first} ${initial}.`)).toBeVisible();
  }

  // Correct Yusuf's self-rating from Newbie to Advanced — Match Me reads it on
  // its next selection.
  await page.getByTestId("skill-levels").locator("summary").click();
  const yusufSkill = page.getByLabel("Skill level for Yusuf Y.");
  await yusufSkill.selectOption("Advanced");
  await expect(yusufSkill).toHaveValue("advanced");
  await expect(page.getByTestId("floor-error")).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: "test-results/249-walkup-floor-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/249-walkup-floor-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  // The four walk-ups are the whole board — one tap calls them onto Court 1.
  const court1 = page.getByTestId("court-1");
  await court1.getByRole("button", { name: "Send next four" }).click();
  await expect(court1.locator("ul > li")).toHaveCount(4);
  for (const [first, initial] of walkups) {
    await expect(court1.getByText(`${first} ${initial}.`)).toBeVisible();
  }
  await expect(page.getByTestId("on-deck-0")).toHaveCount(0);
});
