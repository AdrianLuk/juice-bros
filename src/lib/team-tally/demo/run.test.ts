import assert from "node:assert/strict";
import { test } from "node:test";

import { flightMatchups, isScored, openingMatchups, sideOf, type TeamEventDoc } from "../event-doc.ts";
import { finalPlaces } from "../final-places.ts";
import { checkGameScore } from "../score.ts";
import { demoNight } from "./night.ts";
import { applyDemoWrite } from "./reduce.ts";
import { nextRunStep } from "./run.ts";

const AT = "2026-10-13T23:50:00.000Z";

/** Plays Let it run from `event` until it stops, every step accepted. */
function letItRun(start: TeamEventDoc, myTeamId: string) {
  const steps = [];
  let event = start;
  for (let guard = 0; guard < 500; guard += 1) {
    const step = nextRunStep(event, myTeamId);
    if (!step) return { event, steps };
    const applied = applyDemoWrite(event, step.actor, step.write, AT);
    assert.deepEqual(applied.result, { ok: true }, JSON.stringify(step));
    steps.push({ step, before: event });
    event = applied.event;
  }
  assert.fail("Let it run never stopped");
}

test("Let it run plays the night out: the Flights place and the night reaches its results", () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  const { event: over } = letItRun(event, myTeamId);
  assert.equal(over.status, "finished");
  assert.equal(flightMatchups(over).length, 7);
  assert.equal(finalPlaces(over).length, 14);
});

test("it scores one Game at a time, each a score that could end a game, entered by a captain in that Matchup", () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  for (const { step, before } of letItRun(event, myTeamId).steps) {
    if (step.write.type !== "score") continue;
    const { gameId, red, blue } = step.write;
    assert.deepEqual(checkGameScore(red, blue), { ok: true });
    assert.ok(Math.max(red, blue) >= 11, `${red}-${blue} is a finished game`);
    const matchup = before.matchups.find((candidate) => candidate.games.some((game) => game.id === gameId))!;
    assert.equal(step.actor.kind, "team");
    assert.ok(step.actor.kind === "team" && sideOf(matchup, step.actor.teamId));
  }
});

test("a tied Matchup gets its Dreambreaker before it is done", () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  const tied = openingMatchups(event).find((matchup) => matchup.number === 6)!;
  // Nothing on Match 6 is left to score, so its next step is the Dreambreaker, whenever it comes.
  const steps = letItRun(event, myTeamId).steps.filter(
    ({ step }) => "matchupId" in step.write && step.write.matchupId === tied.id,
  );
  assert.deepEqual(
    steps.map(({ step }) => step.write.type),
    ["dreambreaker", "done"],
  );
});

test("your Matchup is left for you until every other opening Matchup is done", () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  const mine = openingMatchups(event).find((matchup) => sideOf(matchup, myTeamId))!;
  for (const { step, before } of letItRun(event, myTeamId).steps) {
    const touchesMine =
      ("matchupId" in step.write && step.write.matchupId === mine.id) ||
      ("gameId" in step.write && mine.games.some((game) => game.id === (step.write as { gameId: string }).gameId));
    if (!touchesMine) continue;
    const othersOpen = openingMatchups(before).filter((matchup) => matchup.id !== mine.id && matchup.doneAt === null);
    assert.deepEqual(othersOpen, [], "Let it run touched your Matchup while others were still open");
  }
});

test("Let it run picks up from wherever the visitor left the night", () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  const mine = openingMatchups(event).find((matchup) => sideOf(matchup, myTeamId))!;
  // The visitor scores Round 2's captains' game themselves.
  const typed = applyDemoWrite(event, { kind: "team", teamId: myTeamId }, { type: "score", gameId: mine.games[2].id, red: 11, blue: 9 }, AT);
  const { event: over } = letItRun(typed.event, myTeamId);
  const kept = over.matchups.find((matchup) => matchup.id === mine.id)!.games[2];
  assert.deepEqual([kept.redScore, kept.blueScore, kept.lastEditedByTeamId], [11, 9, myTeamId]);
  assert.ok(over.matchups.every((matchup) => matchup.games.every(isScored)));
  assert.equal(nextRunStep(over, myTeamId), null);
});
