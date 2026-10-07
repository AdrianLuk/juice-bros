import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDIDATE_FIELD,
  decodeCandidate,
  encodeCandidate,
  type Candidate,
} from "./import-candidate-token.ts";

function posted(token: string): FormData {
  const formData = new FormData();
  formData.set(CANDIDATE_FIELD, token);
  return formData;
}

const SLOT = { orgId: "org-1", date: "2026-10-01", startTime: "18:00", courtLabel: "#9 - Hard" };
const FEED = { orgId: "org-1", uid: "evt-1@courtreserve", sequence: 2, startsAt: "2026-10-01T22:00:00.000Z" };

const EMAIL_IMPORT: Candidate = { kind: "import", messageId: "msg-1", feed: null, slot: SLOT };
const FEED_IMPORT: Candidate = { kind: "import", messageId: null, feed: FEED, slot: SLOT };
const MERGED_IMPORT: Candidate = { kind: "import", messageId: "msg-1", feed: FEED, slot: SLOT };

test("an email Import Candidate survives the round trip", () => {
  assert.deepEqual(decodeCandidate(posted(encodeCandidate(EMAIL_IMPORT))), EMAIL_IMPORT);
});

test("a feed Import Candidate survives the round trip", () => {
  assert.deepEqual(decodeCandidate(posted(encodeCandidate(FEED_IMPORT))), FEED_IMPORT);
});

test("a merged Import Candidate survives the round trip", () => {
  assert.deepEqual(decodeCandidate(posted(encodeCandidate(MERGED_IMPORT))), MERGED_IMPORT);
});

test("an email whose facility matched no Org carries no slot", () => {
  const unmatched: Candidate = { ...EMAIL_IMPORT, slot: null };
  assert.deepEqual(decodeCandidate(posted(encodeCandidate(unmatched))), unmatched);
});

test("a slot with no court reads back as a null court", () => {
  const token = encodeCandidate({ ...FEED_IMPORT, slot: { ...SLOT, courtLabel: "  " } });
  assert.equal(decodeCandidate(posted(token))?.slot?.courtLabel, null);
});

test("a feed start written with an offset reads back as the same instant in UTC", () => {
  const token = encodeCandidate({
    ...FEED_IMPORT,
    feed: { ...FEED, startsAt: "2026-10-01T18:00:00-04:00" },
  });
  assert.equal(decodeCandidate(posted(token))?.feed?.startsAt, "2026-10-01T22:00:00.000Z");
});

test("a form with no candidate field is refused", () => {
  assert.equal(decodeCandidate(new FormData()), null);
});

test("a candidate field that isn't JSON is refused", () => {
  assert.equal(decodeCandidate(posted("{not json")), null);
});

test("a candidate of an unknown kind is refused", () => {
  assert.equal(decodeCandidate(posted(JSON.stringify({ ...EMAIL_IMPORT, kind: "booking" }))), null);
});

test("a candidate with no source at all is refused", () => {
  assert.equal(decodeCandidate(posted(JSON.stringify({ ...EMAIL_IMPORT, messageId: null }))), null);
});

test("a blank or missing message id is refused", () => {
  assert.equal(decodeCandidate(posted(JSON.stringify({ ...EMAIL_IMPORT, messageId: " " }))), null);
  const withoutMessageId: Partial<Candidate> = { ...EMAIL_IMPORT };
  delete withoutMessageId.messageId;
  assert.equal(decodeCandidate(posted(JSON.stringify(withoutMessageId))), null);
});

test("a feed event missing its uid or Org is refused", () => {
  for (const feed of [{ ...FEED, uid: "" }, { ...FEED, orgId: undefined }]) {
    const token = JSON.stringify({ ...FEED_IMPORT, feed });
    assert.equal(decodeCandidate(posted(token)), null, JSON.stringify(feed));
  }
});

test("a feed sequence that isn't a whole number is refused rather than read as 0", () => {
  for (const sequence of [-1, 1.5, "2", null]) {
    const token = JSON.stringify({ ...FEED_IMPORT, feed: { ...FEED, sequence } });
    assert.equal(decodeCandidate(posted(token)), null, `sequence ${String(sequence)}`);
  }
});

test("a feed start that isn't a date is refused rather than read as the epoch", () => {
  for (const startsAt of ["", "soon", null]) {
    const token = JSON.stringify({ ...FEED_IMPORT, feed: { ...FEED, startsAt } });
    assert.equal(decodeCandidate(posted(token)), null, `startsAt ${String(startsAt)}`);
  }
});

test("a malformed slot is refused", () => {
  for (const slot of [
    { ...SLOT, orgId: "" },
    { ...SLOT, date: "10/01/2026" },
    { ...SLOT, startTime: "6pm" },
    { ...SLOT, courtLabel: 9 },
    "org-1|2026-10-01|18:00",
  ]) {
    const token = JSON.stringify({ ...FEED_IMPORT, slot });
    assert.equal(decodeCandidate(posted(token)), null, JSON.stringify(slot));
  }
});
