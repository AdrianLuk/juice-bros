import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { addPlace, placeName } from "./support/places.ts";
import { GmailMock } from "./support/gmail-mock.ts";
import { CalendarFeedMock, icsBody } from "./support/calendar-feed-mock.ts";
import { confirmationEmail, messageId } from "./support/sync-from-email-scenarios.ts";
import {
  bookingsForOrg,
  dismissedReservationsForOrg,
  feedEventsForOrg,
  feedSection,
  orgIdByName,
  seedDismissedReservation,
  seedFacility,
  setFeedUrlViaForm,
} from "./support/calendar-feed.ts";
import { deleteOrgs, disconnectMailbox } from "./support/db-reset.ts";

/**
 * The unified "Sync bookings" section (issue #336) — one button, one review
 * list, running both import sources. Signs in as Ben, who is on
 * `EMAIL_SYNC_ALLOWLIST` for every worker, so he can connect Gmail *and*
 * configure a Calendar Feed. Both the Gmail mock (port 5603) and the ICS mock
 * (port 5605) run together.
 */

const FEED_CLUB = "Playwright Sync Club";

let gmail: GmailMock;
let feed: CalendarFeedMock;

test.beforeAll(async () => {
  gmail = new GmailMock();
  feed = new CalendarFeedMock();
  await Promise.all([gmail.start(), feed.start()]);
});

test.afterAll(async () => {
  await Promise.all([gmail.stop(), feed.stop()]);
});

test.beforeEach(() => {
  gmail.reset();
  feed.reset();
});

test.afterEach(async ({ accounts }) => {
  const user = { email: accounts.ben.email, password: accounts.password };
  await disconnectMailbox(user);
  await deleteOrgs(user);
});

const GMAIL_ACCOUNT = {
  email: "ben.sync@gmail.com",
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
};

/** Connects Ben's Gmail through the real OAuth redirect against the mock. */
async function connectGmail(page: import("@playwright/test").Page) {
  gmail.registerAccount(GMAIL_ACCOUNT);
  await page.goto("/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");
}

/** A future-dated feed reservation on 2026-10-01, Court #6, 6-8pm EDT. */
const FEED_EVENT = {
  uid: "sync-feed-evt-1",
  summary: "Doubles",
  description: "Court #6",
  location: FEED_CLUB,
  start: "2026-10-01T22:00:00Z",
  end: "2026-10-02T00:00:00Z",
};

test("one section, one button — replaces the two old sync sections", async ({ page, accounts }) => {
  const emailFacility = placeName();
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");
  await addPlace(page, emailFacility);
  await seedFacility({ email: accounts.ben.email, password: accounts.password }, FEED_CLUB);

  await connectGmail(page);
  gmail.registerMessages([confirmationEmail({ id: messageId(), facility: emailFacility })]);
  await page.goto("/booking-buddy/orgs");
  await setFeedUrlViaForm(page, FEED_CLUB, feed.urlFor("/feed/ben"));
  feed.registerFeed("/feed/ben", { kind: "ics", body: icsBody([FEED_EVENT]) });

  await page.goto("/booking-buddy/bookings");

  // Exactly one section, one button. The old headings/buttons are gone.
  await expect(page.getByRole("heading", { name: "Sync bookings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync bookings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From facility feeds" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sync from Email", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync facilities" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync from Email" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sync bookings" }).click();

  // Both sources' candidates land in the one list. The email candidate carries
  // the confirmation's date; the feed candidate carries its Court #6 / Oct 1.
  const cards = feedSection(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });
  await expect(cards).toHaveCount(2, { timeout: 15_000 });
  await expect(cards.filter({ hasText: "Mon Mar 15, 2027" })).toHaveCount(1);
  await expect(cards.filter({ hasText: "Thu Oct 01, 2026" })).toHaveCount(1);
});

test("one source failing still shows the other's candidates, failure named", async ({ page, accounts }) => {
  const emailFacility = placeName();
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");
  await addPlace(page, emailFacility);
  const feedFacility = `${FEED_CLUB} Bad`;
  await seedFacility({ email: accounts.ben.email, password: accounts.password }, feedFacility);

  await connectGmail(page);
  gmail.registerMessages([confirmationEmail({ id: messageId(), facility: emailFacility })]);
  await page.goto("/booking-buddy/orgs");
  // A feed URL the mock 500s on — the feed source fails, email must not.
  await setFeedUrlViaForm(page, feedFacility, feed.urlFor("/feed/broken"));
  feed.registerFeed("/feed/broken", { kind: "status", status: 500 });

  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();

  const section = feedSection(page);
  // The feed failure is surfaced and names the facility.
  await expect(
    section.getByRole("alert").filter({ hasText: feedFacility }),
  ).toBeVisible({ timeout: 15_000 });
  // The email candidate still rendered.
  await expect(
    section.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Confirm" }) }),
  ).toContainText(emailFacility);
});

