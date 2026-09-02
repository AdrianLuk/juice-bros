import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { row } from "./support/places.ts";
import { CalendarFeedMock, icsBody } from "./support/calendar-feed-mock.ts";
import {
  bookingsForOrg,
  clearFeedUrlViaForm,
  deleteFacilities,
  feedEventsForOrg,
  feedSection,
  seedFacility,
  setFeedUrlViaForm,
  syncFacilities,
} from "./support/calendar-feed.ts";

/**
 * The Calendar Feed user-facing surface (issue #295) — the Facility-form feed
 * field and the Bookings-page "From facility feeds" review section, driven
 * against a local ICS mock.
 *
 * Runs as Amy, who is *not* on `EMAIL_SYNC_ALLOWLIST` for any worker — a
 * Calendar Feed isn't allowlist-gated (ADR-0019), and this proves it. Every
 * Facility created here is `Playwright FeedX`-named and swept in `afterEach`.
 */

const PREFIX = "Playwright Feed";
const CLUB = "Playwright Feed Club";

let mock: CalendarFeedMock;

test.beforeAll(async () => {
  mock = new CalendarFeedMock();
  await mock.start();
});

test.afterAll(async () => {
  await mock.stop();
});

test.beforeEach(() => {
  mock.reset();
});

test.afterEach(async ({ accounts }) => {
  await deleteFacilities({ email: accounts.amy.email, password: accounts.password }, PREFIX);
});

/** A future-dated doubles reservation, 6-8pm Toronto on 2026-10-01. */
const FUTURE_EVENT = {
  uid: "feed-evt-1",
  summary: "Doubles",
  description: "Court #6",
  location: CLUB,
  start: "2026-10-01T22:00:00Z", // 18:00 EDT
  end: "2026-10-02T00:00:00Z", // 20:00 EDT
};

/** A distinct future reservation on 2026-10-`n` (n = 2..20), Court #n, 6-8pm EDT. */
function futureEvent(n: number) {
  const day = String(n).padStart(2, "0");
  return {
    uid: `feed-evt-${n}`,
    summary: "Doubles",
    description: `Court #${n}`,
    location: CLUB,
    start: `2026-10-${day}T22:00:00Z`,
    end: `2026-10-${day}T23:00:00Z`,
  };
}

test("the feed field rejects an invalid URL inline and does not save it", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Reject`;
  await seedFacility(user, facility);
  await signIn(page, accounts.amy.email);

  const orgRow = page.getByRole("listitem").filter({ hasText: facility });

  await setFeedUrlViaForm(page, facility, "http://app.courtreserve.com/feed.ics", {
    expectError: true,
  });
  await expect(orgRow.getByRole("alert")).toContainText(/https/i);

  await setFeedUrlViaForm(page, facility, "https://example.com/feed.ics", {
    expectError: true,
  });
  await expect(orgRow.getByRole("alert")).toContainText(/CourtReserve/i);

  // Neither error echoes the pasted URL, and nothing was saved — the field
  // (not a "Remove feed" control) is still what's shown after a reload.
  await expect(orgRow.getByRole("alert")).not.toContainText("feed.ics");
  await page.reload();
  await expect(orgRow.getByLabel("Import from a calendar feed")).toBeVisible();
  await expect(orgRow.getByRole("button", { name: "Remove feed" })).toHaveCount(0);
});

test("paste → Sync facilities → confirm → a Booking with facility / date / time / court / format", async ({
  page,
  accounts,
}) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Import`;
  const orgId = await seedFacility(user, facility);
  mock.registerFeed("/feed/import", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);

  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/import"));
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: facility })
      .getByText("A feed is configured for this facility."),
  ).toBeVisible();

  await syncFacilities(page);

  const section = feedSection(page);
  const card = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });
  await expect(card).toBeVisible();
  await expect(card).toContainText(CLUB);
  await expect(card).toContainText("10-01-2026");
  await expect(card).toContainText("6:00 PM");
  await expect(card).toContainText("8:00 PM");
  await expect(card).toContainText("Court #6");
  await expect(card).toContainText("Doubles");
  await expect(card.getByLabel("Facility", { exact: true })).not.toHaveValue("");

  await card.getByRole("button", { name: "Confirm" }).click();
  await expect(section.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  await expect(row(page, "Court #6")).toContainText(facility);

  const bookings = await bookingsForOrg(user, orgId);
  expect(bookings).toHaveLength(1);
  expect(bookings[0].court_label).toBe("#6");

  // Re-sync: the event now matches the Booking → auto-linked, not re-offered.
  await syncFacilities(page);
  await expect(section.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
});

