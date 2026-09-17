import assert from "node:assert/strict";
import test from "node:test";

import { collapseSpaces, parseClubDraft, serializeClubDraft } from "./club-draft.ts";

test("a draft round-trips through serialize/parse", () => {
  const draft = { name: "Riverside Pickleball", courtCount: "6" };
  assert.deepEqual(parseClubDraft(serializeClubDraft(draft)), draft);
});

test("nothing typed parses to no draft", () => {
  assert.equal(parseClubDraft(undefined), null);
  assert.equal(parseClubDraft(null), null);
  assert.equal(parseClubDraft(""), null);
  assert.equal(serializeClubDraft({ name: "", courtCount: "" }), '{"name":"","courtCount":""}');
  assert.equal(parseClubDraft(serializeClubDraft({ name: "", courtCount: "" })), null);
});

test("a cookie value that isn't this shape comes back as no draft, not a throw", () => {
  assert.equal(parseClubDraft("not json"), null);
  assert.equal(parseClubDraft("null"), null);
  assert.equal(parseClubDraft("42"), null);
  assert.equal(parseClubDraft('{"unrelated":"shape"}'), null);
  assert.equal(parseClubDraft('{"name":123,"courtCount":6}'), null);
});

test("a partial draft still counts, so either field alone survives", () => {
  assert.deepEqual(parseClubDraft(serializeClubDraft({ name: "Riverside", courtCount: "" })), {
    name: "Riverside",
    courtCount: "",
  });
  assert.deepEqual(parseClubDraft(serializeClubDraft({ name: "", courtCount: "6" })), {
    name: "",
    courtCount: "6",
  });
});

test("an oversized value is capped rather than rejected", () => {
  const longName = "x".repeat(500);
  const draft = parseClubDraft(serializeClubDraft({ name: longName, courtCount: "999" }));
  assert.ok(draft);
  assert.equal(draft.name.length, 120);
  // Capped to how many digits the real upper bound (40) takes — a longer
  // string is someone's mis-typed number, not a court count worth keeping.
  assert.equal(draft.courtCount, "99");
});

test("padding a name with whitespace can't push real characters past the cap", () => {
  const padded = " ".repeat(30) + "x".repeat(100);
  const draft = parseClubDraft(serializeClubDraft({ name: padded, courtCount: "" }));
  assert.ok(draft);
  // Trimmed before slicing (both here and on read), so the 100 real
  // characters survive intact instead of losing 10 of them to the padding.
  assert.equal(draft.name, "x".repeat(100));
});

test("collapseSpaces trims and collapses internal whitespace runs", () => {
  assert.equal(collapseSpaces("  Riverside   Pickleball  "), "Riverside Pickleball");
  assert.equal(collapseSpaces(""), "");
});

test("a name's internal whitespace is collapsed the same way validateClubName collapses it", () => {
  const draft = parseClubDraft(
    serializeClubDraft({ name: "Riverside   Pickleball", courtCount: "" }),
  );
  assert.ok(draft);
  assert.equal(draft.name, "Riverside Pickleball");
});
