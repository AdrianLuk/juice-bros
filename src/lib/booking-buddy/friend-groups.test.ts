import assert from "node:assert/strict";
import test from "node:test";

import {
  GROUP_NAME_MAX_LENGTH,
  groupWriteMessage,
  parseNewGroup,
  parseOverrideChoice,
} from "./friend-groups.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("a named group with a level is accepted", () => {
  assert.deepEqual(parseNewGroup(form({ name: "Tuesday crew", level: "calendar" })), {
    name: "Tuesday crew",
    level: "calendar",
  });
});

test("surrounding space is trimmed off the name", () => {
  // The unique index compares btrim(lower(name)), so an untrimmed name would
  // collide with its own trimmed twin in a way the User cannot see.
  const parsed = parseNewGroup(form({ name: "  Tuesday crew  ", level: "slots" }));
  assert.deepEqual(parsed, { name: "Tuesday crew", level: "slots" });
});

test("a blank name is refused", () => {
  for (const name of ["", "   "]) {
    assert.ok("error" in parseNewGroup(form({ name, level: "slots" })));
  }
});

test("an over-long name is refused before the database has to", () => {
  const parsed = parseNewGroup(
    form({ name: "a".repeat(GROUP_NAME_MAX_LENGTH + 1), level: "slots" }),
  );
  assert.ok("error" in parsed);
  assert.match(parsed.error, new RegExp(String(GROUP_NAME_MAX_LENGTH)));
});

test("a missing or unknown level is refused rather than defaulted", () => {
  // Defaulting would silently grant a level nobody picked, on a control whose
  // whole job is deciding what other people can see.
  assert.ok("error" in parseNewGroup(form({ name: "Crew" })));
  assert.ok("error" in parseNewGroup(form({ name: "Crew", level: "everything" })));
});

test("an override choice can be a level, or a deliberate clear", () => {
  assert.equal(parseOverrideChoice("calendar"), "calendar");
  assert.equal(parseOverrideChoice("clear"), "clear");
});

test("anything else is not read as a clear", () => {
  // "clear" is a distinct word rather than an empty value precisely so that a
  // level which failed to reach the server cannot be mistaken for "go back to
  // the group default" — which would quietly change what someone can see.
  for (const bad of ["", null, "everything", " "]) {
    assert.equal(parseOverrideChoice(bad), null);
  }
});

test("a duplicate group name is reported as a duplicate", () => {
  assert.match(groupWriteMessage({ code: "23505" }, "create"), /already have a group/i);
});

test("a rejected connection reads as the rule that rejected it", () => {
  // The trigger fires when a Connection isn't accepted, or isn't yours.
  assert.match(groupWriteMessage({ code: "23514" }, "add"), /friends/i);
});

test("each write says what failed, not just that something did", () => {
  assert.match(groupWriteMessage({ code: "08006" }, "add"), /add/i);
  assert.match(groupWriteMessage({ code: "08006" }, "remove"), /remove/i);
  assert.match(groupWriteMessage({ code: "08006" }, "delete"), /delete/i);
});
