import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Team Tally: each Matchup's Court pair tapped on a Venue map (issue #698).
 *
 *   - an Organizer draws a Venue in setup and saves it to their account;
 *   - they tap each Matchup's pair, red then blue: only a touching court
 *     pairs, a court another Matchup holds jumps to it, and placing a pair
 *     moves on to the next Matchup;
 *   - the Brief prints the tapped courts, and the edit page opens on the Venue.
 *
 * A throwaway account per run, as in `team-tally.spec.ts`. Names are PPA
 * Tour pros: this repo is public.
 */
const ORGANIZER_EMAIL = `team-tally-venue-${Date.now()}@example.com`;
const ORGANIZER_PASSWORD = "pickleball123";

const TEAMS = [
  { captain: "Ben Johns", slots: ["Anna Leigh Waters", "Collin Johns", "Anna Bright"] },
  { captain: "Federico Staksrud", slots: ["Catherine Parenteau", "Andrei Daescu", "Jorja Johnson"] },
  { captain: "Hayden Patriquin", slots: ["Tyra Black", "Gabriel Tardio", "Lea Jansen"] },
  { captain: "Christian Alshon", slots: ["Jessie Irvine", "JW Johnson", "Kaitlyn Christian"] },
];

/** Fills a controlled field until the value holds, in case hydration wiped it. */
async function fillUntilSet(field: Locator, value: string): Promise<void> {
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value, { timeout: 500 });
  }).toPass({ timeout: 15_000 });
}

async function fillPlayers(page: Page, legend: string, team: (typeof TEAMS)[number]) {
  const group = page.getByRole("group", { name: legend });
  await fillUntilSet(group.getByLabel("Captain"), team.captain);
  await fillUntilSet(group.getByLabel("Player A"), team.slots[0]);
  await fillUntilSet(group.getByLabel("Player B"), team.slots[1]);
  await fillUntilSet(group.getByLabel("Player C"), team.slots[2]);
}

