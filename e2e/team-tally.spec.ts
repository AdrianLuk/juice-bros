import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Team Tally: the first runnable slice (issue #622).
 *
 *   - Team Tally is on the Tools shelf, and its landing renders signed out;
 *   - an Organizer signs in, builds a four-Team event in the setup form, sees
 *     the Brief, and copies it;
 *   - the Team Event is then on their list.
 *
 * A throwaway account per run, never deleted (there is no delete-account
 * feature), the same posture as `on-deck-create-club.spec.ts`. Its Team
 * Events are only ever reachable by that account. Names are PPA Tour pros:
 * this repo is public.
 */
const ORGANIZER_EMAIL = `team-tally-${Date.now()}@example.com`;
const ORGANIZER_PASSWORD = "pickleball123";

const TEAMS = [
  { captain: "Ben Johns", slots: ["Anna Leigh Waters", "Collin Johns", "Anna Bright"], nickname: "Golden Set", court: "16" },
  { captain: "Federico Staksrud", slots: ["Catherine Parenteau", "Andrei Daescu", "Jorja Johnson"], nickname: "", court: "19" },
  { captain: "Hayden Patriquin", slots: ["Tyra Black", "Gabriel Tardio", "Lea Jansen"], nickname: "Kitchen Kings", court: "17" },
  { captain: "Christian Alshon", slots: ["Jessie Irvine", "JW Johnson", "Kaitlyn Christian"], nickname: "", court: "18" },
];

test("Team Tally is on the Tools shelf and its landing renders signed out", async ({ page }) => {
  await page.goto("/tools");
  await page.getByRole("link", { name: /Open Team Tally/ }).click();

  await expect(page).toHaveURL(/\/tools\/team-tally$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Scoring for captained team nights" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to build a night" })).toBeVisible();
});

test("a signed-out visitor to a Team Event is sent to sign in", async ({ page }) => {
  await page.goto("/tools/team-tally/events/new");
  await expect(page).toHaveURL(/\/tools\/team-tally\/sign-in\?next=/);
});

/** Fills a controlled field until the value holds, in case hydration wiped it. */
async function fillUntilSet(field: Locator, value: string): Promise<void> {
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value, { timeout: 500 });
  }).toPass({ timeout: 15_000 });
}

async function fillTeam(page: Page, legend: string, team: (typeof TEAMS)[number]) {
  const group = page.getByRole("group", { name: legend });
  await fillUntilSet(group.getByLabel("Captain"), team.captain);
  await fillUntilSet(group.getByLabel("Player A"), team.slots[0]);
  await fillUntilSet(group.getByLabel("Player B"), team.slots[1]);
  await fillUntilSet(group.getByLabel("Player C"), team.slots[2]);
  if (team.nickname) {
    await fillUntilSet(group.getByLabel("Nickname"), team.nickname);
  }
  await fillUntilSet(group.getByLabel("Home court"), team.court);
}

test("an Organizer signs in, builds a four-Team event and copies its brief", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/tools/team-tally/sign-in");
  await page.getByRole("button", { name: "Create an account with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your Team Events" })).toBeVisible();
  await page.getByRole("link", { name: "New Team Event" }).click();

  await fillUntilSet(page.getByLabel("Name of the night"), "Tuesday Team Night");
  await fillTeam(page, "Match 1, team 1", TEAMS[0]);
  await fillTeam(page, "Match 1, team 2", TEAMS[1]);
  await fillTeam(page, "Match 2, team 1", TEAMS[2]);
  await fillTeam(page, "Match 2, team 2", TEAMS[3]);
  // The court pair is worked out from the two home courts as they are typed.
  await expect(page.getByText("Courts 16 & 19")).toBeVisible();

  await page.getByRole("button", { name: "Save and write the brief" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Tuesday Team Night" })).toBeVisible();
  const brief = page.getByLabel("The brief");
  await expect(brief).toContainText("🏓 MATCH 1 — Courts 16 & 19");
  await expect(brief).toContainText("🔴 Team Ben Johns — “Golden Set”");
  await expect(brief).toContainText("Hayden Patriquin • Tyra Black • Gabriel Tardio • Lea Jansen");

  await page.getByRole("button", { name: "Copy brief" }).click();
  await expect(page.getByText("Copied. Paste it into the group chat.")).toBeVisible();

  // The OS clipboard on Windows hands newlines back as CRLF.
  const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  expect(copied.startsWith("🏓🔥 PICKLEBALL TEAM EVENT 🔥🏓")).toBe(true);
  expect(copied).toContain("🏓 MATCH 2 — Courts 17 & 18");
  // A Team with no nickname prints no quoted part.
  expect(copied).toContain("🔵 Team Federico Staksrud\n");
  expect(copied).toMatch(/📺 Live standings: http\S+\/tools\/team-tally\/live\/[0-9a-f]{32}/);
  expect(copied.match(/🔗 Score link: http\S+\/tools\/team-tally\/score\/[0-9a-f]{32}/g)).toHaveLength(4);
  expect(copied).toContain("🅰️ Top 2 teams → Flight A\n🅱️ Next 2 teams → Flight B\n\n");

  await page.getByRole("link", { name: "Back to your Team Events" }).click();
  await expect(page.getByRole("link", { name: /Tuesday Team Night/ })).toBeVisible();
});