test("email + feed candidates for the same reservation consolidate into one card, confirmed once (#348)", async ({
  page,
  accounts,
}) => {
  // One Facility, reached by both sources: the email names it by its logo alt,
  // the feed is configured on the same Org.
  const user = { email: accounts.ben.email, password: accounts.password };
  const facility = placeName();
  const orgId = await seedFacility(user, facility);
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");

  await connectGmail(page);
  // Email confirmation: Doubles, 2027-03-15 18:00-19:00, Court 3, with players.
  gmail.registerMessages([confirmationEmail({ id: messageId(), facility })]);
  await page.goto("/booking-buddy/orgs");
  await setFeedUrlViaForm(page, facility, feed.urlFor("/feed/same"));
  // A feed event for the *same* slot: 2027-03-15 18:00-19:00 EDT, Court #3.
  feed.registerFeed("/feed/same", {
    kind: "ics",
    body: icsBody([
      {
        uid: "sync-same-slot",
        summary: "Doubles",
        description: "Court #3",
        location: facility,
        start: "2027-03-15T22:00:00Z",
        end: "2027-03-15T23:00:00Z",
      },
    ]),
  });

  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();

  const section = feedSection(page);
  const cards = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });

  // One consolidated card, not two — carrying the email's players and the
  // "both sources" note.
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  await expect(cards).toContainText("Amy Ace, Ben Backhand");
  await expect(cards).toContainText("From your mailbox and a facility calendar feed.");

  await cards.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  // Exactly one Booking for the slot.
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);

  // Both sources settled: the feed event is recorded imported + linked, and a
  // second sync re-offers nothing from either side.
  const feedEvents = await feedEventsForOrg(user, orgId);
  expect(feedEvents).toEqual([
    expect.objectContaining({ uid: "sync-same-slot", status: "imported" }),
  ]);
  expect(feedEvents[0].booking_id).not.toBeNull();

  await page.getByRole("button", { name: "Sync bookings" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  await expect(cards).toHaveCount(0);

  expect(await orgIdByName(user, facility)).toBe(orgId);
});

test("a feed doesn't re-offer a reservation already imported from email, whatever the court wording (#432)", async ({
  page,
  accounts,
}) => {
  // The real shape of the bug: the two sources land in *different* syncs, so
  // the merged card never gets a chance. The email confirms first and writes
  // the Booking with its Players and its own court text ("#9 - Hard"); the
  // feed is configured afterwards and says only "#9". Compared as text those
  // never matched, so the feed offered the same reservation a second time,
  // carrying no Players — and confirming it wrote a duplicate Booking.
  const user = { email: accounts.ben.email, password: accounts.password };
  const facility = placeName();
  const orgId = await seedFacility(user, facility);
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");

  await connectGmail(page);
  gmail.registerMessages([
    confirmationEmail({ id: messageId(), facility, court: "Court #9 - Hard" }),
  ]);

  // Sync #1 — email only, no feed configured yet. Confirm it.
  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();
  const section = feedSection(page);
  const cards = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  await expect(cards).toContainText("Amy Ace, Ben Backhand");
  await cards.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  const afterEmail = await bookingsForOrg(user, orgId);
  expect(afterEmail).toHaveLength(1);
  expect(afterEmail[0].court_label).toBe("#9 - Hard");

  // Now configure the feed, whose event is the same reservation on "Court #9".
  await page.goto("/booking-buddy/orgs");
  await setFeedUrlViaForm(page, facility, feed.urlFor("/feed/cross-source"));
  feed.registerFeed("/feed/cross-source", {
    kind: "ics",
    body: icsBody([
      {
        uid: "sync-cross-source",
        summary: "Doubles",
        description: "Court #9",
        location: facility,
        start: "2027-03-15T22:00:00Z",
        end: "2027-03-15T23:00:00Z",
      },
    ]),
  });

  // Sync #2 — the feed recognises the Booking and links to it silently.
  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  await expect(cards).toHaveCount(0);

  // Still one Booking, still carrying the Players the email brought.
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);

  const feedEvents = await feedEventsForOrg(user, orgId);
  expect(feedEvents).toEqual([
    expect.objectContaining({ uid: "sync-cross-source", status: "imported" }),
  ]);
  expect(feedEvents[0].booking_id).toBe(afterEmail[0].id);
});

