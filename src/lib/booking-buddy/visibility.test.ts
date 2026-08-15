import assert from "node:assert/strict";
import test from "node:test";

import { resolveVisibility, resolveVisibilityByConnection } from "./visibility.ts";

test("a per-friend override always wins over group defaults", () => {
  assert.equal(
    resolveVisibility({ groupLevels: ["calendar"], override: "slots" }),
    "slots",
  );
});

test("an override can also close access a group would have opened", () => {
  // The override is explicit, so it beats the group default in both
  // directions — otherwise there would be no way to shut one friend out
  // without dismantling the group they are in.
  assert.equal(
    resolveVisibility({ groupLevels: ["calendar"], override: "none" }),
    "none",
  );
});

test("a friend in two groups gets the most permissive of them", () => {
  assert.equal(
    resolveVisibility({ groupLevels: ["slots", "calendar"] }),
    "calendar",
  );
  assert.equal(
    resolveVisibility({ groupLevels: ["none", "slots"] }),
    "slots",
  );
});

test("slots and open_time are independent grants that union, not a scale", () => {
  // Neither is "more permissive" than the other — together they grant
  // everything calendar does, same as being in one calendar group.
  assert.equal(
    resolveVisibility({ groupLevels: ["slots", "open_time"] }),
    "calendar",
  );
  // A group only granting the other axis contributes nothing extra.
  assert.equal(
    resolveVisibility({ groupLevels: ["slots", "none"] }),
    "slots",
  );
  assert.equal(
    resolveVisibility({ groupLevels: ["open_time", "none"] }),
    "open_time",
  );
});

test("a friend with no group and no override has no access", () => {
  assert.equal(resolveVisibility({ groupLevels: [] }), "none");
  assert.equal(resolveVisibility({ groupLevels: [], override: null }), "none");
});

const AMY = "conn-amy";
const BEN = "conn-ben";
const CAL = "conn-cal";

test("resolves every accepted Connection, including ungrouped ones", () => {
  const resolved = resolveVisibilityByConnection({
    connectionIds: [AMY, BEN, CAL],
    groups: [
      { id: "g-tuesday", defaultVisibility: "calendar" },
      { id: "g-ladder", defaultVisibility: "slots" },
    ],
    memberships: [
      { groupId: "g-tuesday", connectionId: AMY },
      { groupId: "g-ladder", connectionId: AMY },
      { groupId: "g-ladder", connectionId: BEN },
    ],
    overrides: [{ connectionId: BEN, level: "none" }],
  });

  assert.equal(resolved.get(AMY), "calendar");
  assert.equal(resolved.get(BEN), "none");
  // Never silently absent: a friend in no group is "none", not undefined.
  assert.equal(resolved.get(CAL), "none");
});

test("a membership of a group that no longer exists is ignored", () => {
  const resolved = resolveVisibilityByConnection({
    connectionIds: [AMY],
    groups: [],
    memberships: [{ groupId: "g-deleted", connectionId: AMY }],
    overrides: [],
  });

  assert.equal(resolved.get(AMY), "none");
});

test("an override for a Connection that is no longer a friend is ignored", () => {
  const resolved = resolveVisibilityByConnection({
    connectionIds: [AMY],
    groups: [],
    memberships: [],
    overrides: [{ connectionId: "conn-removed", level: "calendar" }],
  });

  assert.deepEqual([...resolved.keys()], [AMY]);
});
