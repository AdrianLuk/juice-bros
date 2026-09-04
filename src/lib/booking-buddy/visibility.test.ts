import assert from "node:assert/strict";
import test from "node:test";

import { resolveVisibility, resolveVisibilityByConnection } from "./visibility.ts";

test("a per-friend override always wins over group defaults", () => {
  assert.equal(
    resolveVisibility({
      defaultLevel: "none",
      groupLevels: ["calendar"],
      override: "slots",
    }),
    "slots",
  );
});

test("an override can also close access a group would have opened", () => {
  // The override is explicit, so it beats the group default in both
  // directions — otherwise there would be no way to shut one friend out
  // without dismantling the group they are in.
  assert.equal(
    resolveVisibility({
      defaultLevel: "none",
      groupLevels: ["calendar"],
      override: "none",
    }),
    "none",
  );
});

test("a friend in two groups gets the most permissive of them", () => {
  assert.equal(
    resolveVisibility({ defaultLevel: "none", groupLevels: ["slots", "calendar"] }),
    "calendar",
  );
  assert.equal(
    resolveVisibility({ defaultLevel: "none", groupLevels: ["none", "slots"] }),
    "slots",
  );
});

test("slots and open_time are independent grants that union, not a scale", () => {
  // Neither is "more permissive" than the other — together they grant
  // everything calendar does, same as being in one calendar group.
  assert.equal(
    resolveVisibility({ defaultLevel: "none", groupLevels: ["slots", "open_time"] }),
    "calendar",
  );
  // A group only granting the other axis contributes nothing extra.
  assert.equal(
    resolveVisibility({ defaultLevel: "none", groupLevels: ["slots", "none"] }),
    "slots",
  );
  assert.equal(
    resolveVisibility({ defaultLevel: "none", groupLevels: ["open_time", "none"] }),
    "open_time",
  );
});

test("a friend in no group and with no override falls to the owner's default", () => {
  // The floor of the lattice is the owner's own setting (ADR 0021), not a
  // hardcoded `none`: accepting a Connection is enough on the `calendar`
  // default, and turning that default down closes every friend still on it.
  assert.equal(resolveVisibility({ defaultLevel: "calendar", groupLevels: [] }), "calendar");
  assert.equal(
    resolveVisibility({ defaultLevel: "calendar", groupLevels: [], override: null }),
    "calendar",
  );
  assert.equal(resolveVisibility({ defaultLevel: "slots", groupLevels: [] }), "slots");
  assert.equal(resolveVisibility({ defaultLevel: "none", groupLevels: [] }), "none");
});

test("a group can only raise a friend above a lowered default, never lower them", () => {
  // Grants union, so the default is a floor the groups add to.
  assert.equal(
    resolveVisibility({ defaultLevel: "slots", groupLevels: ["open_time"] }),
    "calendar",
  );
  assert.equal(
    resolveVisibility({ defaultLevel: "calendar", groupLevels: ["slots"] }),
    "calendar",
  );
  assert.equal(
    resolveVisibility({ defaultLevel: "open_time", groupLevels: ["none"] }),
    "open_time",
  );
});

test("an override beats the owner's default in both directions", () => {
  assert.equal(
    resolveVisibility({ defaultLevel: "calendar", groupLevels: [], override: "none" }),
    "none",
  );
  assert.equal(
    resolveVisibility({ defaultLevel: "none", groupLevels: [], override: "calendar" }),
    "calendar",
  );
});

const AMY = "conn-amy";
const BEN = "conn-ben";
const CAL = "conn-cal";

test("resolves every accepted Connection, including ungrouped ones", () => {
  const resolved = resolveVisibilityByConnection({
    defaultLevel: "none",
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
  // Never silently absent: a friend in no group is the owner's default, not
  // undefined.
  assert.equal(resolved.get(CAL), "none");
});

test("a friend with no membership row gets the owner's default, not none", () => {
  const resolved = resolveVisibilityByConnection({
    defaultLevel: "calendar",
    connectionIds: [AMY, BEN],
    groups: [{ id: "g-ladder", defaultVisibility: "slots" }],
    memberships: [{ groupId: "g-ladder", connectionId: AMY }],
    overrides: [{ connectionId: BEN, level: "slots" }],
  });

  assert.equal(resolved.get(AMY), "calendar");
  // An override still restricts one person below a `calendar` default.
  assert.equal(resolved.get(BEN), "slots");
});

test("a membership of a group that no longer exists is ignored", () => {
  const resolved = resolveVisibilityByConnection({
    defaultLevel: "none",
    connectionIds: [AMY],
    groups: [],
    memberships: [{ groupId: "g-deleted", connectionId: AMY }],
    overrides: [],
  });

  assert.equal(resolved.get(AMY), "none");
});

test("an override for a Connection that is no longer a friend is ignored", () => {
  const resolved = resolveVisibilityByConnection({
    defaultLevel: "none",
    connectionIds: [AMY],
    groups: [],
    memberships: [],
    overrides: [{ connectionId: "conn-removed", level: "calendar" }],
  });

  assert.deepEqual([...resolved.keys()], [AMY]);
});
