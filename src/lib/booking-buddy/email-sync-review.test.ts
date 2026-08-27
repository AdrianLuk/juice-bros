import assert from "node:assert/strict";
import test from "node:test";

import { reviewCourtReserveEmails, type RawCourtReserveEmail } from "./email-sync-review.ts";

// --- synthetic CourtReserve email HTML ------------------------------------
//
// `courtreserve-email.test.ts` owns "does real captured CourtReserve HTML
// parse correctly", against byte-exact fixtures. These tests are about what
// `reviewCourtReserveEmails` does *with* a batch of already-parseable emails
// — the filtering, batch netting, facility/Booking/player matching and
// ordering — so the HTML here is only the minimum shape
// `parseCourtReserveEmail` needs, assembled per scenario.

/** An `<h4>` heading immediately followed by its `<h5>` value — CourtReserve's field-group shape. */
function section(heading: string, valueHtml: string): string {
  return `<h4>${heading}</h4><table><tr><td>&nbsp;</td></tr></table><h5>${valueHtml}</h5>`;
}

/** "18:00" -> "6:00 PM" — the parser reads the email's own 12-hour clock text. */
function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const meridiem = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

function timeText(start: string, end: string | null): string {
  return end ? `${clock12(start)} - ${clock12(end)}` : clock12(start);
}

function logo(facility: string): string {
  return `<img border="0" src="https://example.com/logo.jpg" alt="${facility}">`;
}

type SlotFields = {
  facility?: string;
  /** `YYYY-MM-DD` — the parser accepts this shape directly. */
  date?: string;
  /** `HH:MM`, 24-hour. */
  start?: string;
  /** `HH:MM` 24-hour, or `null` for the "no end time" malformed case. */
  end?: string | null;
  /** `null` omits the court entirely (a facility that doesn't label its courts). */
  court?: string | null;
  /** `null` omits the player list entirely. */
  players?: string | null;
};

const DEFAULTS = {
  facility: "PicklePlex Downsview",
  date: "2026-07-01",
  start: "18:00",
  end: "19:00" as string | null,
  court: "Court 3" as string | null,
  players: "Amy Ace, Ben Backhand" as string | null,
};

function confirmationHtml(fields: SlotFields = {}): string {
  const { facility, date, start, end, court, players } = { ...DEFAULTS, ...fields };
  return `<html><body>${logo(facility)}${section("Details", `Doubles<br>${date}<br>${timeText(start, end)}`)}${
    players !== null ? section("Player(s)", players) : ""
  }${court !== null ? section("Court(s)", court) : ""}</body></html>`;
}

function cancellationHtml(fields: SlotFields = {}): string {
  const { facility, date, start, end } = { ...DEFAULTS, ...fields };
  return `<html><body>${logo(facility)}${section(
    "Cancellation Details",
    `Amy Ace<br>Doubles<br>${date}<br>${timeText(start, end)}`,
  )}</body></html>`;
}

function updateHtml(fields: SlotFields = {}): string {
  const { facility, date, start, end, court, players } = { ...DEFAULTS, ...fields };
  const detailsValue =
    court !== null
      ? `Doubles<br>${date}<br>${timeText(start, end)}<br>${court}`
      : `Doubles<br>${date}<br>${timeText(start, end)}`;
  return `<html><body>${logo(facility)}${section("Reservation Details", detailsValue)}${
    players !== null ? section("Player(s)", players) : ""
  }</body></html>`;
}

const CONFIRM_SUBJECT = "Booking Confirmation for your reservation";
const CANCEL_SUBJECT = "Your reservation has been cancelled";
const UPDATE_SUBJECT = "Reservation Update Notice";

let seq = 0;
function email(
  subject: string,
  html: string,
  opts: { id?: string; receivedAt?: number } = {},
): RawCourtReserveEmail {
  seq += 1;
  return {
    gmailMessageId: opts.id ?? `msg-${seq}`,
    subject,
    html,
    receivedAt: opts.receivedAt ?? seq * 1000,
  };
}

const NOW = new Date("2026-06-15T12:00:00Z");
const ORG = { orgId: "org-pp", displayName: "PicklePlex Downsview", timeZone: "America/Toronto" };

type ReviewInput = Parameters<typeof reviewCourtReserveEmails>[0];

