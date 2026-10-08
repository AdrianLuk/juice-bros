import { expect, test, type Locator, type Page } from "@playwright/test";

import { deleteTeamEventOrganizer, scoreMatchup, seedTeamEvent } from "./support/team-tally.ts";

/**
 * Team Tally: Matchup done, Seeding and Flights (issue #624).
 *
 *   - a four-Team night played through: captains mark their Matchups done
 *     (the tied one after recording its Dreambreaker), and the last one done
 *     switches every Score Link to its Flight Matchup on the expected court
 *     pair, with no reload;
 *   - the Organizer's Seed now places the Flights with Matchups unfinished.
 *
 * The night is seeded straight through the save function, with the opening
 * scores entered as the Organizer (e2e/support/team-tally.ts): Golden Set
 * (Ben Johns, courts 16 & 19 with Federico Staksrud) and Kitchen Kings
 * (Hayden Patriquin, 17 & 18 with Christian Alshon). Names are PPA Tour pros.
 */

/** 60-49 to the red side. */
const RED_WINS: [number, number][] = [
  [11, 8],
  [11, 9],
  [7, 11],
  [11, 6],
  [9, 11],
  [11, 4],
];

/** 60-60. */
const TIED: [number, number][] = [
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
];

/** Clicks until the click lands on a hydrated button, shown by `then` appearing. */
async function clickUntil(button: Locator, then: Locator) {
  await expect(async () => {
    await button.click();
    await expect(then).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/** A phone-width viewport: the Public Link's scrolling layout (desktop widths get the big-screen stage, #625). */
const PHONE = { width: 390, height: 844 };

async function openPage(
  browser: import("@playwright/test").Browser,
  path: string,
  viewport?: { width: number; height: number },
): Promise<Page> {
  const page = await (await browser.newContext(viewport ? { viewport } : {})).newPage();
  await page.goto(path);
  return page;
}

test("the last Matchup done sends every Score Link to its Flight on the expected court pair", async ({ browser }) => {
  const night = await seedTeamEvent("Flights Night");
  try {
    await scoreMatchup(night, 1, RED_WINS);
    await scoreMatchup(night, 2, TIED);

    const ben = await openPage(browser, `/tools/team-tally/score/${night.scoreTokens[0]}`);
    const hay = await openPage(browser, `/tools/team-tally/score/${night.scoreTokens[2]}`);
    const chr = await openPage(browser, `/tools/team-tally/score/${night.scoreTokens[3]}`);
    const room = await openPage(browser, `/tools/team-tally/live/${night.publicToken}`, PHONE);

    // Ben's captain finishes Match 1, confirming in the page.
    const benFinish = ben.getByRole("region", { name: "Finish the Matchup" });
    const benConfirm = ben.getByRole("alertdialog", { name: "Mark this Matchup done" });
    await clickUntil(benFinish.getByRole("button", { name: "Matchup done" }), benConfirm);
    await benConfirm.getByRole("button", { name: "Yes, it's done" }).click();
    await expect(ben.getByRole("region", { name: "Matchup done" })).toContainText("Marked done by Team Ben Johns");
    await expect(ben.getByText("Winner · Golden Set")).toBeVisible();
    // Done locks the scores: no Save, read-only boxes.
    await expect(ben.getByRole("button", { name: "Save score" })).toHaveCount(0);

    // Match 2 is tied 60-60: refused until the Dreambreaker winner is in.
    const hayFinish = hay.getByRole("region", { name: "Finish the Matchup" });
    await expect(hayFinish).toContainText("Tied 60-60");
    await clickUntil(
      hayFinish.getByRole("button", { name: "Matchup done" }),
      hayFinish.getByText("Tied 60-60. Record who won the Dreambreaker first."),
    );
    await hayFinish.getByRole("button", { name: "Kitchen Kings won" }).click();
    await expect(hayFinish.getByRole("button", { name: "Kitchen Kings won" })).toHaveAttribute("aria-pressed", "true");
    const hayConfirm = hay.getByRole("alertdialog", { name: "Mark this Matchup done" });
    await clickUntil(hayFinish.getByRole("button", { name: "Matchup done" }), hayConfirm);
    await expect(hayConfirm).toContainText("This is the last Matchup");
    await hayConfirm.getByRole("button", { name: "Yes, it's done" }).click();

    // Seeding: Golden Set 60 (+11) first; Kitchen Kings and Christian's Team
    // level on 60 and 0, settled by their Dreambreaker; Federico's Team 49.
    // Flight A takes Match 1's courts, Flight B Match 2's.
    const expected: [Page, string, string][] = [
      [ben, "Flight A · Courts 16 & 19", "16"],
      [hay, "Flight A · Courts 16 & 19", "19"],
      [chr, "Flight B · Courts 17 & 18", "17"],
    ];
    for (const [page, flight, court] of expected) {
      const yours = page.getByRole("region", { name: "Your Flight" });
      await expect(yours.getByRole("region", { name: flight })).toBeVisible({ timeout: 20_000 });
      await expect(yours.locator("[data-mine]")).toContainText(`Your court${court}`);
    }

    // Each Score Link now scores its Flight Matchup.
    const flightGame = ben.getByRole("form", { name: "Round 1, captains' game" });
    await expect(flightGame).toContainText("Ben Johns + Anna Leigh Waters");
    await expect(flightGame).toContainText("Hayden Patriquin + Tyra Black");
    await expect(ben.getByRole("table", { name: "Flight A · Courts 16 & 19" })).toBeVisible();

    // The room sees the Flights first.
    const flights = room.getByRole("region", { name: "Flights" });
    await expect(flights.getByRole("region", { name: "Flight A · Courts 16 & 19" })).toBeVisible({ timeout: 20_000 });
    await expect(flights.getByRole("region", { name: "Flight B · Courts 17 & 18" })).toContainText("Team Federico Staksrud");
  } finally {
    await deleteTeamEventOrganizer(night);
  }
});

test("Seed now places the Flights with a Matchup unfinished", async ({ page, browser }) => {
  const night = await seedTeamEvent("Seed Now Night");
  try {
    await scoreMatchup(night, 1, RED_WINS);
    await scoreMatchup(night, 2, [
      [11, 2],
      [11, 3],
    ]);

    await page.goto(`/tools/team-tally/sign-in?next=/tools/team-tally/events/${night.eventId}`);
    await clickUntil(page.getByRole("button", { name: "Sign in with a password" }), page.getByLabel("Password"));
    await page.getByLabel("Email").fill(night.organizerEmail);
    await page.getByLabel("Password").fill(night.organizerPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Seed Now Night" })).toBeVisible();

    const panel = page.getByRole("region", { name: "The Flights" });
    await expect(panel).toContainText("0 of 2 Matchups done");
    const confirm = page.getByRole("alertdialog", { name: "Seed the Flights now" });
    await clickUntil(panel.getByRole("button", { name: "Seed now" }), confirm);
    await expect(confirm).toContainText("2 of 2 Matchups aren't done");
    await confirm.getByRole("button", { name: "Place the Flights" }).click();

    // Golden Set 60, Federico's Team 49, Kitchen Kings 22, Christian's Team 5.
    await expect(panel).toContainText("Placed");
    await expect(page.getByRole("table", { name: "Flight A · Courts 16 & 19" })).toContainText("Golden Set");
    await expect(page.getByRole("table", { name: "Flight B · Courts 17 & 18" })).toContainText("Kitchen Kings");

    const fed = await openPage(browser, `/tools/team-tally/score/${night.scoreTokens[1]}`);
    await expect(
      fed.getByRole("region", { name: "Your Flight" }).getByRole("region", { name: "Flight A · Courts 16 & 19" }),
    ).toBeVisible();
  } finally {
    await deleteTeamEventOrganizer(night);
  }
});