test("dismissing a consolidated card settles both sources — neither re-offers it (#348)", async ({
  page,
  accounts,
}) => {
  const user = { email: accounts.ben.email, password: accounts.password };
  const facility = placeName();
  const orgId = await seedFacility(user, facility);
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");

  await connectGmail(page);
  gmail.registerMessages([confirmationEmail({ id: messageId(), facility })]);
  await page.goto("/booking-buddy/orgs");
  await setFeedUrlViaForm(page, facility, feed.urlFor("/feed/dismiss-merged"));
  feed.registerFeed("/feed/dismiss-merged", {
    kind: "ics",
    body: icsBody([
      {
        uid: "sync-dismiss-slot",
        summary: "Doubles",
        description: "Court #3",
        location: facility,
        start: "2027-03-15T22:00:00Z",
        end: "2027-03-15T23:00:00Z",
      },
    ]),
  });

  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();

  const section = feedSection(page);
  const card = section.getByRole("listitem").filter({ hasText: "From your mailbox and a facility calendar feed." });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "Dismiss" }).click();
  await expect(card).toHaveCount(0);

  expect(await bookingsForOrg(user, orgId)).toHaveLength(0);
  expect(await feedEventsForOrg(user, orgId)).toEqual([
    expect.objectContaining({ uid: "sync-dismiss-slot", status: "dismissed" }),
  ]);

  await page.getByRole("button", { name: "Sync bookings" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
});

test("dismissing an email candidate settles the feed too — it never re-offers the reservation (#437)", async ({
  page,
  accounts,
}) => {
  // The sources land in different syncs, so the merged card never gets a
  // chance. Dismissing the email wrote only a `processed_messages` row keyed
  // on an opaque message id, and a dismissal leaves no Booking behind for the
  // feed to recognise — so the feed offered the same reservation again,
  // stripped of the Players the email had carried.
  const user = { email: accounts.ben.email, password: accounts.password };
  const facility = placeName();
  const orgId = await seedFacility(user, facility);
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");

  await connectGmail(page);
  gmail.registerMessages([
    confirmationEmail({ id: messageId(), facility, court: "Court #9 - Hard" }),
  ]);

  // Sync #1 — email only, no feed configured yet. Dismiss it.
  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();
  const section = feedSection(page);
  const cards = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  await cards.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  // Now configure the feed, whose event is the same reservation on "Court #9".
  await page.goto("/booking-buddy/orgs");
  await setFeedUrlViaForm(page, facility, feed.urlFor("/feed/dismissed-by-email"));
  feed.registerFeed("/feed/dismissed-by-email", {
    kind: "ics",
    body: icsBody([
      {
        uid: "sync-dismissed-by-email",
        summary: "Doubles",
        description: "Court #9",
        location: facility,
        start: "2027-03-15T22:00:00Z",
        end: "2027-03-15T23:00:00Z",
      },
    ]),
  });

  // Sync #2 — the feed honours the dismissal instead of re-offering it.
  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  await expect(cards).toHaveCount(0);

  // A dismissal never touches a Booking, and a skipped event is not recorded
  // as seen — there is nothing to diff for a reservation that was never taken.
  expect(await bookingsForOrg(user, orgId)).toHaveLength(0);
  expect(await feedEventsForOrg(user, orgId)).toEqual([]);
});

