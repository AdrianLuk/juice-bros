import { expect, test, type Browser, type Page } from "@playwright/test";

import { AMY, BEN2, TEST_PASSWORD, signIn } from "./support/sign-in.ts";
import {
  deleteAvailabilityWindows,
  insertAvailabilityWindow,
} from "./support/availability.ts";

/**
 * "Find a time" (issue #195) — Plan's third child. Pick friends who share their
 * availability, see when everyone's free, deep-link into the Games form. Plus
 * the "Looking to play" surfaces that hang off the same visibility gate (#230):
 * the Games page's "Friends looking to play" pool and the Find-a-time nudge.
 *
 * The seeded `@amyace` ↔ `@benbackhand2` pair starts at the visibility
 * lattice's bottom (see booking-buddy/docs/local-test-accounts.md), so each
 * test first has BEN2 put AMY in an `open_time` group, torn down after.
 * `@amyace` ↔ `@benbackhand` stays at the bottom — that pair is the negative
 * case: a friend with no grant never appears in the picker.
 *
 * BEN2's grant is done in its own browser context — `signIn` bounces off the
 * sign-in page when a session already exists, so one context can't switch
 * users (same reason slots.spec.ts opens a second context for Ben2).
 */

const PREFIX = "PlaywrightOverlap";

const groupName = () =>
  `${PREFIX} ${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

/** As BEN2, in a fresh context, grant AMY `open_time` through a new group. */
async function grantAmyOpenTime(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  try {
    const ben2 = await context.newPage();
    const name = groupName();
    await signIn(ben2, BEN2, "/booking-buddy/groups");
    await ben2.getByLabel("Group name").fill(name);
    await ben2.getByLabel("What they can see").selectOption("open_time");
    await ben2.getByRole("button", { name: "Create group" }).click();
    await expect(ben2.getByRole("heading", { name })).toBeVisible();

    const card = ben2.locator("section").filter({ hasText: name }).last();
    const picker = card.getByLabel("Add a friend");
    const value = await picker
      .locator("option", { hasText: "(@amyace)" })
      .getAttribute("value");
    await picker.selectOption(value!);
    await card.getByRole("button", { name: "Add" }).click();
    await expect(card).toContainText("1 friend");
  } finally {
    await context.close();
  }
}

/** The friend picker row for one handle — `(@handle)` so `@benbackhand` doesn't also match `@benbackhand2`. */
function friendCheckbox(page: Page, handle: string) {
  return page
    .locator("label")
    .filter({ hasText: `(@${handle})` })
    .getByRole("checkbox");
}

test.afterEach(async ({ browser }) => {
  await deleteAvailabilityWindows({ email: BEN2, password: TEST_PASSWORD });
  await deleteAvailabilityWindows({ email: AMY, password: TEST_PASSWORD });

  // Sweep any group a failed run left behind — each grants AMY visibility she
  // shouldn't keep.
  const context = await browser.newContext();
  try {
    const ben2 = await context.newPage();
    await signIn(ben2, BEN2, "/booking-buddy/groups");
    const strays = ben2.getByRole("heading", { name: new RegExp(`^${PREFIX} `) });
    for (let left = await strays.count(); left > 0; left--) {
      const name = (await strays.first().textContent())!;
      const card = ben2.locator("section").filter({ hasText: name }).last();
      await card.getByRole("button", { name: "Delete" }).click();
      await ben2.getByRole("button", { name: "Delete group" }).click();
      await expect(ben2.getByRole("heading", { name })).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});

test("only friends who share their availability show in the picker", async ({
  page,
  browser,
}) => {
  await grantAmyOpenTime(browser);

  await signIn(page, AMY, "/booking-buddy/overlap");

  await expect(
    page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Find a time" }),
  ).toHaveAttribute("aria-current", "page");

  await expect(friendCheckbox(page, "benbackhand2")).toBeVisible();
  await expect(
    page.locator("label").filter({ hasText: "(@benbackhand)" }),
  ).toHaveCount(0);
});

test("free days appear, then a friend's busy window carves them away", async ({
  page,
  browser,
}) => {
  await grantAmyOpenTime(browser);

  await signIn(page, AMY, "/booking-buddy/overlap");
  await friendCheckbox(page, "benbackhand2").check();

  // Nobody's marked anything busy, so the range is free — at least one day
  // with a "Propose a game" action.
  const propose = page.getByRole("link", { name: "Propose a game" });
  await expect(propose.first()).toBeVisible();

  // The deep-link carries a date, and the Games form opens with it prefilled.
  const href = await propose.first().getAttribute("href");
  const date = new URL(href!, "http://localhost").searchParams.get("date");
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await propose.first().click();
  await page.waitForURL(/\/booking-buddy\/slots(\?|#|$)/);
  await expect(page.getByLabel("Date")).toHaveValue(date!);

  // BEN2 blocks off the whole range, in any timezone. Now nothing overlaps.
  await insertAvailabilityWindow(
    { email: BEN2, password: TEST_PASSWORD },
    {
      type: "busy",
      startsAt: new Date(Date.now() - 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 40 * 86_400_000).toISOString(),
    },
  );

  await page.goto("/booking-buddy/overlap");
  await friendCheckbox(page, "benbackhand2").check();
  await expect(
    page.getByText("No shared free time in this range"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Propose a game" })).toHaveCount(0);
});

test("the Games page lists a friend who's looking to play, with a prefilled Propose link", async ({
  page,
  browser,
}) => {
  await signIn(page, AMY, "/booking-buddy/slots");
  // Before BEN2 grants anything, the pool is empty and says so.
  await expect(
    page.getByText("Nobody's marked themselves looking to play right now"),
  ).toBeVisible();

  await grantAmyOpenTime(browser);

  // BEN2 marks a 3-hour "looking to play" window two days out, 6-9pm local.
  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setHours(21, 0, 0, 0);
  const targetDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  await insertAvailabilityWindow(
    { email: BEN2, password: TEST_PASSWORD },
    { type: "looking", startsAt: start.toISOString(), endsAt: end.toISOString() },
  );

  await page.goto("/booking-buddy/slots");
  await expect(
    page.getByRole("heading", { name: "Friends looking to play" }),
  ).toBeVisible();

  // The only "Propose a game" link on the Games page is the looking-to-play
  // pool's — "Post a game" is a submit button, and the slot lists are plain rows.
  const propose = page.getByRole("link", { name: "Propose a game" });
  await expect(propose).toHaveCount(1);
  const href = await propose.getAttribute("href");
  expect(new URL(href!, "http://localhost").searchParams.get("date")).toBe(targetDate);

  await propose.click();
  await page.waitForURL(/\/booking-buddy\/slots(\?|#|$)/);
  await expect(page.getByLabel("Date")).toHaveValue(targetDate);
  // 6-9pm window: Start and a matching 3-hour Duration both prefilled.
  await expect(page.getByLabel("Start")).toHaveValue("18:00");
  await expect(
    page.getByRole("radio", { name: "3 hours", checked: true }),
  ).toBeVisible();

  // The form is scrolled to, not left below three sections of list.
  await expect(async () => {
    const inView = await page
      .locator("#post-a-game")
      .evaluate((el) => {
        const { top, bottom } = el.getBoundingClientRect();
        return top < window.innerHeight && bottom > 0;
      });
    expect(inView).toBe(true);
  }).toPass();
});

test("Find a time flags a free block a picked friend is looking over", async ({
  page,
  browser,
}) => {
  await grantAmyOpenTime(browser);

  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setHours(21, 0, 0, 0);
  await insertAvailabilityWindow(
    { email: BEN2, password: TEST_PASSWORD },
    { type: "looking", startsAt: start.toISOString(), endsAt: end.toISOString() },
  );

  await signIn(page, AMY, "/booking-buddy/overlap");
  await friendCheckbox(page, "benbackhand2").check();

  await expect(page.getByText(/looking to play$/).first()).toBeVisible();
});

test("a day with a midday busy stretch splits into a window before and after, each proposable", async ({
  page,
  browser,
}) => {
  await grantAmyOpenTime(browser);

  // BEN2 is busy 12:00-14:00 local, three days out.
  const target = new Date();
  target.setDate(target.getDate() + 3);
  target.setHours(12, 0, 0, 0);
  const end = new Date(target);
  end.setHours(14, 0, 0, 0);
  const targetDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;

  await insertAvailabilityWindow(
    { email: BEN2, password: TEST_PASSWORD },
    { type: "busy", startsAt: target.toISOString(), endsAt: end.toISOString() },
  );

  await signIn(page, AMY, "/booking-buddy/overlap");
  await friendCheckbox(page, "benbackhand2").check();
  await expect(
    page.getByRole("heading", { name: "When you're all free" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Propose a game" }).first()).toBeVisible();

  // That one day carries two "Propose a game" links, seeding different start
  // times — a window before the busy stretch and one after (14:00).
  const starts = await page
    .getByRole("link", { name: "Propose a game" })
    .evaluateAll(
      (links, date) =>
        (links as HTMLAnchorElement[])
          .map((a) => new URL(a.href))
          .filter((u) => u.searchParams.get("date") === date)
          .map((u) => u.searchParams.get("start")),
      targetDate,
    );

  expect(starts).toHaveLength(2);
  expect(new Set(starts).size).toBe(2);
  expect(starts).toContain("14:00");
});
