/**
 * The nights the landing page's previews are drawn from (issue #636). Every
 * preview on `/tools/team-tally` is a real component fed a made-up night, and
 * these are those nights: the demo night a little further on (one more Game
 * in, the tied Matchup touched by the Organizer and closed), the same night
 * played on until the Flights are placed, and an excerpt of its brief.
 *
 * Built by the demo's own rules (`applyDemoWrite`, `nextRunStep`), so nothing
 * here can show a state the app couldn't reach. Relative imports only, for
 * `node --test`.
 */

import { generateBrief } from "../brief.ts";
import type { DocGame, DocMatchup, TeamEventDoc } from "../event-doc.ts";
import { doneProblem } from "../matchup-done.ts";
import { checkRosterChange } from "../roster.ts";
import { checkGameScore } from "../score.ts";
import { demoNight } from "./night.ts";
import { applyDemoWrite, type DemoActor, type DemoWrite } from "./reduce.ts";
import { nextRunStep } from "./run.ts";
import { demoBriefInput } from "./seam.ts";

export type LandingNights = {
  /**
   * The night every live preview shows: the demo night as it opens, with
   * Golden Set's Round 2 captains' game entered (so the Score Link preview has
   * one Game in and one waiting) and the tied Match 6 settled and done.
   */
  night: TeamEventDoc;
  /** The Team whose Score Link the visitor holds on the demo. */
  myTeamId: string;
  /** That night played on until the last opening Matchup is done and the Flights are placed. */
  flights: TeamEventDoc;
  /** Match 6 after the Organizer re-entered a Game, a captain recorded the Dreambreaker and marked it done. */
  organizerMatchup: DocMatchup;
  /** The Game the Organizer edited, for its "Edited by the organizer" lower third. */
  organizerGame: DocGame;
  /** The brief from its Matchups heading through Match 1. */
  briefExcerpt: string;
  /** What the app says back, word for word, to things it refuses. */
  refusals: { score: string; tie: string; roster: string };
};

function apply(event: TeamEventDoc, actor: DemoActor, write: DemoWrite, at: string): TeamEventDoc {
  const applied = applyDemoWrite(event, actor, write, at);
  if (!applied.result.ok) throw new Error(`Landing night refused a write: ${applied.result.problem}`);
  return applied.event;
}

function problemOf(check: { ok: true } | { ok: false; problem: string }): string {
  if (check.ok) throw new Error("Expected the example to be refused");
  return check.problem;
}

/** Every night on the landing, dated `date` (`YYYY-MM-DD`), with links on `origin`. */
export function landingNights(date: string, origin: string): LandingNights {
  const { event: opening, myTeamId } = demoNight(date);
  const at = `${date}T23:30:00.000Z`;

  // Golden Set's captain enters Round 2's captains' game.
  const mine = opening.matchups.find((matchup) => matchup.number === 1 && matchup.stage === "opening")!;
  const captains = mine.games.find((game) => game.round === 2 && game.kind === "captains")!;
  let night = apply(opening, { kind: "team", teamId: myTeamId }, { type: "score", gameId: captains.id, red: 11, blue: 7 }, at);

  // Match 6 is tied 56-56. The Organizer re-enters its last Game as it was
  // played, then the blue captain records the Dreambreaker and marks it done.
  const tied = opening.matchups.find((matchup) => matchup.number === 6 && matchup.stage === "opening")!;
  const lastGame = tied.games[tied.games.length - 1];
  night = apply(
    night,
    { kind: "organizer" },
    { type: "score", gameId: lastGame.id, red: lastGame.redScore!, blue: lastGame.blueScore! },
    at,
  );
  const blue: DemoActor = { kind: "team", teamId: tied.blueTeamId };
  night = apply(night, blue, { type: "dreambreaker", matchupId: tied.id, winnerTeamId: tied.blueTeamId }, at);
  night = apply(night, blue, { type: "done", matchupId: tied.id }, at);
  const organizerMatchup = night.matchups.find((matchup) => matchup.id === tied.id)!;

  let flights = night;
  while (flights.status === "opening") {
    const step = nextRunStep(flights, myTeamId);
    if (!step) break;
    flights = apply(flights, step.actor, step.write, at);
  }

  const brief = generateBrief(demoBriefInput(opening, origin)).split("\n");
  const from = brief.findIndex((line) => line.includes("TEAM MATCHUPS"));
  const to = brief.findIndex((line) => line.includes("MATCH 2"));
  const briefExcerpt = brief.slice(from, to).join("\n").trimEnd();

  const myTeam = opening.teams.find((team) => team.id === myTeamId)!;
  const roster = { slotA: myTeam.slotA, slotB: myTeam.slotB, slotC: myTeam.slotC };

  return {
    night,
    myTeamId,
    flights,
    organizerMatchup,
    organizerGame: organizerMatchup.games.find((game) => game.id === lastGame.id)!,
    briefExcerpt,
    refusals: {
      score: problemOf(checkGameScore(13, 9)),
      tie: doneProblem(tied) ?? "",
      // Moving Player C into Round 1, after Round 1 has been played.
      roster: problemOf(checkRosterChange(roster, { ...roster, slotA: myTeam.slotC, slotC: myTeam.slotA }, [1])),
    },
  };
}
