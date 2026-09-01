import assert from "node:assert/strict";
import test from "node:test";

import {
  mapCourtReserveFeedEvent,
  parseCourtReserveFeed,
} from "./courtreserve-feed.ts";
import type { IcsFeedEvent } from "./ics-feed.ts";

const TORONTO = "America/Toronto";

// --- Real-feed regression test -------------------------------------------
//
// The body below is a real CourtReserve member calendar feed — the `.ics`
// downloaded from one account's "Calendar feed" link — not a reconstruction.
// It is byte-for-byte what CourtReserve served, except: the club name
// ("Vaughan Pickleball") is swapped for the placeholder the rest of the
// booking-buddy tests use, and the numeric ids in each UID are replaced with
// obviously-fake sequential values (this repo is public). Everything that
// drives the parse — the `ical.net` PRODID, the property set and order, the
// floating `CREATED` stamps, the `Z`-suffixed `DTSTART`/`DTEND`, the
// `SUMMARY`/`LOCATION`/`DESCRIPTION` shape — is exactly as captured. This is
// what the `SUMMARY`/`LOCATION`/`DESCRIPTION` -> Booking field mapping was
// finalised against (spec #288; ADR-0009 records why this waited for a real
// sample).
const REAL_FEED = [
  "BEGIN:VCALENDAR",
  "PRODID:-//github.com/rianjs/ical.net//NONSGML ical.net 4.0//EN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260823T233153",
  "DESCRIPTION:Court #10",
  "DTEND:20260903T000000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260902T220000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Doubles",
  "UID:CR_40100@70000001",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260824T120241",
  "DESCRIPTION:Court #5",
  "DTEND:20260904T000000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260903T220000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Doubles",
  "UID:CR_40100@70000002",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260825T185056",
  "DESCRIPTION:Court #8",
  "DTEND:20260904T180000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260904T160000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Singles",
  "UID:CR_40100@70000003",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260826T130014",
  "DESCRIPTION:Court #11",
  "DTEND:20260905T200000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260905T180000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Singles",
  "UID:CR_40100@70000004",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260831T020605",
  "DESCRIPTION:Court #1",
  "DTEND:20260831T190000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260831T170000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Singles",
  "UID:CR_40100@70000005",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260831T020605",
  "DESCRIPTION:Court #9",
  "DTEND:20260902T180000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260902T160000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Singles",
  "UID:CR_40100@70000006",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260831T023558",
  "DESCRIPTION:Court #6",
  "DTEND:20260901T200000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260901T180000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Singles",
  "UID:CR_40100@70000007",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "CLASS:PUBLIC",
  "CREATED:20260831T120117",
  "DESCRIPTION:Court #9",
  "DTEND:20260911T010000Z",
  "DTSTAMP:20260901T170208Z",
  "DTSTART:20260910T230000Z",
  "LOCATION:PicklePlex Downsview",
  "SEQUENCE:0",
  "SUMMARY:Doubles",
  "UID:CR_40100@70000008",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

test("the real captured member feed maps to eight reservation-shaped events", () => {
  const { events, unreadableUids } = parseCourtReserveFeed(REAL_FEED, {
    fallbackTimeZone: TORONTO,
  });

  assert.deepEqual(unreadableUids, []);
  assert.deepEqual(events, [
    {
      uid: "CR_40100@70000001",
      sequence: 0,
      startsAt: "2026-09-02T22:00:00.000Z",
      endsAt: "2026-09-03T00:00:00.000Z",
      format: "doubles",
      name: "Doubles",
      courtLabel: "Court #10",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
    {
      uid: "CR_40100@70000002",
      sequence: 0,
      startsAt: "2026-09-03T22:00:00.000Z",
      endsAt: "2026-09-04T00:00:00.000Z",
      format: "doubles",
      name: "Doubles",
      courtLabel: "Court #5",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
    {
      uid: "CR_40100@70000003",
      sequence: 0,
      startsAt: "2026-09-04T16:00:00.000Z",
      endsAt: "2026-09-04T18:00:00.000Z",
      format: "singles",
      name: "Singles",
      courtLabel: "Court #8",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
    {
      uid: "CR_40100@70000004",
      sequence: 0,
      startsAt: "2026-09-05T18:00:00.000Z",
      endsAt: "2026-09-05T20:00:00.000Z",
      format: "singles",
      name: "Singles",
      courtLabel: "Court #11",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
    {
      uid: "CR_40100@70000005",
      sequence: 0,
      startsAt: "2026-08-31T17:00:00.000Z",
      endsAt: "2026-08-31T19:00:00.000Z",
      format: "singles",
      name: "Singles",
      courtLabel: "Court #1",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
    {
      uid: "CR_40100@70000006",
      sequence: 0,
      startsAt: "2026-09-02T16:00:00.000Z",
      endsAt: "2026-09-02T18:00:00.000Z",
      format: "singles",
      name: "Singles",
      courtLabel: "Court #9",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
    {
      uid: "CR_40100@70000007",
      sequence: 0,
      startsAt: "2026-09-01T18:00:00.000Z",
      endsAt: "2026-09-01T20:00:00.000Z",
      format: "singles",
      name: "Singles",
      courtLabel: "Court #6",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
    {
      uid: "CR_40100@70000008",
      sequence: 0,
      startsAt: "2026-09-10T23:00:00.000Z",
      endsAt: "2026-09-11T01:00:00.000Z",
      format: "doubles",
      name: "Doubles",
      courtLabel: "Court #9",
      facilityName: "PicklePlex Downsview",
      playerNames: [],
      cancelled: false,
    },
  ]);
});

// --- mapCourtReserveFeedEvent unit tests --------------------------------

function icsEvent(overrides: Partial<IcsFeedEvent> = {}): IcsFeedEvent {
  return {
    uid: "CR_40100@70000009",
    sequence: 0,
    summary: "Doubles",
    location: "PicklePlex Downsview",
    description: "Court #3",
    start: "2026-09-15T23:00:00.000Z",
    end: "2026-09-16T00:00:00.000Z",
    status: "confirmed",
    ...overrides,
  };
}

test("SUMMARY drives format and is kept verbatim as the display name", () => {
  assert.equal(mapCourtReserveFeedEvent(icsEvent({ summary: "Singles" })).format, "singles");
  assert.equal(mapCourtReserveFeedEvent(icsEvent({ summary: "Doubles" })).format, "doubles");

  const mapped = mapCourtReserveFeedEvent(icsEvent({ summary: "Singles" }));
  assert.equal(mapped.name, "Singles");
});

test("an unexpected SUMMARY falls back to the default format but keeps its own name", () => {
  const mapped = mapCourtReserveFeedEvent(icsEvent({ summary: "Round Robin" }));
  assert.equal(mapped.format, "doubles");
  assert.equal(mapped.name, "Round Robin");
});

test("DESCRIPTION becomes the raw court label; blank becomes null", () => {
  assert.equal(
    mapCourtReserveFeedEvent(icsEvent({ description: "Court #10" })).courtLabel,
    "Court #10",
  );
  assert.equal(mapCourtReserveFeedEvent(icsEvent({ description: "   " })).courtLabel, null);
  assert.equal(mapCourtReserveFeedEvent(icsEvent({ description: "" })).courtLabel, null);
});

test("LOCATION becomes the informational facility name", () => {
  assert.equal(
    mapCourtReserveFeedEvent(icsEvent({ location: "Riverdale Courts" })).facilityName,
    "Riverdale Courts",
  );
});

test("players are always empty — a CourtReserve member feed carries none", () => {
  assert.deepEqual(mapCourtReserveFeedEvent(icsEvent()).playerNames, []);
});

test("an explicit cancelled status is surfaced", () => {
  assert.equal(mapCourtReserveFeedEvent(icsEvent({ status: "cancelled" })).cancelled, true);
  assert.equal(mapCourtReserveFeedEvent(icsEvent({ status: "confirmed" })).cancelled, false);
  assert.equal(mapCourtReserveFeedEvent(icsEvent({ status: "tentative" })).cancelled, false);
});

test("instants and sequence pass straight through", () => {
  const mapped = mapCourtReserveFeedEvent(
    icsEvent({ sequence: 4, start: "2026-09-15T23:00:00.000Z", end: "2026-09-16T00:00:00.000Z" }),
  );
  assert.equal(mapped.sequence, 4);
  assert.equal(mapped.startsAt, "2026-09-15T23:00:00.000Z");
  assert.equal(mapped.endsAt, "2026-09-16T00:00:00.000Z");
});

test("parseCourtReserveFeed forwards the parser's unreadable UIDs", () => {
  const text = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:CR_40100@70000010",
    "SUMMARY:Doubles",
    "DESCRIPTION:Court #2",
    "DTSTART:20260915T233000Z",
    "DTEND:20260916T003000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const { events, unreadableUids } = parseCourtReserveFeed(text, { fallbackTimeZone: TORONTO });
  assert.deepEqual(events, []);
  assert.deepEqual(unreadableUids, ["CR_40100@70000010"]);
});
