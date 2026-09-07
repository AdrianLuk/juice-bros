import assert from "node:assert/strict";
import test from "node:test";

import { readDismissedSlotPost } from "./dismissed-reservations.ts";

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
