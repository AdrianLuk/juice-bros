import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Pickle Point Pal is client-side only (no auth, no Supabase) — every test
 * here starts from a clean `localStorage`, which Playwright already gives us
 * for free via a fresh browser context per test.
 */
const ROUTE = "/tools/pickle-point-pal";

async function openSetup(page: Page) {
  await page.goto(ROUTE);
  await expect(page.getByRole("heading", { name: "New match" })).toBeVisible();
}

/**
 * Fills in the setup screen and submits it. Only deviates from the shipped
 * defaults (doubles, side-out, 15, best of 1) where a test asks for it — most
 * tests want the fastest possible game, so `pointsToWin: 11` singles is the
 * common case.
 */
async function setupMatch(
  page: Page,
  {
    doubles = false,
    pointsToWin = 11,
    names,
  }: {
    doubles?: boolean;
    pointsToWin?: 11 | 15 | 21;
    names: { A: [string, string?]; B: [string, string?] };
  }
) {
  await openSetup(page);

  const players = page.getByRole("radiogroup", { name: "Players" });
  await players.getByRole("radio", { name: doubles ? "Doubles" : "Singles" }).click();

  if (pointsToWin !== 15) {
    await page
      .getByRole("radiogroup", { name: "Points to win" })
      .getByRole("radio", { name: String(pointsToWin), exact: true })
      .click();
  }

  if (doubles) {
    await page.getByLabel("Team A player 1").fill(names.A[0]!);
    await page.getByLabel("Team A player 2").fill(names.A[1]!);
    await page.getByLabel("Team B player 1").fill(names.B[0]!);
    await page.getByLabel("Team B player 2").fill(names.B[1]!);
  } else {
    await page.getByLabel("Team A player").fill(names.A[0]!);
    await page.getByLabel("Team B player").fill(names.B[0]!);
  }

  await page.getByRole("button", { name: "Continue to coin toss" }).click();
}

/**
 * Resolves the coin toss the same way every time: the named team wins the
 * toss and elects to serve. The "who called it" step and the draw itself
 * carry no weight in `reduceMatch` (only the recorded winner/server do), so
 * skipping them here isn't cutting a corner a ref would notice — the toss
 * screens that *do* drive state get their own coverage in the doubles test.
 */
async function decideCoinToss(page: Page, winnerLabel: string) {
  await page
    .getByRole("radiogroup", { name: "Who won the toss?" })
    .getByRole("radio", { name: winnerLabel, exact: true })
    .click();
  await page.getByRole("button", { name: /^Serve\b/ }).click();
}

