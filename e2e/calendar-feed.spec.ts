import { expect, test } from "./support/accounts.ts";

import { signIn } from "./support/sign-in.ts";
import {
  CalendarFeedMock,
  icsBody,
} from "./support/calendar-feed-mock.ts";
import {
  FeedBridge,
  bookingsForOrg,
  deleteFacilities,
  feedEventsForOrg,
  seedFacility,
  type FacilityFeedResult,
} from "./support/calendar-feed.ts";

/**
 * The Calendar Feed backend integration suite (issue #294) — set-URL → sync →
 * confirm → Booking, and dismiss → resync, driven against a local ICS mock.
 *
 * The user-facing screens are the next ticket, so there are no buttons to
 * click: the spec seeds a Facility straight through PostgREST and drives the
 * real server actions through the test-only `/api/e2e/calendar-feed` bridge
 * route (gated on `E2E_WEB_SERVER=1`, same as `/api/e2e-preflight`). Delete the
 * bridge route and rewrite this against real UI when the Calendar Feed screen
 * lands.
 *
 * Runs as Amy (any account — a Calendar Feed isn't allowlist-gated). All
 * Facilities created here are `Playwright FeedX`-named and swept in `afterEach`.
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
  await Promise.all([
    deleteFacilities({ email: accounts.amy.email, password: accounts.password }, PREFIX),
    deleteFacilities({ email: accounts.ben.email, password: accounts.password }, PREFIX),
  ]);
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

function okFeed(result: { feeds: FacilityFeedResult[] } | { status: string }): FacilityFeedResult {
  if (!("feeds" in result) || result.feeds.length !== 1) {
    throw new Error(`expected one feed result, got ${JSON.stringify(result)}`);
  }
  return result.feeds[0];
}

test("set an invalid feed URL is rejected at save time with a clear reason", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const orgId = await seedFacility(user, `${PREFIX} Reject`);
  await signIn(page, accounts.amy.email);
  const bridge = new FeedBridge(page.request);

  const nonHttps = await bridge.setFeedUrl(orgId, "http://app.courtreserve.com/feed.ics");
  expect(nonHttps).toHaveProperty("error");
  expect((nonHttps as { error: string }).error).toMatch(/https/i);

  const wrongHost = await bridge.setFeedUrl(orgId, "https://example.com/feed.ics");
  expect((wrongHost as { error: string }).error).toMatch(/CourtReserve/i);

  // Neither reason echoes the pasted URL back.
  expect(JSON.stringify(nonHttps)).not.toContain("feed.ics");
  expect(JSON.stringify(wrongHost)).not.toContain("example.com");
});

test("set-URL → sync → confirm → Booking, and a matching event is auto-linked not re-offered", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const orgId = await seedFacility(user, `${PREFIX} Import`);
  mock.registerFeed("/feed/import", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);
  const bridge = new FeedBridge(page.request);

  expect(await bridge.setFeedUrl(orgId, mock.urlFor("/feed/import"))).toEqual({ ok: true });

  const first = okFeed(await bridge.syncAll());
  if (first.status !== "ok") throw new Error(`sync errored: ${first.message}`);
  expect(first.items).toHaveLength(1);
  const candidate = first.items[0];
  expect(candidate).toMatchObject({
    kind: "import",
    date: "2026-10-01",
    startTime: "18:00",
    endTime: "20:00",
    courtLabel: "#6",
    format: "doubles",
    facilityName: CLUB,
  });

  // A pending seen-event row was persisted.
  const afterSync = await feedEventsForOrg(user, orgId);
  expect(afterSync).toEqual([
    expect.objectContaining({ uid: "feed-evt-1", status: "pending", booking_id: null }),
  ]);

  // Confirm it → a real Booking.
  expect(await bridge.confirm(candidate, FUTURE_EVENT.start)).toEqual({ ok: true });
  const bookings = await bookingsForOrg(user, orgId);
  expect(bookings).toHaveLength(1);
  expect(bookings[0].court_label).toBe("#6");

  // The seen-event row is now imported + linked to that Booking.
  const afterConfirm = await feedEventsForOrg(user, orgId);
  expect(afterConfirm).toEqual([
    expect.objectContaining({ uid: "feed-evt-1", status: "imported", booking_id: bookings[0].id }),
  ]);

  // Re-sync: the same event now matches the Booking and is auto-linked, not
  // offered again.
  const second = okFeed(await bridge.syncAll());
  if (second.status !== "ok") throw new Error(`resync errored: ${second.message}`);
  expect(second.items).toHaveLength(0);
});

test("a dismissed feed candidate does not reappear on the next sync", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const orgId = await seedFacility(user, `${PREFIX} Dismiss`);
  mock.registerFeed("/feed/dismiss", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);
  const bridge = new FeedBridge(page.request);
  await bridge.setFeedUrl(orgId, mock.urlFor("/feed/dismiss"));

  const first = okFeed(await bridge.syncOne(orgId));
  if (first.status !== "ok") throw new Error(first.message);
  expect(await bridge.dismiss(first.items[0], FUTURE_EVENT.start)).toEqual({ ok: true });

  expect(await feedEventsForOrg(user, orgId)).toEqual([
    expect.objectContaining({ uid: "feed-evt-1", status: "dismissed" }),
  ]);

  const second = okFeed(await bridge.syncOne(orgId));
  if (second.status !== "ok") throw new Error(second.message);
  expect(second.items).toHaveLength(0);
  // Still exactly one Booking-free dismissed row, no duplicate Booking made.
  expect(await bookingsForOrg(user, orgId)).toHaveLength(0);
});

test("one feed failing surfaces a per-Facility error and does not stop the others", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const goodOrg = await seedFacility(user, `${PREFIX} Good`);
  const badOrg = await seedFacility(user, `${PREFIX} Bad`);

  mock.registerFeed("/feed/good", { kind: "ics", body: icsBody([FUTURE_EVENT]) });
  mock.registerFeed("/feed/bad", { kind: "status", status: 500 });

  await signIn(page, accounts.amy.email);
  const bridge = new FeedBridge(page.request);
  await bridge.setFeedUrl(goodOrg, mock.urlFor("/feed/good"));
  await bridge.setFeedUrl(badOrg, mock.urlFor("/feed/bad"));

  const result = await bridge.syncAll();
  if (!("feeds" in result)) throw new Error(`whole sync errored: ${JSON.stringify(result)}`);
  expect(result.feeds).toHaveLength(2);

  const good = result.feeds.find((feed) => feed.orgId === goodOrg)!;
  const bad = result.feeds.find((feed) => feed.orgId === badOrg)!;
  expect(good.status).toBe("ok");
  expect(good.status === "ok" && good.items).toHaveLength(1);
  expect(bad.status).toBe("error");
  // The error names the failure class, never the feed URL.
  expect(bad.status === "error" && bad.message).not.toContain("feed/bad");
});

test("an empty or malformed feed body reports an error, no candidates", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const orgId = await seedFacility(user, `${PREFIX} Empty`);
  mock.registerFeed("/feed/empty", { kind: "empty" });

  await signIn(page, accounts.amy.email);
  const bridge = new FeedBridge(page.request);
  await bridge.setFeedUrl(orgId, mock.urlFor("/feed/empty"));

  const feed = okFeed(await bridge.syncOne(orgId));
  // An empty body parses to zero events → zero candidates. (The healthy-fetch
  // rail that turns "zero VEVENTs" into a hard error is the cancellation-diff
  // ticket; this slice just produces no import candidates.)
  expect(feed.status === "ok" && feed.items).toHaveLength(0);
});

test("a feed that redirects is not followed", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const orgId = await seedFacility(user, `${PREFIX} Redirect`);
  mock.registerFeed("/feed/redir", { kind: "redirect", location: "http://127.0.0.1:54321/rest/v1/" });
  mock.registerFeed("/feed/redir-target", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);
  const bridge = new FeedBridge(page.request);
  await bridge.setFeedUrl(orgId, mock.urlFor("/feed/redir"));

  const feed = okFeed(await bridge.syncOne(orgId));
  expect(feed.status).toBe("error");
});

test("clearing a feed URL deletes that Org's seen-event rows", async ({ page, accounts }) => {
  const user = { email: accounts.amy.email, password: accounts.password };
  const orgId = await seedFacility(user, `${PREFIX} Clear`);
  mock.registerFeed("/feed/clear", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.amy.email);
  const bridge = new FeedBridge(page.request);
  await bridge.setFeedUrl(orgId, mock.urlFor("/feed/clear"));
  await bridge.syncOne(orgId);

  expect(await feedEventsForOrg(user, orgId)).toHaveLength(1);

  expect(await bridge.clearFeedUrl(orgId)).toEqual({ ok: true });
  expect(await feedEventsForOrg(user, orgId)).toHaveLength(0);

  // A later sync finds no feed-configured Org and produces nothing.
  const after = await bridge.syncAll();
  expect(after).toEqual({ status: "ok", feeds: [] });
});

test("confirming an email candidate then a feed candidate for the same slot yields one Booking", async ({ page, accounts }) => {
  // Ben is on `EMAIL_SYNC_ALLOWLIST` for every worker, so the email
  // confirm path (`confirmImportCandidate`) is authorized for him even with
  // no Mailbox Link connected — it only re-validates a Booking form.
  const user = { email: accounts.ben.email, password: accounts.password };
  const orgId = await seedFacility(user, `${PREFIX} Dedup`);
  mock.registerFeed("/feed/dedup", { kind: "ics", body: icsBody([FUTURE_EVENT]) });

  await signIn(page, accounts.ben.email);
  const bridge = new FeedBridge(page.request);
  await bridge.setFeedUrl(orgId, mock.urlFor("/feed/dedup"));

  // Sync the feed first — the review list is shaped now, before any Booking exists.
  const feed = okFeed(await bridge.syncOne(orgId));
  if (feed.status !== "ok") throw new Error(feed.message);
  const feedCandidate = feed.items[0];

  // Confirm an *email* candidate for the exact same slot (same Org, court,
  // date, time). The feed review above ran before this Booking existed.
  const emailConfirm = await bridge.confirmEmailCandidate({
    gmail_message_id: "dedup-msg-1",
    org_id: orgId,
    name: "Doubles",
    format: "doubles",
    date: feedCandidate.date,
    start_time: feedCandidate.startTime,
    end_time: feedCandidate.endTime,
    court_label: feedCandidate.courtLabel ?? "",
    players: "",
  });
  expect(emailConfirm).toEqual({ ok: true });
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);

  // Now confirm the feed candidate for that same slot — the confirm-time
  // duplicate guard must stop a second Booking.
  expect(await bridge.confirm(feedCandidate, FUTURE_EVENT.start)).toEqual({ ok: true });
  expect(await bookingsForOrg(user, orgId)).toHaveLength(1);

  // And the reverse direction: the email confirm's own guard.
  const orgId2 = await seedFacility(user, `${PREFIX} Dedup2`);
  mock.registerFeed("/feed/dedup2", { kind: "ics", body: icsBody([{ ...FUTURE_EVENT, uid: "feed-evt-2" }]) });
  await bridge.setFeedUrl(orgId2, mock.urlFor("/feed/dedup2"));
  const feed2 = okFeed(await bridge.syncOne(orgId2));
  if (feed2.status !== "ok") throw new Error(feed2.message);

  expect(await bridge.confirm(feed2.items[0], FUTURE_EVENT.start)).toEqual({ ok: true });
  expect(await bookingsForOrg(user, orgId2)).toHaveLength(1);

  const emailConfirm2 = await bridge.confirmEmailCandidate({
    gmail_message_id: "dedup-msg-2",
    org_id: orgId2,
    name: "Doubles",
    format: "doubles",
    date: feed2.items[0].date,
    start_time: feed2.items[0].startTime,
    end_time: feed2.items[0].endTime,
    court_label: feed2.items[0].courtLabel ?? "",
    players: "",
  });
  expect(emailConfirm2).toEqual({ ok: true });
  expect(await bookingsForOrg(user, orgId2)).toHaveLength(1);
});
