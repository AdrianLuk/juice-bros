import assert from "node:assert/strict";
import { test } from "node:test";

import { generateBrief } from "../brief.ts";
import { sideOf, type TeamEventDoc } from "../event-doc.ts";
import { demoNight } from "./night.ts";
import { applyDemoWrite, type DemoActor, type DemoWrite } from "./reduce.ts";
import { demoBriefInput, demoWrites } from "./seam.ts";

const AT = "2026-10-13T23:50:00.000Z";

/** The demo stage's commit, in miniature: a night held in a variable. */
function holder(start: TeamEventDoc) {
  const box = { event: start };
  const commit = (actor: DemoActor, write: DemoWrite) => {
    const applied = applyDemoWrite(box.event, actor, write, AT);
    box.event = applied.event;
    return Promise.resolve(applied.result);
  };
  return { box, commit };
}

test("the Score Link's writes go to the night as your Team", async () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  const { box, commit } = holder(event);
  const writes = demoWrites({ kind: "team", teamId: myTeamId }, commit);
  assert.equal(writes.by, "team");

  const mine = event.matchups.find((matchup) => sideOf(matchup, myTeamId))!;
  assert.deepEqual(await writes.saveGameScore(mine.games[2].id, 13, 9), {
    ok: false,
    problem: "13-9 can't happen: the game ends at 11-9",
  });
  assert.deepEqual(await writes.saveGameScore(mine.games[2].id, 11, 9), { ok: true });
  assert.equal(box.event.matchups[0].games[2].lastEditedByTeamId, myTeamId);
});

test("the Organizer's writes include Seed now", async () => {
  const { event } = demoNight("2026-10-13");
  const { box, commit } = holder(event);
  const writes = demoWrites({ kind: "organizer" }, commit);
  assert.equal(writes.by, "organizer");
  assert.deepEqual(await writes.seedFlightsNow(), { ok: true });
  assert.equal(box.event.status, "flights");
});

test("the Brief for the demo night is the one brief.ts writes, one Score Link per Team", () => {
  const { event } = demoNight("2026-10-13");
  const brief = generateBrief(demoBriefInput(event, "https://juicebrospickleball.com"));
  assert.match(brief, /🏓 MATCH 1 — Courts 16 & 19\n🔴 Team Ben Johns — “Golden Set”\nCourt 16\nBen Johns • Anna Leigh Waters • Collin Johns • Anna Bright/);
  assert.match(brief, /🏓 MATCH 7 — Courts 28 & 29/);
  assert.equal(brief.match(/🔗 Score link: /g)?.length, 14);
  assert.match(brief, /📺 Live standings: https:\/\/juicebrospickleball\.com\/tools\/team-tally\/live\//);
});