function review(emails: RawCourtReserveEmail[], ctx: Partial<ReviewInput> = {}) {
  return reviewCourtReserveEmails({
    emails,
    orgs: ctx.orgs ?? [ORG],
    existingBookings: ctx.existingBookings ?? [],
    connectionCandidates: ctx.connectionCandidates ?? [],
    now: ctx.now ?? NOW,
  });
}

// `reviewCourtReserveEmails` returns one flat `items` list across all three
// kinds; the review screen groups it back by `kind` for display, and so do
// these helpers for the per-kind assertions below. `filter` preserves the
// list's own date sort, so each group is date-sorted just like the screen's.
type ReviewResult = ReturnType<typeof review>;
const importsOf = (r: ReviewResult) => r.items.filter((item) => item.kind === "import");
const cancellationsOf = (r: ReviewResult) => r.items.filter((item) => item.kind === "cancellation");
const updatesOf = (r: ReviewResult) => r.items.filter((item) => item.kind === "update");

test("a future confirmation becomes an import candidate with its Org and players matched", () => {
  const result = review(
    [
      email(
        CONFIRM_SUBJECT,
        confirmationHtml({ date: "2026-07-01", start: "18:00", end: "19:00", court: "Court 5", players: "Amy Ace" }),
      ),
    ],
    { connectionCandidates: [{ userId: "u-amy", displayName: "Amy Ace" }] },
  );

  assert.equal(result.items.length, 1);
  const candidate = importsOf(result)[0];
  assert.equal(candidate.kind, "import");
  assert.equal(candidate.matchedOrgId, "org-pp");
  assert.equal(candidate.date, "2026-07-01");
  assert.equal(candidate.startTime, "18:00");
  assert.equal(candidate.endTime, "19:00");
  // stripCourtLabelPrefix drops the template's leading "Court" word.
  assert.equal(candidate.courtLabel, "5");
  assert.deepEqual(candidate.matchedPlayers, [{ name: "Amy Ace", userId: "u-amy" }]);
  assert.deepEqual(cancellationsOf(result), []);
  assert.deepEqual(updatesOf(result), []);
});

