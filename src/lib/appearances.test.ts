import assert from "node:assert/strict";
import test from "node:test";

import type { Appearance } from "../../content/appearances.ts";
import {
  appearanceEndDate,
  appearanceStartDate,
  buildAppearanceEvent,
  confirmedUpcomingEvents,
  describePlayers,
  formatAppearanceDates,
  formatShortDay,
  nextConfirmedAppearance,
  splitAppearances,
} from "./appearances.ts";

function make(overrides: Partial<Appearance> = {}): Appearance {
  return {
    name: "Test Open",
    date: "2026-09-01",
    location: "Somewhere, ON",
    status: "confirmed",
    players: "both",
    ...overrides,
  };
}

test("appearanceStartDate/EndDate read a single-day entry from `date`", () => {
  const a = make({ date: "2026-09-01", startDate: undefined, endDate: undefined });
  assert.equal(appearanceStartDate(a), "2026-09-01");
  assert.equal(appearanceEndDate(a), "2026-09-01");
});

test("appearanceStartDate/EndDate read a range from startDate/endDate", () => {
  const a = make({ date: undefined, startDate: "2026-09-17", endDate: "2026-09-20" });
  assert.equal(appearanceStartDate(a), "2026-09-17");
  assert.equal(appearanceEndDate(a), "2026-09-20");
});

test("splitAppearances puts an entry whose end date is before today in `past`", () => {
  const past = make({ name: "Old", date: "2026-06-01" });
  const { upcoming, past: pastList } = splitAppearances([past], new Date("2026-08-27T12:00:00Z"));
  assert.deepEqual(upcoming, []);
  assert.deepEqual(pastList.map((a) => a.name), ["Old"]);
});

test("splitAppearances keeps a tournament running today in `upcoming`", () => {
  const running = make({ name: "Now", startDate: "2026-08-24", endDate: "2026-08-30" });
  const { upcoming } = splitAppearances([running], new Date("2026-08-27T12:00:00Z"));
  assert.deepEqual(upcoming.map((a) => a.name), ["Now"]);
});

test("splitAppearances sorts upcoming soonest-first and past most-recent-first", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  const list = [
    make({ name: "Nov", date: "2026-11-26" }),
    make({ name: "Sep", date: "2026-09-17" }),
    make({ name: "LastYear", date: "2025-10-01" }),
    make({ name: "June", date: "2026-06-01" }),
  ];
  const { upcoming, past } = splitAppearances(list, now);
  assert.deepEqual(upcoming.map((a) => a.name), ["Sep", "Nov"]);
  assert.deepEqual(past.map((a) => a.name), ["June", "LastYear"]);
});

test("nextConfirmedAppearance returns the soonest confirmed upcoming entry, skipping tentative and past", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  const list = [
    make({ name: "Tentative soon", date: "2026-09-01", status: "tentative" }),
    make({ name: "Confirmed later", date: "2026-09-17", status: "confirmed" }),
    make({ name: "Confirmed past", date: "2026-06-01", status: "confirmed" }),
  ];
  assert.equal(nextConfirmedAppearance(list, now)?.name, "Confirmed later");
});

test("nextConfirmedAppearance returns null when nothing confirmed is upcoming", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  assert.equal(nextConfirmedAppearance([make({ status: "tentative" })], now), null);
});

test("formatAppearanceDates: single day, same-month range, cross-month range", () => {
  assert.equal(formatAppearanceDates(make({ date: "2026-09-26" })), "Sep 26, 2026");
  assert.equal(
    formatAppearanceDates(make({ date: undefined, startDate: "2026-08-28", endDate: "2026-08-29" })),
    "Aug 28-29, 2026",
  );
  assert.equal(
    formatAppearanceDates(make({ date: undefined, startDate: "2026-09-30", endDate: "2026-10-04" })),
    "Sep 30 - Oct 4, 2026",
  );
});

test("formatShortDay gives a month + day label with no year", () => {
  assert.equal(formatShortDay("2026-08-29"), "Aug 29");
  assert.equal(formatShortDay("2026-09-01"), "Sep 1");
});

test("describePlayers covers both, solo, and an explicit name list", () => {
  assert.equal(describePlayers("both"), "Adrian and Daven");
  assert.equal(describePlayers("adrian"), "Adrian");
  assert.equal(describePlayers("daven"), "Daven");
  assert.equal(describePlayers(["Adrian", "Daven"]), "Adrian and Daven");
  assert.equal(describePlayers(["Adrian"]), "Adrian");
});

test("buildAppearanceEvent maps a range to startDate + endDate with a Place location", () => {
  const event = buildAppearanceEvent(
    make({ date: undefined, startDate: "2026-09-17", endDate: "2026-09-20", location: "The Backyard Club, Vaughan, ON" }),
  );
  assert.equal(event["@type"], "Event");
  assert.equal(event.startDate, "2026-09-17");
  assert.equal((event as { endDate?: string }).endDate, "2026-09-20");
  assert.deepEqual(event.location, {
    "@type": "Place",
    name: "The Backyard Club, Vaughan, ON",
    address: "The Backyard Club, Vaughan, ON",
  });
});

test("buildAppearanceEvent omits endDate for a single-day event and url when absent", () => {
  const event = buildAppearanceEvent(make({ date: "2026-09-26", url: undefined }));
  assert.equal(event.startDate, "2026-09-26");
  assert.ok(!("endDate" in event));
  assert.ok(!("url" in event));
});

test("confirmedUpcomingEvents keeps only confirmed upcoming entries, soonest-first", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  const list = [
    make({ name: "Confirmed Nov", date: "2026-11-26", status: "confirmed" }),
    make({ name: "Tentative Sep", date: "2026-09-26", status: "tentative" }),
    make({ name: "Confirmed Sep", date: "2026-09-17", status: "confirmed" }),
    make({ name: "Confirmed past", date: "2026-06-01", status: "confirmed" }),
  ];
  assert.deepEqual(
    confirmedUpcomingEvents(list, now).map((event) => event.name),
    ["Confirmed Sep", "Confirmed Nov"],
  );
});
