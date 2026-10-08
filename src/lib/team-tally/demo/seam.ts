/**
 * The demo adapter's half of the live seam (issue #631): the same `LiveWrites`
 * a real Score Link or Organizer gets, each one turned into a `DemoWrite` and
 * handed to `commit`, which the demo stage folds into the night it holds.
 *
 * Plus the Brief's input for the demo night: `brief.ts` writes the text, as
 * it does for a real one. Relative imports only, for `node --test`.
 */

import type { BriefInput, BriefTeam } from "../brief.ts";
import type { DocTeam, TeamEventDoc } from "../event-doc.ts";
import type { LiveWrites, OrganizerWrites, TeamWrites, WriteResult } from "../live-seam.ts";
import { publicLinkPath, scoreLinkPath } from "../routes.ts";
import type { DemoActor, DemoWrite } from "./reduce.ts";

export type DemoCommit = (actor: DemoActor, write: DemoWrite) => Promise<WriteResult>;

/** The writes a screen gets, as `actor`. */
export function demoWrites(actor: DemoActor, commit: DemoCommit): LiveWrites {
  const run = (write: DemoWrite) => commit(actor, write);
  const team: TeamWrites = {
    saveGameScore: (gameId, red, blue) => run({ type: "score", gameId, red, blue }),
    saveRoster: (teamId, roster) => run({ type: "roster", teamId, roster }),
    markMatchupDone: (matchupId) => run({ type: "done", matchupId }),
    recordDreambreaker: (matchupId, winnerTeamId) => run({ type: "dreambreaker", matchupId, winnerTeamId }),
  };
  if (actor.kind === "team") return { by: "team", ...team };

  const organizer: OrganizerWrites = {
    ...team,
    reopenMatchup: (matchupId) => run({ type: "reopen", matchupId }),
    seedFlightsNow: () => run({ type: "seedNow" }),
    swapFlightCourts: (flightId, otherFlightId) => run({ type: "swapCourts", flightId, otherFlightId }),
    putTeamAhead: (teamId) => run({ type: "putAhead", teamId }),
    orderTiedTeams: (teamIds) => run({ type: "tieOrder", teamIds }),
  };
  return { by: "organizer", ...organizer };
}

/**
 * What `generateBrief` needs for the demo night. Its links have the shape a
 * real night's do; the demo has no tokens behind them.
 */
export function demoBriefInput(event: TeamEventDoc, origin: string): BriefInput {
  const teams = new Map(event.teams.map((team) => [team.id, team]));
  const briefTeam = (team: DocTeam): BriefTeam => ({
    captain: team.captain,
    slotA: team.slotA,
    slotB: team.slotB,
    slotC: team.slotC,
    nickname: team.nickname,
    homeCourt: team.homeCourt,
    scoreLink: `${origin}${scoreLinkPath(team.id)}`,
  });
  return {
    publicLink: `${origin}${publicLinkPath(event.id)}`,
    matchups: event.matchups
      .filter((matchup) => matchup.stage === "opening")
      .sort((a, b) => a.number - b.number)
      .map((matchup) => ({
        red: briefTeam(teams.get(matchup.redTeamId)!),
        blue: briefTeam(teams.get(matchup.blueTeamId)!),
      })),
  };
}