test("a confirmation for a date already past is dropped, never surfaced", () => {
  const result = review([email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-01-01" }))]);
  assert.deepEqual(result.items, []);
});

test("past-ness is judged in the matched Org's own zone", () => {
  // 2026-06-15 00:30 in Toronto is still 2026-06-14 in UTC — the check must
  // use the Org's zone, not the raw instant, so this same-day slot survives.
  const nearMidnight = new Date("2026-06-15T04:30:00Z");
  const result = review([email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-06-15" }))], { now: nearMidnight });
  assert.equal(importsOf(result).length, 1);
});

test("a confirmation that duplicates a booking already on file is dropped", () => {
  const result = review(
    [email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-01", start: "18:00", court: "Court 3" }))],
    {
      existingBookings: [
        { id: "b1", orgId: "org-pp", courtLabel: "3", date: "2026-07-01", startTime: "18:00" },
      ],
    },
  );
  assert.deepEqual(result.items, []);
});

test("a confirmation whose time range has no end is dropped before matching", () => {
  const result = review([email(CONFIRM_SUBJECT, confirmationHtml({ end: null }))]);
  assert.deepEqual(result, { items: [] });
});

test("an email that isn't a booking notification is ignored", () => {
  const result = review([email("Your CourtReserve waitlist spot opened up", confirmationHtml())]);
  assert.deepEqual(result, { items: [] });
});

test("an email that looks like a confirmation but whose body doesn't parse is dropped", () => {
  const result = review([email(CONFIRM_SUBJECT, "<html><body>nothing here</body></html>")]);
  assert.deepEqual(result, { items: [] });
});

test("a cancellation matched to a booking on file carries that booking's id", () => {
  const result = review(
    [email(CANCEL_SUBJECT, cancellationHtml({ date: "2026-07-01", start: "18:00" }))],
    { existingBookings: [{ id: "b7", orgId: "org-pp", courtLabel: "3", date: "2026-07-01", startTime: "18:00" }] },
  );

  assert.equal(result.items.length, 1);
  const cancellation = cancellationsOf(result)[0];
  assert.equal(cancellation.kind, "cancellation");
  assert.equal(cancellation.matched, true);
  assert.equal(cancellation.matched && cancellation.bookingId, "b7");
});

test("a cancellation with nothing on file to match is surfaced as an unmatched notice, not dropped", () => {
  const result = review([email(CANCEL_SUBJECT, cancellationHtml())]);
  assert.equal(cancellationsOf(result).length, 1);
  assert.equal(cancellationsOf(result)[0].matched, false);
});

test("a reservation update matched to a booking on file carries its id and the revised fields", () => {
  const result = review(
    [email(UPDATE_SUBJECT, updateHtml({ date: "2026-07-01", start: "18:00", end: "20:00", court: "Court 9" }))],
    { existingBookings: [{ id: "b3", orgId: "org-pp", courtLabel: "3", date: "2026-07-01", startTime: "18:00" }] },
  );

  assert.equal(result.items.length, 1);
  const update = updatesOf(result)[0];
  assert.equal(update.kind, "update");
  assert.equal(update.matched, true);
  assert.equal(update.matched && update.bookingId, "b3");
  assert.equal(update.endTime, "20:00");
  assert.equal(update.courtLabel, "9");
});

test("a confirmation and a later cancellation for the same slot net to nothing", () => {
  const result = review([
    email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-01", start: "18:00" }), { receivedAt: 1000 }),
    email(CANCEL_SUBJECT, cancellationHtml({ date: "2026-07-01", start: "18:00" }), { receivedAt: 2000 }),
  ]);
  assert.deepEqual(result, { items: [] });
});

test("a confirmation then an update for the same slot yields one candidate carrying the update's fields and id", () => {
  const result = review([
    email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-01", start: "18:00", end: "19:00", court: "Court 3" }), {
      id: "m-confirm",
      receivedAt: 1000,
    }),
    email(UPDATE_SUBJECT, updateHtml({ date: "2026-07-01", start: "18:00", end: "21:00", court: "Court 8" }), {
      id: "m-update",
      receivedAt: 2000,
    }),
  ]);

  assert.equal(updatesOf(result).length, 0);
  assert.equal(importsOf(result).length, 1);
  assert.equal(importsOf(result)[0].endTime, "21:00");
  assert.equal(importsOf(result)[0].courtLabel, "8");
  assert.equal(importsOf(result)[0].gmailMessageId, "m-update");
});

test("candidates come back sorted by date, then start time", () => {
  const result = review([
    email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-05", start: "09:00", court: null }), { id: "jul5-0900" }),
    email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-01", start: "20:00", court: null }), { id: "jul1-2000" }),
    email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-01", start: "08:00", court: null }), { id: "jul1-0800" }),
  ]);

  assert.deepEqual(
    importsOf(result).map((candidate) => candidate.gmailMessageId),
    ["jul1-0800", "jul1-2000", "jul5-0900"],
  );
});

test("an overlong court label is carried in notes rather than dropped, with the label left blank", () => {
  const longCourt = `Court ${"A".repeat(60)}`;
  const result = review([email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-01", court: longCourt }))]);

  assert.equal(importsOf(result).length, 1);
  assert.equal(importsOf(result)[0].courtLabel, null);
  assert.equal(importsOf(result)[0].notes, "A".repeat(60));
});

test("a confirmation whose facility matches no Org still surfaces, unmatched", () => {
  const result = review(
    [email(CONFIRM_SUBJECT, confirmationHtml({ facility: "Some Other Club", date: "2026-07-01" }))],
    { orgs: [] },
  );

  assert.equal(importsOf(result).length, 1);
  assert.equal(importsOf(result)[0].matchedOrgId, null);
});

test("an unmatched confirmation is still date-filtered, in UTC", () => {
  // No Org means no known zone, so the past check falls back to UTC.
  const result = review([email(CONFIRM_SUBJECT, confirmationHtml({ facility: "Some Other Club", date: "2026-01-01" }))], {
    orgs: [],
  });
  assert.deepEqual(result.items, []);
});

test("confirmation, cancellation and update for three different slots each land in their own list", () => {
  const result = review(
    [
      email(CONFIRM_SUBJECT, confirmationHtml({ date: "2026-07-01", start: "08:00" })),
      email(CANCEL_SUBJECT, cancellationHtml({ date: "2026-07-02", start: "09:00" })),
      email(UPDATE_SUBJECT, updateHtml({ date: "2026-07-03", start: "10:00" })),
    ],
    { existingBookings: [{ id: "bx", orgId: "org-pp", courtLabel: null, date: "2026-07-03", startTime: "10:00" }] },
  );

  assert.equal(importsOf(result).length, 1);
  assert.equal(cancellationsOf(result).length, 1);
  assert.equal(updatesOf(result).length, 1);
  const [update] = updatesOf(result);
  assert.equal(update.matched && update.bookingId, "bx");
});