test("an Organizer draws a Venue, taps each Match's pair, and the Brief prints those courts", async ({ page }) => {
  await page.goto("/tools/team-tally/sign-in");
  await page.getByRole("button", { name: "Create an account with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your Team Events" })).toBeVisible();
  await page.getByRole("link", { name: "New Team Event" }).click();

  await fillUntilSet(page.getByLabel("Name of the night"), "Tuesday Team Night");
  await fillPlayers(page, "Match 1, team 1", TEAMS[0]);
  await fillPlayers(page, "Match 1, team 2", TEAMS[1]);
  await fillPlayers(page, "Match 2, team 1", TEAMS[2]);
  await fillPlayers(page, "Match 2, team 2", TEAMS[3]);

  // A new account has no Venue, so setup starts on typed home courts.
  const courts = page.getByRole("region", { name: "Courts" });
  await expect(courts.getByLabel("Venue", { exact: true })).toHaveValue("");

  // Draw a 2 x 2 hall:  1 2
  //                     3 4
  await courts.getByRole("button", { name: "Draw a new venue" }).click();
  await courts.getByRole("button", { name: "2 x 2" }).click();
  await fillUntilSet(courts.getByLabel("Venue name"), "Rec Centre North");
  await courts.getByRole("button", { name: "Save venue" }).click();
  await expect(courts.getByLabel("Venue", { exact: true })).toHaveValue(/.+/);
  await expect(courts.getByRole("status").filter({ hasText: "Saved Rec Centre North." })).toBeVisible();

  const map = courts.getByRole("group", { name: "Venue map" });
  const court = (number: number) => map.getByRole("button", { name: new RegExp(`^Court ${number},`) });
  const match = (number: number) => courts.getByRole("button", { name: new RegExp(`^Match ${number}`) });

  await expect(match(1)).toHaveAttribute("aria-current", "step");
  await court(1).click();
  await expect(court(1)).toHaveAccessibleName(/Team Ben Johns's home court/);
  // 4 meets 1 only at a corner, so it starts the pair again from 4.
  await court(4).click();
  await expect(court(4)).toHaveAccessibleName(/Team Ben Johns's home court/);
  await expect(court(1)).toHaveAccessibleName(/free/);
  // Tapping the red court again takes it back.
  await court(4).click();
  await expect(court(4)).toHaveAccessibleName(/free/);

  await court(1).click();
  await expect(court(2)).toHaveAccessibleName(/touches court 1/);
  await court(2).click();
  await expect(match(1)).toContainText("Courts 1 & 2");
  // The pair placed, the next Match without courts is up.
  await expect(match(2)).toHaveAttribute("aria-current", "step");
  await expect(court(1)).toHaveAccessibleName(/taken by Match 1/);

  // A court another Match holds jumps to that Match.
  await court(1).click();
  await expect(match(1)).toHaveAttribute("aria-current", "step");
  await match(2).click();

  await court(3).click();
  await court(4).click();
  await expect(match(2)).toContainText("Courts 3 & 4");

  // The taps filled in each Team's Home court box.
  await expect(page.getByRole("group", { name: "Match 1, team 1" }).getByLabel("Home court")).toHaveValue("1");
  await expect(page.getByRole("group", { name: "Match 1, team 2" }).getByLabel("Home court")).toHaveValue("2");
  await expect(page.getByRole("group", { name: "Match 2, team 2" }).getByLabel("Home court")).toHaveValue("4");

  await page.getByRole("button", { name: "Save and write the brief" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tuesday Team Night" })).toBeVisible();
  const brief = page.getByLabel("The brief");
  await expect(brief).toContainText("🏓 MATCH 1 — Courts 1 & 2");
  await expect(brief).toContainText("🏓 MATCH 2 — Courts 3 & 4");

  // Editing the night opens on the Venue holding its courts.
  await page.goto(page.url().replace(/\/?$/, "/edit"));
  const editCourts = page.getByRole("region", { name: "Courts" });
  await expect(editCourts.getByRole("button", { name: /^Match 1/ })).toContainText("Courts 1 & 2");
  await expect(editCourts.getByRole("button", { name: /^Match 2/ })).toContainText("Courts 3 & 4");

  // A new night opens on the Venue saved last; a pasted brief lands on its
  // map, and a court the Venue has no court for keeps its text, flagged.
  await page.goto("/tools/team-tally/events/new");
  const newCourts = page.getByRole("region", { name: "Courts" });
  await expect(newCourts.getByRole("group", { name: "Venue map" })).toBeVisible();
  await fillUntilSet(page.getByLabel("Paste an old brief"), PASTED_BRIEF);
  await page.getByRole("button", { name: "Fill the form from this brief" }).click();
  await expect(page.getByText("1 home court is not on Rec Centre North and is highlighted.")).toBeVisible();
  await expect(newCourts.getByRole("button", { name: /^Match 1/ })).toContainText("Courts 1 & 2");
  await expect(newCourts.getByRole("button", { name: /^Match 2/ })).toContainText("Court 3 & ?");
  const offMap = page.getByRole("group", { name: "Match 2, team 2" }).getByLabel("Home court");
  await expect(offMap).toHaveValue("9");
  await expect(offMap).toHaveAttribute("aria-invalid", "true");
});

const PASTED_BRIEF = [
  "👥 TEAM MATCHUPS",
  "",
  "🏓 MATCH 1 — Courts 1 & 2",
  "🔴 Team Ben Johns — Court 1",
  "Ben Johns • Anna Leigh Waters • Collin Johns • Anna Bright",
  "🆚",
  "🔵 Team Federico Staksrud — Court 2",
  "Federico Staksrud • Catherine Parenteau • Andrei Daescu • Jorja Johnson",
  "",
  "🏓 MATCH 2 — Courts 3 & 9",
  "🔴 Team Hayden Patriquin — Court 3",
  "Hayden Patriquin • Tyra Black • Gabriel Tardio • Lea Jansen",
  "🆚",
  "🔵 Team Christian Alshon — Court 9",
  "Christian Alshon • Jessie Irvine • JW Johnson • Kaitlyn Christian",
  "",
  "🔄 ROUND FORMAT",
].join("\n");