/** The rally button for a team, found by the first name printed on it. */
function rallyButton(page: Page, firstPlayerName: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^${firstPlayerName}\\b`) });
}

function scoreCall(page: Page, serving: number, receiving: number, serverNumber?: 1 | 2): Locator {
  const label =
    serverNumber === undefined
      ? `Score ${serving} ${receiving}`
      : `Score ${serving} ${receiving} server ${serverNumber}`;
  return page.locator(`[aria-label="${label}"]`);
}

test("a singles match can be played rally by rally through to the summary", async ({ page }) => {
  await setupMatch(page, { pointsToWin: 11, names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");

  await expect(scoreCall(page, 0, 0)).toBeVisible();
  await expect(page.getByText("Amy serving")).toBeVisible();

  const amy = rallyButton(page, "Amy");
  for (let point = 1; point <= 10; point++) {
    await amy.click();
    await expect(scoreCall(page, point, 0)).toBeVisible();
  }

  // The 11th point both wins the game and, at best-of-1, the match — so the
  // sheet skips straight to "Confirm match result" instead of the next-game
  // wording.
  await amy.click();
  const gameOverSheet = page.locator("div.fixed.inset-0.z-40");
  await expect(gameOverSheet.getByText("Amy wins")).toBeVisible();
  await expect(gameOverSheet.getByText("11-0", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Confirm match result" }).click();

  await expect(page.getByText("Match complete", { exact: true })).toBeVisible();
  // The per-game score row, not the match log entry underneath it that also
  // mentions "Game 1" — scoped by the row's own layout class.
  await expect(
    page.locator("li.flex.items-baseline.justify-between").filter({ hasText: "Game 1" })
  ).toContainText("11-0");
  await expect(page.getByRole("button", { name: "Start a new match" })).toBeVisible();
});

test("undo reverses the last rally and redo restores it", async ({ page }) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");

  await rallyButton(page, "Amy").click();
  await expect(scoreCall(page, 1, 0)).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(scoreCall(page, 0, 0)).toBeVisible();

  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(scoreCall(page, 1, 0)).toBeVisible();
});

test("a standard timeout counts against the allowance and can be paused, resumed, and ended", async ({
  page,
}) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");

  const amyTimeoutButton = page.getByRole("button", { name: /^T\/O · Amy/ });
  await expect(amyTimeoutButton.locator('[aria-label="2 timeouts remaining"]')).toBeVisible();

  await amyTimeoutButton.click();
  await expect(amyTimeoutButton.locator('[aria-label="1 timeouts remaining"]')).toBeVisible();

  // The overlay's own "Undo" button shares an accessible name with the
  // action bar's, which stays mounted (just visually covered) underneath —
  // scope to the overlay so the click lands on the visible one.
  const overlay = page.locator("div.fixed.inset-0.z-40");
  await expect(overlay.getByText("standard timeout", { exact: true })).toBeVisible();
  await expect(overlay).toContainText("1st timeout");
  await expect(overlay).toContainText("1 left");
  await expect(overlay.getByText(/^\d:\d{2}$/)).toBeVisible();

  await overlay.getByRole("button", { name: "Pause clock" }).click();
  await expect(overlay.getByText("Paused", { exact: true })).toBeVisible();

  await overlay.getByRole("button", { name: "Start clock" }).click();
  await expect(overlay.getByText("Paused", { exact: true })).toHaveCount(0);

  await overlay.getByRole("button", { name: "End timeout" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(rallyButton(page, "Amy")).toBeEnabled();
});

test("a technical foul scores the opponent without changing serve, and warnings just tally", async ({
  page,
}) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");

  await page.getByRole("button", { name: "Technical" }).click();
  await page.getByRole("button", { name: /^Warning — Ben/ }).click();
  // Anchored to the tally line's own leading text — the explainer copy below
  // the tool (`pickle-point-pal-about.tsx`, added in #174) also contains the
  // words "technical warnings", so a bare substring match is ambiguous.
  await expect(page.getByText(/^Technical warnings ·/)).toContainText("Amy: 0 · Ben: 1");

  // A foul on Ben scores the opponent (Amy) without a side out — Amy was
  // already serving, so a point here is the whole visible effect.
  await page.getByRole("button", { name: "Technical" }).click();
  await page.getByRole("button", { name: /^Technical foul — Ben/ }).click();
  await expect(scoreCall(page, 1, 0)).toBeVisible();
  await expect(page.getByText("Amy serving")).toBeVisible();
});

test("the match log records the coin toss and every rally, and can be closed", async ({ page }) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");
  await rallyButton(page, "Amy").click();

  await page.getByRole("button", { name: "Log" }).click();
  await expect(page.getByRole("heading", { name: "Match log" })).toBeVisible();
  await expect(page.getByText("Coin toss", { exact: true })).toBeVisible();
  await expect(page.getByText("Point — Amy", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Match log" })).toHaveCount(0);
});

test("ending a match early marks the summary accordingly, and can still be undone", async ({
  page,
}) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");
  await rallyButton(page, "Amy").click();

  await page.getByRole("button", { name: "End Match" }).click();
  await page.getByRole("button", { name: "End match now" }).click();

  // The same phrase also appears as a log-entry label further down the
  // summary page, so scope to the status line specifically.
  await expect(page.locator("p").filter({ hasText: "Match ended early" })).toBeVisible();

  await page.getByRole("button", { name: "Undo — the match isn't over" }).click();
  await expect(rallyButton(page, "Amy")).toBeVisible();
  await expect(scoreCall(page, 1, 0)).toBeVisible();
});

test("a match in progress survives a reload and can be resumed at the same score", async ({
  page,
}) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");
  const amy = rallyButton(page, "Amy");
  await amy.click();
  await amy.click();
  await expect(scoreCall(page, 2, 0)).toBeVisible();

  await page.reload();

  await expect(page.getByRole("heading", { name: "Match in progress" })).toBeVisible();
  // The prompt shows the score it would restore to, not a generic message —
  // that's what a ref is actually checking before committing to it.
  await expect(page.getByText("Amy")).toBeVisible();
  await expect(page.getByText("2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Resume this match" }).click();
  await expect(scoreCall(page, 2, 0)).toBeVisible();
});

test("discarding a saved match on the resume prompt starts a fresh setup screen", async ({ page }) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");
  await rallyButton(page, "Amy").click();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Match in progress" })).toBeVisible();

  await page.getByRole("button", { name: "Discard and start fresh" }).click();
  await expect(page.getByRole("heading", { name: "New match" })).toBeVisible();

  // The discard actually cleared storage, not just the in-memory phase — a
  // reload should land back on setup rather than re-offering the same save.
  await page.reload();
  await expect(page.getByRole("heading", { name: "New match" })).toBeVisible();
});

test("swap sides flips which team's rally button reads as on the left", async ({ page }) => {
  await setupMatch(page, { names: { A: ["Amy"], B: ["Ben"] } });
  await decideCoinToss(page, "Amy");

  const swap = page.getByRole("button", { name: /^Swap sides/ });
  await expect(swap).toHaveAccessibleName(/Amy is currently on your left/);

  await swap.click();
  await expect(swap).toHaveAccessibleName(/Ben is currently on your left/);
});

test("doubles side-out scoring runs the two-server rotation before a side out", async ({ page }) => {
  await setupMatch(page, {
    doubles: true,
    pointsToWin: 11,
    names: { A: ["Amy", "Beth"], B: ["Cam", "Dee"] },
  });
  await decideCoinToss(page, "Amy / Beth");

  // Doubles side-out shows the server number; singles and rally scoring
  // don't, so this is the one test that exercises that third digit. The
  // very first service turn of the game only carries one server (the real
  // rule this app is modelling), so it opens at 2, not 1 — a receiving-team
  // win right now is an immediate side out rather than a second serve.
  await expect(scoreCall(page, 0, 0, 2)).toBeVisible();
  await expect(page.getByText("Amy / Beth serving")).toBeVisible();

  const camDee = rallyButton(page, "Cam");
  const amyBeth = rallyButton(page, "Amy");

  await camDee.click();
  await expect(scoreCall(page, 0, 0, 1)).toBeVisible();
  await expect(page.getByText("Cam / Dee serving")).toBeVisible();

  // From here on it's a normal game: first server up, a receiving-team win
  // is a second serve — no score change, server number moves to 2.
  await amyBeth.click();
  await expect(scoreCall(page, 0, 0, 2)).toBeVisible();
  await expect(page.getByText("Cam / Dee serving")).toBeVisible();

  // Second server up: now a receiving-team win is a real side out.
  await amyBeth.click();
  await expect(scoreCall(page, 0, 0, 1)).toBeVisible();
  await expect(page.getByText("Amy / Beth serving")).toBeVisible();

  // Serving team scoring doesn't touch the server number at all.
  await amyBeth.click();
  await expect(scoreCall(page, 1, 0, 1)).toBeVisible();
  await expect(page.getByText("Amy / Beth serving")).toBeVisible();
});