test("dismissing a feed candidate settles the mailbox too — the email never re-offers it (#437)", async ({
  page,
  accounts,
}) => {
  // The other direction: dismissing the feed candidate wrote only an
  // `org_feed_events` row keyed on a VEVENT UID, which the email review never
  // reads.
  const user = { email: accounts.ben.email, password: accounts.password };
  const facility = placeName();
  const orgId = await seedFacility(user, facility);
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");

  // Gmail is connected up front so both syncs run the same two sources; the
  // confirmation itself only arrives for sync #2, keeping the two candidates
  // out of one run and so out of the merged card.
  await connectGmail(page);
  await page.goto("/booking-buddy/orgs");
  await setFeedUrlViaForm(page, facility, feed.urlFor("/feed/dismissed-by-feed"));
  feed.registerFeed("/feed/dismissed-by-feed", {
    kind: "ics",
    body: icsBody([
      {
        uid: "sync-dismissed-by-feed",
        summary: "Doubles",
        description: "Court #9",
        location: facility,
        start: "2027-03-15T22:00:00Z",
        end: "2027-03-15T23:00:00Z",
      },
    ]),
  });

  // Sync #1 — feed only. Dismiss it.
  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();
  const section = feedSection(page);
  const cards = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  await cards.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  expect(await feedEventsForOrg(user, orgId)).toEqual([
    expect.objectContaining({ uid: "sync-dismissed-by-feed", status: "dismissed" }),
  ]);

  // The confirmation email for that same reservation arrives afterwards.
  gmail.registerMessages([
    confirmationEmail({ id: messageId(), facility, court: "Court #9 - Hard" }),
  ]);

  // Reloaded first, so sync #1's own "No new bookings found." is gone and the
  // wait below is on sync #2's result rather than passing against the old one.
  await page.goto("/booking-buddy/bookings");
  await expect(page.getByText("No new bookings found.")).toHaveCount(0);
  await page.getByRole("button", { name: "Sync bookings" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
  await expect(cards).toHaveCount(0);
  expect(await bookingsForOrg(user, orgId)).toHaveLength(0);
});

test("a rebooked slot is named as skipped, and offering it again brings it back (#444)", async ({
  page,
  accounts,
}) => {
  // Since #437 a dismissal suppresses the *slot*, from both sources. So a
  // cancel and rebook of that slot — a genuinely new reservation, arriving
  // under a message id no sync has ever seen — is dropped too. Before #444
  // that happened in silence and could not be undone.
  const user = { email: accounts.ben.email, password: accounts.password };
  const facility = placeName();
  const orgId = await seedFacility(user, facility);
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");

  await connectGmail(page);
  gmail.registerMessages([
    confirmationEmail({ id: messageId(), facility, court: "Court #9 - Hard" }),
  ]);

  // Sync #1 — dismiss the original reservation.
  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();
  const section = feedSection(page);
  const cards = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  await cards.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  // The rebook: same facility, same slot, same court, brand new confirmation.
  gmail.registerMessages([
    confirmationEmail({ id: messageId(), facility, court: "Court #9 - Hard" }),
  ]);

  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();

  const skipped = section.getByText("1 booking was skipped because you dismissed it before");
  await expect(skipped).toBeVisible({ timeout: 15_000 });
  await expect(cards).toHaveCount(0);

  // Take the dismissal back, and the line goes with it.
  await skipped.click();
  await section.getByRole("button", { name: "Offer this again" }).click();
  await expect(skipped).toHaveCount(0);

  // Sync #3 — the same confirmation is offered, and confirms into a Booking.
  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  await cards.getByRole("button", { name: "Confirm" }).click();
  await expect(cards).toHaveCount(0, { timeout: 15_000 });
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);
});

test("a sync prunes a dismissal whose slot has passed, and leaves a live one (#447)", async ({
  page,
  accounts,
}) => {
  // Nothing here is visible on screen, and that is the point: a row for a slot
  // that has been and gone can suppress nothing, because both reviews drop a
  // past-dated candidate before they ever reach the dismissal check. The
  // cutoff arithmetic is a unit test and the grant is pgTAP; what only this
  // layer can show is that running a *sync* is what fires the prune, against a
  // real database with RLS on.
  const user = { email: accounts.ben.email, password: accounts.password };
  const facility = placeName();
  const orgId = await seedFacility(user, facility);

  await seedDismissedReservation(user, {
    orgId,
    date: "2020-03-15",
    startTime: "18:00",
    courtLabel: "#9",
  });
  await seedDismissedReservation(user, {
    orgId,
    date: "2099-03-15",
    startTime: "18:00",
    courtLabel: "#4",
  });

  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");
  await setFeedUrlViaForm(page, facility, feed.urlFor("/feed/prune"));
  feed.registerFeed("/feed/prune", {
    kind: "ics",
    body: icsBody([
      {
        uid: "sync-prune-evt",
        summary: "Doubles",
        description: "Court #1",
        location: facility,
        start: "2027-03-15T22:00:00Z",
        end: "2027-03-15T23:00:00Z",
      },
    ]),
  });

  await page.goto("/booking-buddy/bookings");
  await page.getByRole("button", { name: "Sync bookings" }).click();

  // Not an assertion about the prune — the barrier before one. The read below
  // doesn't retry, so it has to wait until the sync has actually landed, and
  // the feed's own candidate appearing is the signal that it has.
  const section = feedSection(page);
  const cards = section
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Confirm" }) });
  await expect(cards).toHaveCount(1, { timeout: 15_000 });

  expect(await dismissedReservationsForOrg(user, orgId)).toEqual([
    expect.objectContaining({ slot_date: "2099-03-15", court_label: "#4" }),
  ]);
});
