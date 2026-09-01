import assert from "node:assert/strict";
import test from "node:test";

import { COURT_LABEL_MAX_LENGTH, NOTES_MAX_LENGTH } from "./bookings.ts";
import {
  isDuplicateBooking,
  isPastConfirmation,
  splitOverlongCourtLabel,
  stripCourtLabelPrefix,
} from "./import-candidate-shaping.ts";

test("a leading 'Court' word is stripped from a CourtReserve email's own court text", () => {
  assert.equal(stripCourtLabelPrefix("Court #6 - Hard"), "#6 - Hard");
  assert.equal(stripCourtLabelPrefix("Court 3"), "3");
  assert.equal(stripCourtLabelPrefix("COURT 3"), "3");
});

test("court text with no leading 'Court' word is left as-is", () => {
  assert.equal(stripCourtLabelPrefix("#6 - Hard"), "#6 - Hard");
});

test("a null or blank-after-stripping court label stays null", () => {
  assert.equal(stripCourtLabelPrefix(null), null);
  assert.equal(stripCourtLabelPrefix("Court"), null);
  assert.equal(stripCourtLabelPrefix("Court  "), null);
});

test("a court label within the length limit passes through unchanged, with no notes", () => {
  assert.deepEqual(splitOverlongCourtLabel("3"), { courtLabel: "3", notes: null });
  assert.deepEqual(splitOverlongCourtLabel(null), { courtLabel: null, notes: null });
});

test("a court label over the length limit (e.g. a Partner Play session listing every court) moves to notes instead", () => {
  const courts = "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14";
  assert.ok(courts.length > COURT_LABEL_MAX_LENGTH);
  assert.deepEqual(splitOverlongCourtLabel(courts), { courtLabel: null, notes: courts });
});

test("a court label over even the notes length limit is truncated rather than refused", () => {
  const huge = "a".repeat(NOTES_MAX_LENGTH + 50);
  const result = splitOverlongCourtLabel(huge);
  assert.equal(result.courtLabel, null);
  assert.equal(result.notes, huge.slice(0, NOTES_MAX_LENGTH));
});

const SAME_SLOT = { orgId: "org-1", courtLabel: "Court 3", date: "2026-09-15", startTime: "18:00" };

test("a candidate matching Org + court + date/time on an existing Booking is a duplicate", () => {
  assert.equal(isDuplicateBooking(SAME_SLOT, [SAME_SLOT]), true);
});

test("a different court is not a duplicate, even at the same Org/date/time", () => {
  const existing = { ...SAME_SLOT, courtLabel: "Court 4" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a different date is not a duplicate", () => {
  const existing = { ...SAME_SLOT, date: "2026-09-16" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a different start time is not a duplicate", () => {
  const existing = { ...SAME_SLOT, startTime: "19:00" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a different Org is not a duplicate, even with everything else matching", () => {
  const existing = { ...SAME_SLOT, orgId: "org-2" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a null courtLabel on both sides still counts as matching, not as two different unlabeled courts", () => {
  const candidate = { ...SAME_SLOT, courtLabel: null };
  const existing = { ...SAME_SLOT, courtLabel: null };
  assert.equal(isDuplicateBooking(candidate, [existing]), true);
});

test("no existing Bookings at all is never a duplicate", () => {
  assert.equal(isDuplicateBooking(SAME_SLOT, []), false);
});

test("a confirmation dated before today in its own zone is past", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  assert.equal(isPastConfirmation({ date: "2026-09-15" }, "America/Toronto", now), true);
});

test("a confirmation dated today or later is not past", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  assert.equal(isPastConfirmation({ date: "2026-09-15" }, "America/Toronto", now), false);
  assert.equal(isPastConfirmation({ date: "2026-09-16" }, "America/Toronto", now), false);
});
