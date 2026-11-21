import { expect, test, type Locator } from "@playwright/test";

/**
 * Team Tally: paste an old brief (issue #626).
 *
 * An Organizer pastes a brief written before Team Tally, in the older
 * layout; the setup form fills from it; the one thing it could not read is
 * highlighted; they fix it and save. Names are PPA Tour pros: this repo is
 * public.
 */
const ORGANIZER_EMAIL = `team-tally-paste-${Date.now()}@example.com`;
const ORGANIZER_PASSWORD = "pickleball123";

// Older layout: nickname in parentheses, court on the Team line, varied
// spacing around the dash and the bullets. Match 2's second roster is a name
// short, which the form has to flag instead of refusing the paste.
const OLD_BRIEF = [
  "PICKLEBALL TEAM EVENT",
  "👥 TEAM MATCHUPS",
  "",
  "🏓 Match 1 — Courts 10 & 13",
  "🔴 Team Ben (Just4Fun)— Court 10",
  "Ben• Anna Leigh Waters • Collin Johns • Anna Bright",
  "🆚",
  "",
  "🔵 Team Federico— Court 13",
  "Federico • Catherine Parenteau • Andrei Daescu • Jorja Johnson",
  "",
  "🏓 Match 2 — Courts 15 & 12",
  "🔴 Team Hayden (Unstrung Heroes) — Court 15",
  "Hayden • Tyra Black • Gabriel Tardio • Lea Jansen",
  "🆚",
  "",
  "🔵 Team Christian — Court 12",
  "Christian • Jessie Irvine • JW Johnson",
  "",
  "🔄 ROUND FORMAT",
].join("\n");

/** Fills a controlled field until the value holds, in case hydration wiped it. */
async function fillUntilSet(field: Locator, value: string): Promise<void> {
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value, { timeout: 500 });
  }).toPass({ timeout: 15_000 });
}

test("an Organizer pastes an old brief, checks the form it fills, and saves", async ({ page }) => {
  await page.goto("/tools/team-tally/sign-in");
  await page.getByRole("button", { name: "Create an account with a password" }).click();
  await page.getByLabel("Email").fill(ORGANIZER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your Team Events" })).toBeVisible();
  await page.getByRole("link", { name: "New Team Event" }).click();

  // Something already in the form, so the paste has to ask first.
  await fillUntilSet(page.getByLabel("Name of the night"), "Tuesday Team Night");
  const firstTeam = page.getByRole("group", { name: "Match 1, team 1" });
  await fillUntilSet(firstTeam.getByLabel("Captain"), "Someone Else");

  const paste = page.getByLabel("Paste an old brief");
  await fillUntilSet(paste, OLD_BRIEF);
  await page.getByRole("button", { name: "Fill the form from this brief" }).click();

  // The form is untouched until the Organizer confirms.
  const confirm = page.getByRole("alertdialog", { name: "Replace the Teams in the form" });
  await expect(confirm).toContainText("Replace them with the 2 Matches");
  await expect(firstTeam.getByLabel("Captain")).toHaveValue("Someone Else");
  await confirm.getByRole("button", { name: "Keep what is there" }).click();
  await expect(confirm).toBeHidden();
  await expect(firstTeam.getByLabel("Captain")).toHaveValue("Someone Else");

  await page.getByRole("button", { name: "Fill the form from this brief" }).click();
  await page.getByRole("button", { name: "Replace the form" }).click();

  // The Teams, nicknames, home courts and court pairs are in the form.
  await expect(page.getByText("Courts 10 & 13")).toBeVisible();
  await expect(page.getByText("Courts 15 & 12")).toBeVisible();
  await expect(firstTeam.getByLabel("Captain")).toHaveValue("Ben");
  await expect(firstTeam.getByLabel("Nickname")).toHaveValue("Just4Fun");
  await expect(firstTeam.getByLabel("Home court")).toHaveValue("10");
  await expect(firstTeam.getByLabel("Player A")).toHaveValue("Anna Leigh Waters");
  const secondTeam = page.getByRole("group", { name: "Match 1, team 2" });
  await expect(secondTeam.getByLabel("Captain")).toHaveValue("Federico");
  await expect(secondTeam.getByLabel("Nickname")).toHaveValue("");
  await expect(page.getByLabel("Name of the night")).toHaveValue("Tuesday Team Night");

  // The roster that came up one name short: Player C is blank and highlighted.
  await expect(page.getByRole("status")).toContainText("1 field could not be read");
  const lastTeam = page.getByRole("group", { name: "Match 2, team 2" });
  const playerC = lastTeam.getByLabel("Player C");
  await expect(playerC).toHaveValue("");
  await expect(playerC).toHaveAttribute("aria-invalid", "true");
  await expect(lastTeam.getByLabel("Player B")).not.toHaveAttribute("aria-invalid", "true");

  await fillUntilSet(playerC, "Kaitlyn Christian");
  await expect(playerC).not.toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: "Save and write the brief" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Tuesday Team Night" })).toBeVisible();
  const brief = page.getByLabel("The brief");
  await expect(brief).toContainText("🏓 MATCH 1 — Courts 10 & 13");
  await expect(brief).toContainText("🔴 Team Ben — “Just4Fun”");
  await expect(brief).toContainText("Christian • Jessie Irvine • JW Johnson • Kaitlyn Christian");
});
