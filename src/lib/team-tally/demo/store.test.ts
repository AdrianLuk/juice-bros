import assert from "node:assert/strict";
import { test } from "node:test";

import { demoNight } from "./night.ts";
import { createDemoStore } from "./store.ts";

test("a write lands on the night and tells the screens; a refused one changes nothing", async () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  const store = createDemoStore(event, () => "2026-10-13T23:50:00.000Z");
  let told = 0;
  const stop = store.subscribe(() => (told += 1));
  const me = { kind: "team" as const, teamId: myTeamId };
  const gameId = event.matchups[0].games[2].id;

  assert.deepEqual(await store.commit(me, { type: "score", gameId, red: 13, blue: 9 }), {
    ok: false,
    problem: "13-9 can't happen: the game ends at 11-9",
  });
  assert.equal(store.get(), event);
  assert.equal(told, 0);

  assert.deepEqual(await store.commit(me, { type: "score", gameId, red: 11, blue: 9 }), { ok: true });
  assert.equal(store.get().matchups[0].games[2].redScore, 11);
  assert.equal(told, 1);

  store.reset(event);
  assert.equal(store.get(), event);
  assert.equal(told, 2);

  stop();
  await store.commit(me, { type: "score", gameId, red: 11, blue: 9 });
  assert.equal(told, 2);
});
