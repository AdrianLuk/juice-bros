import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import { addPlace, placeName } from "./support/places.ts";
import { GmailMock } from "./support/gmail-mock.ts";
import { CalendarFeedMock, icsBody } from "./support/calendar-feed-mock.ts";
import { confirmationEmail, messageId } from "./support/sync-from-email-scenarios.ts";
import {
  feedSection,
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
  await expect(cards.filter({ hasText: "Mon 03-15-2027" })).toHaveCount(1);
  await expect(cards.filter({ hasText: "10-01-2026" })).toHaveCount(1);
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

test("email + feed candidates for the same slot resolve to one Booking on confirm", async ({ page, accounts }) => {
  // One Facility, reached by both sources: the email names it by its logo alt,
  // the feed is configured on the same Org.
  const facility = placeName();
  await signIn(page, accounts.ben.email, "/booking-buddy/orgs");
  await addPlace(page, facility);

  await connectGmail(page);
  // Email confirmation: Doubles, 2027-03-15 18:00-19:00, Court 3.
  gmail.registerMessages([confirmationEmail({ id: messageId(), facility })]);
  await page.goto("/booking-buddy/orgs");
  await setFeedUrlViaForm(page, facility, feed.urlFor("/feed/same"));
  // A feed event for the *same* slot: 2027-03-15 18:00-19:00 EDT, Court 3.
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
  await expect(cards).toHaveCount(2, { timeout: 15_000 });

  // Confirm the first; the second (same slot, other source) is now a duplicate.
  await cards.first().getByRole("button", { name: "Confirm" }).click();
  await expect(cards).toHaveCount(1);
  await cards.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

  // The confirm-time guard held: exactly one "Court 3" Booking for this slot,
  // not one per source.
  await expect(
    page.getByRole("listitem").filter({ hasText: facility }).filter({ hasText: "Court 3" }),
  ).toHaveCount(1);
});
