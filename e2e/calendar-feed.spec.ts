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

test("clearing the feed URL empties the field and stops the sync fetching it", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const facility = `${PREFIX} Clear`;
  const orgId = await seedFacility(user, facility);
  mock.registerFeed("/feed/clear", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);
  await setFeedUrlViaForm(page, facility, mock.urlFor("/feed/clear"));
  await syncFacilities(page);
  await expect(feedSection(page).getByRole("listitem").filter({ hasText: CLUB })).toBeVisible();

  await clearFeedUrlViaForm(page, facility);
  expect(await feedEventsForOrg(user, orgId)).toHaveLength(0);

  // With no feed configured, the section is gone from the Bookings page.
  await page.goto("/booking-buddy/bookings");
  await expect(page.getByRole("heading", { name: "From facility feeds" })).toHaveCount(0);
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