test("a dismissed feed candidate does not reappear on the next sync", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Dismiss`;
  const orgId = await seedFacility(user, facility);
  mock.registerFeed("/feed/dismiss", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/dismiss"));

  await syncFacilities(page);
  const section = feedSection(page);
  const card = section.getByRole("listitem").filter({ hasText: CLUB });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Dismiss" }).click();
  await expect(card).toHaveCount(0);

  expect(await feedEventsForOrg(user, orgId)).toEqual([
    expect.objectContaining({ uid: "feed-evt-1", status: "dismissed" }),
  ]);

  await syncFacilities(page);
  await expect(section.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  await expect(section.getByRole("listitem").filter({ hasText: CLUB })).toHaveCount(0);
  expect(await bookingsForOrg(user, orgId)).toHaveLength(0);
});

test("clearing a feed URL empties the field and a later sync no longer fetches it", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const cleared = `${PREFIX} Clear`;
  const kept = `${PREFIX} Kept`;
  const clearedOrgId = await seedFacility(user, cleared);
  await seedFacility(user, kept);

  // The cleared feed serves a candidate; the kept feed serves a 500, so a sync
  // that still fetched the cleared feed would surface its candidate again.
  mock.registerFeed("/feed/cleared", { kind: "ics", body: icsBody([FUTURE_EVENT]) });
  mock.registerFeed("/feed/kept", { kind: "status", status: 500 });

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, cleared, mock.urlFor("/feed/cleared"));
  await setFeedUrlViaForm(page, kept, mock.urlFor("/feed/kept"));

  await syncFacilities(page);
  await expect(feedSection(page).getByRole("listitem").filter({ hasText: CLUB })).toBeVisible();

  // Clear the first feed — its field comes back empty, its seen-set is purged.
  await clearFeedUrlViaForm(page, cleared);
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: cleared })
      .getByRole("button", { name: "Remove feed" }),
  ).toHaveCount(0);
  expect(await feedEventsForOrg(user, clearedOrgId)).toHaveLength(0);

  // A later sync still runs (the kept feed is configured) but never fetches the
  // cleared one — no candidate, only the kept feed's error.
  await syncFacilities(page);
  const section = feedSection(page);
  await expect(section.getByRole("alert").filter({ hasText: kept })).toBeVisible();
  await expect(section.getByRole("listitem")).toHaveCount(0);
  expect(await feedEventsForOrg(user, clearedOrgId)).toHaveLength(0);
});

test("a per-Facility fetch error names the Facility and doesn't stop the others", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const good = `${PREFIX} Good`;
  const bad = `${PREFIX} Bad`;
  await seedFacility(user, good);
  await seedFacility(user, bad);

  mock.registerFeed("/feed/good", { kind: "ics", body: icsBody([FUTURE_EVENT]) });
  mock.registerFeed("/feed/bad", { kind: "status", status: 500 });

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, good, mock.urlFor("/feed/good"));
  await setFeedUrlViaForm(page, bad, mock.urlFor("/feed/bad"));

  await syncFacilities(page);
  const section = feedSection(page);

  await expect(section.getByRole("alert").filter({ hasText: bad })).toBeVisible();
  // The good feed still produced its candidate.
  await expect(
    section.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Confirm" }) }),
  ).toBeVisible();
});

test("the feed field and section are available to a User not on EMAIL_SYNC_ALLOWLIST", async ({ page, accounts }) => {
  // Amy is not allowlisted for any worker — she has no Gmail-connect button and
  // no "Sync from Email" section unless she connects a mailbox, but the feed
  // field and "From facility feeds" are hers regardless.
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Allow`;
  await seedFacility(user, facility);
  mock.registerFeed("/feed/allow", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email, "/booking-buddy/orgs");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: facility })
      .getByLabel("Import from a calendar feed"),
  ).toBeVisible();

  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/allow"));
  await syncFacilities(page);
  await expect(page.getByRole("heading", { name: "From facility feeds" })).toBeVisible();
  await expect(
    feedSection(page)
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Confirm" }) }),
  ).toBeVisible();
});

