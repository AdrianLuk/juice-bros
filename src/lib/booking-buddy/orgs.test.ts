import assert from "node:assert/strict";
import test from "node:test";

import {
  ORG_NAME_MAX_LENGTH,
  orgDisplayName,
  orgWriteMessage,
  parseHandNamedOrg,
} from "./orgs.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("a hand-typed venue name is accepted", () => {
  assert.deepEqual(parseHandNamedOrg(form({ name: "Bob's backyard court" })), {
    name: "Bob's backyard court",
  });
});

test("surrounding space is trimmed off the name", () => {
  // The unique index compares btrim(lower(name)), so an untrimmed name would
  // collide with its own trimmed twin in a way the User cannot see.
  assert.deepEqual(parseHandNamedOrg(form({ name: "  Rally Point  " })), {
    name: "Rally Point",
  });
});

test("a blank name is refused", () => {
  for (const name of ["", "   "]) {
    assert.ok("error" in parseHandNamedOrg(form({ name })));
  }
});

test("an over-long name is refused before the database has to", () => {
  const parsed = parseHandNamedOrg(
    form({ name: "a".repeat(ORG_NAME_MAX_LENGTH + 1) }),
  );
  assert.ok("error" in parsed);
  assert.match(parsed.error, new RegExp(String(ORG_NAME_MAX_LENGTH)));
});

test("a hand-named Org is called what its owner typed", () => {
  assert.equal(
    orgDisplayName({ name: "Bob's backyard court", googlePlaceId: null }, null),
    "Bob's backyard court",
  );
});

test("a Place-backed Org is called what the cached Place is called", () => {
  // Never what its owner typed — a place-backed Org has no name of its own,
  // which is what stops one club drifting into three spellings (ADR 0005).
  assert.equal(
    orgDisplayName(
      { name: null, googlePlaceId: "ChIJpickleplex" },
      { name: "PicklePlex Downsview", formattedAddress: "70 Canuck Ave" },
    ),
    "PicklePlex Downsview",
  );
});

test("a Place-backed Org with no cached Place says so rather than inventing one", () => {
  // ADR 0005 names the cache miss as a new failure mode: the cache row may not
  // have been written yet, or Google may have been unreachable when it was
  // tried. A placeholder that reads like a real name would be a lie, and an
  // empty string would render as a blank row.
  const label = orgDisplayName(
    { name: null, googlePlaceId: "ChIJpickleplex" },
    null,
  );

  assert.notEqual(label.trim(), "");
  assert.match(label, /unavailable/i);
});

test("adding the same place twice is reported as the duplicate it is", () => {
  assert.match(orgWriteMessage({ code: "23505" }, "create"), /already/i);
});

test("each write says what failed, not just that something did", () => {
  assert.match(orgWriteMessage({ code: "08006" }, "create"), /add/i);
  assert.match(orgWriteMessage({ code: "08006" }, "delete"), /remove|delete/i);
});
