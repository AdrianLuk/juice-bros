import assert from "node:assert/strict";
import test from "node:test";

import {
  dismissalPruneCutoff,
  readDismissedSlotPost,
} from "./dismissed-reservations.ts";

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return formData;
}

const SLOT = {
  org_id: "org-1",
  date: "2026-10-01",
  start_time: "18:00",
  court_label: "#9 - Hard",
};

test("an import candidate's Dismiss carries the slot it settles", () => {
  assert.deepEqual(readDismissedSlotPost(form(SLOT)), {
    orgId: "org-1",
    date: "2026-10-01",
    startTime: "18:00",
    courtLabel: "#9 - Hard",
  });
});

test("a facility that labels no courts dismisses a slot with no court", () => {
  assert.equal(readDismissedSlotPost(form({ ...SLOT, court_label: "" }))?.courtLabel, null);
  // The field left off the form entirely, not just posted blank.
  const noCourtField = form(SLOT);
  noCourtField.delete("court_label");
  assert.equal(readDismissedSlotPost(noCourtField)?.courtLabel, null);
});

test("a form posting no slot — a cancellation candidate's 'Keep booking' — reads as none", () => {
  assert.equal(readDismissedSlotPost(form({ feed_event_uid: "vevent-1", org_id: "org-1" })), null);
});

test("a slot missing any of Org, date or start time reads as none", () => {
  assert.equal(readDismissedSlotPost(form({ ...SLOT, org_id: "" })), null);
  assert.equal(readDismissedSlotPost(form({ ...SLOT, date: "" })), null);
  assert.equal(readDismissedSlotPost(form({ ...SLOT, start_time: "" })), null);
});

test("a date or time that isn't the shape the reviews compare reads as none", () => {
  assert.equal(readDismissedSlotPost(form({ ...SLOT, date: "01/10/2026" })), null);
  assert.equal(readDismissedSlotPost(form({ ...SLOT, start_time: "6:00 PM" })), null);
});

test("the prune cutoff sits a full day behind UTC's own date (#447)", () => {
  assert.equal(dismissalPruneCutoff(new Date("2026-10-01T00:00:00Z")), "2026-09-30");
  assert.equal(dismissalPruneCutoff(new Date("2026-10-01T23:59:59Z")), "2026-09-30");
});

test("a slot still live in the last zone on Earth is above the cutoff", () => {
  // 2026-10-02T05:00Z is still Oct 1 in Honolulu (UTC-10), so a dismissal
  // dated 2026-10-01 is still suppressing and must survive the prune. Deleting
  // it would un-suppress a reservation the User is about to play.
  const cutoff = dismissalPruneCutoff(new Date("2026-10-02T05:00:00Z"));
  assert.equal(cutoff, "2026-10-01");
  assert.ok("2026-10-01" >= cutoff, "a slot dated today is not below the cutoff");
});

test("the cutoff steps back over a month and a year boundary", () => {
  assert.equal(dismissalPruneCutoff(new Date("2026-03-01T12:00:00Z")), "2026-02-28");
  assert.equal(dismissalPruneCutoff(new Date("2027-01-01T12:00:00Z")), "2026-12-31");
});
