/**
 * "Let it run" (issue #631): the captains of every other Matchup playing on
 * by themselves, one write at a time, so the visitor can watch the Flights
 * place and the night end without entering every Game.
 *
 * Each step is what a captain would do next on the Matchup furthest behind:
 * score its next Game, record a tied Matchup's Dreambreaker, or tap Matchup
 * done. Spreading the steps across Matchups keeps every court moving on the
 * TV. The visitor's own Matchup is left for them until every other one is
 * done; after that the night plays it too, so it can still reach its end.
 *
 * Scores come from a hash of the Game's id, so the same night plays out the
 * same way every time. Relative imports only, for `node --test`.
 */

import { isScored, sideOf, type DocMatchup, type TeamEventDoc } from "../event-doc.ts";
import { needsDreambreaker } from "../matchup-done.ts";
import type { DemoActor, DemoWrite } from "./reduce.ts";

export type RunStep = { actor: DemoActor; write: DemoWrite };

/** FNV-1a: small, stable, and enough to vary a demo's scores. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A finished game's score, red side first: 11 to 3 through 9, now and then 12-10. */
export function runScore(gameId: string): [number, number] {
  const h = hash(gameId);
  const [winner, loser] = (h >>> 3) % 10 === 0 ? [12, 10] : [11, 3 + (h % 7)];
  return (h >>> 8) % 2 === 0 ? [winner, loser] : [loser, winner];
}

function scoredCount(matchup: DocMatchup): number {
  return matchup.games.filter(isScored).length;
}

/** The next thing a captain would do on the night, or null once it is over. */
export function nextRunStep(event: TeamEventDoc, myTeamId: string): RunStep | null {
  if (event.status === "finished") return null;

  const open = event.matchups.filter((matchup) => matchup.doneAt === null);
  const others = open.filter((matchup) => !sideOf(matchup, myTeamId));
  const candidates = others.length > 0 ? others : open;
  if (candidates.length === 0) return null;

  // The Matchup furthest behind; the lower number on a tie, as the brief lists them.
  const matchup = [...candidates].sort(
    (a, b) =>
      scoredCount(a) - scoredCount(b) ||
      (a.stage === b.stage ? 0 : a.stage === "opening" ? -1 : 1) ||
      a.number - b.number,
  )[0];
  const red: DemoActor = { kind: "team", teamId: matchup.redTeamId };

  const nextGame = matchup.games.findIndex((game) => !isScored(game));
  if (nextGame >= 0) {
    const game = matchup.games[nextGame];
    const [redScore, blueScore] = runScore(game.id);
    // The two captains take turns entering scores.
    const actor: DemoActor = nextGame % 2 === 0 ? red : { kind: "team", teamId: matchup.blueTeamId };
    return { actor, write: { type: "score", gameId: game.id, red: redScore, blue: blueScore } };
  }

  if (needsDreambreaker(matchup) && matchup.dreambreakerWinnerId === null) {
    const winner = hash(matchup.id) % 2 === 0 ? matchup.redTeamId : matchup.blueTeamId;
    return { actor: red, write: { type: "dreambreaker", matchupId: matchup.id, winnerTeamId: winner } };
  }

  return { actor: red, write: { type: "done", matchupId: matchup.id } };
}