test("a reservation that vanishes from the feed becomes a cancellation candidate; confirming removes the Booking", async ({
  page,
  accounts,
}) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Cancel`;
  const orgId = await seedFacility(user, facility);

  // Two future reservations to start — one tracked Booking left after the diff
  // keeps rail 4's >50% guard from firing (1 of 2, and 1 ≤ the absolute cap).
  const kept = futureEvent(2);
  const gone = futureEvent(9);
  mock.registerFeed("/feed/cancel", { kind: "ics", body: icsBody([kept, gone]) });

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/cancel"));

  // Sync and confirm both — two Bookings, two `imported` feed rows.
  await syncFacilities(page);
  const section = feedSection(page);
  for (let i = 0; i < 2; i++) {
    await section
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Confirm" }) })
      .first()
      .getByRole("button", { name: "Confirm" })
      .click();
    await page.waitForTimeout(300);
  }
  await expect(section.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  expect(await bookingsForOrg(user, orgId)).toHaveLength(2);

  // The `gone` reservation drops out of the feed.
  mock.registerFeed("/feed/cancel", { kind: "ics", body: icsBody([kept]) });
  await syncFacilities(page);

  const cancelCard = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Remove booking" }) });
  await expect(cancelCard).toBeVisible();
  await expect(cancelCard).toContainText("10-09-2026");

  await cancelCard.getByRole("button", { name: "Remove booking" }).click();
  await expect(section.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  const remaining = await bookingsForOrg(user, orgId);
  expect(remaining).toHaveLength(1);
  expect(remaining[0].court_label).toBe("#2");

  // A further sync doesn't re-offer it.
  await syncFacilities(page);
  await expect(
    section.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Remove booking" }) }),
  ).toHaveCount(0);
});

test("an unhealthy feed fetch produces zero cancellation candidates — nothing is removed", async ({
  page,
  accounts,
}) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Unhealthy`;
  const orgId = await seedFacility(user, facility);
  mock.registerFeed("/feed/unhealthy", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/unhealthy"));

  await syncFacilities(page);
  const section = feedSection(page);
  await section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) })
    .getByRole("button", { name: "Confirm" })
    .click();
  await expect(section.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);

  // The feed now 500s — the diff must not run, so no cancellation candidate and
  // the Booking stays.
  mock.registerFeed("/feed/unhealthy", { kind: "status", status: 500 });
  await syncFacilities(page);
  await expect(section.getByRole("alert").filter({ hasText: facility })).toBeVisible();
  await expect(
    section.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Remove booking" }) }),
  ).toHaveCount(0);
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);

  // An empty (but 200) body is unhealthy the same way.
  mock.registerFeed("/feed/unhealthy", { kind: "empty" });
  await syncFacilities(page);
  await expect(section.getByRole("alert").filter({ hasText: facility })).toBeVisible();
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);
});

test("a sync that would flag more than the cap shows the 'feed looks wrong' warning instead of removing bookings", async ({
  page,
  accounts,
}) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Cap`;
  const orgId = await seedFacility(user, facility);

  // The anchor stays in the feed and starts *before* the ones that vanish, so
  // rail 2's "at or after the earliest event still present" floor doesn't
  // exclude them — this test is about rail 4, not rail 2.
  const anchor = futureEvent(2);
  const events = [3, 4, 5, 6, 7].map(futureEvent);
  mock.registerFeed("/feed/cap", { kind: "ics", body: icsBody([...events, anchor]) });

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/cap"));

  await syncFacilities(page);
  const section = feedSection(page);
  // Confirm all six.
  for (let i = 0; i < 6; i++) {
    await section
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Confirm" }) })
      .first()
      .getByRole("button", { name: "Confirm" })
      .click();
    await page.waitForTimeout(300);
  }
  await expect(section.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  expect(await bookingsForOrg(user, orgId)).toHaveLength(6);

  // Feed collapses to just the anchor — five reservations vanish at once.
  mock.registerFeed("/feed/cap", { kind: "ics", body: icsBody([anchor]) });
  await syncFacilities(page);

  await expect(section.getByRole("alert").filter({ hasText: /looks wrong/i })).toBeVisible();
  await expect(
    section.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Remove booking" }) }),
  ).toHaveCount(0);
  // Nothing removed.
  expect(await bookingsForOrg(user, orgId)).toHaveLength(6);
});

test('"From facility feeds" is a section separate from "Sync from Email"', async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Separate`;
  await seedFacility(user, facility);

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/none"));

  await page.goto("/booking-buddy/bookings");
  // The feed section renders; Amy (unconnected, non-allowlisted) has no email
  // section — they are never merged into one list.
  await expect(page.getByRole("heading", { name: "From facility feeds" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync facilities" })).toBeVisible();
});
