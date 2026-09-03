import assert from "node:assert/strict";
import test from "node:test";

import {
  DEV_PLAYER_NAMES,
  fakePlayer,
  fakePlayerToken,
  fakePlayers,
} from "./dev-players.ts";
import { SKILL_LEVELS } from "./session/types.ts";

test("fakePlayer is deterministic in n", () => {
  assert.deepEqual(fakePlayer(0), fakePlayer(0));
  assert.deepEqual(fakePlayer(7), fakePlayer(7));
  assert.notDeepEqual(fakePlayer(0), fakePlayer(1));
});

test("fakePlayer cycles the name pool and suffixes on wrap", () => {
  assert.equal(fakePlayer(0).firstName, DEV_PLAYER_NAMES[0]);
  assert.equal(
    fakePlayer(DEV_PLAYER_NAMES.length - 1).firstName,
    DEV_PLAYER_NAMES[DEV_PLAYER_NAMES.length - 1],
  );
  // First wrap: back to the top of the pool, now with a "2" suffix.
  assert.equal(
    fakePlayer(DEV_PLAYER_NAMES.length).firstName,
    `${DEV_PLAYER_NAMES[0]} 2`,
  );
});

test("fakePlayer spreads skill levels and carries the synthetic-player tell", () => {
  const levels = new Set(
    Array.from({ length: SKILL_LEVELS.length }, (_, i) => fakePlayer(i).skillLevel),
  );
  assert.equal(levels.size, SKILL_LEVELS.length);
  assert.equal(fakePlayer(3).lastInitial, "B");
});

test("fakePlayers returns a batch from the given offset, clamping junk counts", () => {
  const batch = fakePlayers(4, 2);
  assert.equal(batch.length, 4);
  assert.deepEqual(batch[0], fakePlayer(2));
  assert.deepEqual(batch[3], fakePlayer(5));
  assert.deepEqual(fakePlayers(-3), []);
  assert.deepEqual(fakePlayers(2.9), [fakePlayer(0), fakePlayer(1)]);
});

test("fakePlayerToken is namespaced and unique", () => {
  const a = fakePlayerToken();
  const b = fakePlayerToken();
  assert.match(a, /^dev-[0-9a-f-]{36}$/);
  assert.notEqual(a, b);
});
