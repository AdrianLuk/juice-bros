/**
 * The demo night's adapter for the live seam (issue #631): every write a
 * Team Tally screen can make, applied to a `TeamEventDoc` in memory.
 *
 * It is not a copy of the rules. Each write goes through the same pure
 * modules a real night's screens and database agree on: `score.ts` (13-9 is
 * refused), `roster.ts` (a scored Round pins its slot), `matchup-done.ts`,
 * `seeding.ts` through `standings.ts`, and `transitions.ts` for placing the
 * Flights and ending the night. What only the database checks on a real
 * night (whose Matchup a Score Link may touch, the done lock, a finished
 * night) is checked here in the database's own words.
 *
 * A refused write returns the night unchanged. Relative imports only, for
 * `node --test`.
 */

import { flightMatchups, isScored, scoredRoundsFor, sideOf, type DocMatchup, type TeamEventDoc } from "../event-doc.ts";
import type { WriteResult } from "../live-seam.ts";
import { checkRosterChange, type Roster } from "../roster.ts";
import { checkGameScore } from "../score.ts";
import { tieCalls } from "../standings.ts";
import { finishMatchup, placeFlights } from "../transitions.ts";

/** Who is writing: a Team by its Score Link, or the Organizer. */
export type DemoActor = { kind: "team"; teamId: string } | { kind: "organizer" };

export type DemoWrite =
  | { type: "score"; gameId: string; red: number; blue: number }
  | { type: "roster"; teamId: string; roster: Roster }
  | { type: "done"; matchupId: string }
  | { type: "dreambreaker"; matchupId: string; winnerTeamId: string | null }
  | { type: "reopen"; matchupId: string }
  | { type: "seedNow" }
  | { type: "swapCourts"; flightId: string; otherFlightId: string }
  | { type: "putAhead"; teamId: string }
  | { type: "tieOrder"; teamIds: string[] };

export type DemoApplied = { event: TeamEventDoc; result: WriteResult };

const SCORES_FINAL = "This Team Event has finished, so its scores are final.";
const ROSTERS_FINAL = "This Team Event has finished, so its rosters are final.";
const MATCHUP_LOCKED = "This Matchup is done. Only the organizer can reopen it.";
const ORGANIZER_ONLY = "Only the organizer can do that.";

function refuse(event: TeamEventDoc, problem: string): DemoApplied {
  return { event, result: { ok: false, problem } };
}

function accept(event: TeamEventDoc): DemoApplied {
  return { event, result: { ok: true } };
}

function withMatchup(event: TeamEventDoc, id: string, change: (matchup: DocMatchup) => DocMatchup): TeamEventDoc {
  return { ...event, matchups: event.matchups.map((matchup) => (matchup.id === id ? change(matchup) : matchup)) };
}

/** A Team's current Matchup: its Flight once it has one, else its opening Matchup. */
function currentMatchupOf(event: TeamEventDoc, teamId: string): DocMatchup | undefined {
  const mine = event.matchups.filter((matchup) => sideOf(matchup, teamId));
  return mine.find((matchup) => matchup.stage === "flight") ?? mine[0];
}

/** Applies one write as `actor`, at `at` (an ISO time), the way the database would. */
export function applyDemoWrite(event: TeamEventDoc, actor: DemoActor, write: DemoWrite, at: string): DemoApplied {
  const team = actor.kind === "team" ? actor.teamId : null;

  switch (write.type) {
    case "score": {
      const check = checkGameScore(write.red, write.blue);
      if (!check.ok) return refuse(event, check.problem);
      const matchup = event.matchups.find((candidate) => candidate.games.some((game) => game.id === write.gameId));
      if (!matchup) return refuse(event, "Game not found");
      if (team && !sideOf(matchup, team)) return refuse(event, "That Game isn't in your Matchup.");
      if (event.status === "finished") return refuse(event, SCORES_FINAL);
      if (matchup.doneAt) return refuse(event, MATCHUP_LOCKED);
      return accept(
        withMatchup(event, matchup.id, (current) => ({
          ...current,
          games: current.games.map((game) =>
            game.id === write.gameId
              ? {
                  ...game,
                  redScore: write.red,
                  blueScore: write.blue,
                  lastEditedByKind: team ? "team" : "organizer",
                  lastEditedByTeamId: team,
                }
              : game,
          ),
        })),
      );
    }

    case "roster": {
      const target = event.teams.find((candidate) => candidate.id === write.teamId);
      if (!target) return refuse(event, "Team not found");
      if (team && team !== write.teamId) return refuse(event, "That Score Link only edits its own Team.");
      if (event.status === "finished") return refuse(event, ROSTERS_FINAL);
      if (currentMatchupOf(event, write.teamId)?.doneAt) {
        return refuse(event, "This Team's Matchup is done, so its roster is final.");
      }
      const current = { slotA: target.slotA, slotB: target.slotB, slotC: target.slotC };
      const check = checkRosterChange(current, write.roster, scoredRoundsFor(event, write.teamId));
      if (!check.ok) return refuse(event, check.problem);
      return accept({
        ...event,
        teams: event.teams.map((candidate) =>
          candidate.id === write.teamId
            ? {
                ...candidate,
                slotA: write.roster.slotA.trim(),
                slotB: write.roster.slotB.trim(),
                slotC: write.roster.slotC.trim(),
              }
            : candidate,
        ),
      });
    }

    case "done": {
      const matchup = event.matchups.find((candidate) => candidate.id === write.matchupId);
      if (team && matchup && !sideOf(matchup, team)) return refuse(event, "That Matchup isn't yours.");
      const finished = finishMatchup(event, write.matchupId, team, at);
      return finished.ok ? accept(finished.event) : refuse(event, finished.problem);
    }

    case "dreambreaker": {
      const matchup = event.matchups.find((candidate) => candidate.id === write.matchupId);
      if (!matchup) return refuse(event, "Matchup not found");
      if (team && !sideOf(matchup, team)) return refuse(event, "That Matchup isn't yours.");
      if (event.status === "finished") return refuse(event, SCORES_FINAL);
      if (matchup.doneAt) return refuse(event, MATCHUP_LOCKED);
      if (write.winnerTeamId !== null && !sideOf(matchup, write.winnerTeamId)) {
        return refuse(event, "That Team isn't in this Matchup.");
      }
      const tied =
        matchup.games.every(isScored) &&
        matchup.games.reduce((sum, game) => sum + game.redScore!, 0) ===
          matchup.games.reduce((sum, game) => sum + game.blueScore!, 0);
      if (write.winnerTeamId !== null && !tied) return refuse(event, "Only a tied Matchup plays a Dreambreaker.");
      return accept(withMatchup(event, matchup.id, (current) => ({ ...current, dreambreakerWinnerId: write.winnerTeamId })));
    }
  }

  // Everything below is the Organizer's alone.
  if (team) return refuse(event, ORGANIZER_ONLY);

  switch (write.type) {
    case "reopen": {
      const matchup = event.matchups.find((candidate) => candidate.id === write.matchupId);
      if (!matchup) return refuse(event, "Matchup not found");
      if (!matchup.doneAt) return refuse(event, "This Matchup isn't done.");
      const reopened = withMatchup(event, matchup.id, (current) => ({ ...current, doneAt: null, doneByTeamId: null }));
      const backInFlights = matchup.stage === "flight" && event.status === "finished";
      return accept(backInFlights ? { ...reopened, status: "flights" } : reopened);
    }

    case "seedNow":
      if (event.status !== "opening") return refuse(event, "The Flights are already placed.");
      return accept(placeFlights(event, at));

    case "tieOrder": {
      if (event.status !== "opening") return refuse(event, "The Flights are already placed.");
      if (write.teamIds.some((id) => !event.teams.some((candidate) => candidate.id === id))) {
        return refuse(event, "That Team isn't in this Team Event.");
      }
      return accept({ ...event, tieOrder: [...write.teamIds] });
    }

    case "swapCourts": {
      const flights = flightMatchups(event);
      const one = flights.find((flight) => flight.id === write.flightId);
      const two = flights.find((flight) => flight.id === write.otherFlightId);
      if (!one || !two) return refuse(event, "Flight not found");
      if (flights.some((flight) => flight.games.some(isScored))) {
        return refuse(event, "A Flight has a score, so the courts stay.");
      }
      return accept({
        ...event,
        matchups: event.matchups.map((matchup) =>
          matchup.id === one.id
            ? { ...matchup, courtPair: two.courtPair }
            : matchup.id === two.id
              ? { ...matchup, courtPair: one.courtPair }
              : matchup,
        ),
      });
    }

    case "putAhead": {
      if (event.status === "opening") return refuse(event, "The Flights aren't placed yet.");
      if (event.status === "finished") return refuse(event, SCORES_FINAL);
      // tieCalls is the Organizer's board's own list: a tie on every count
      // across a Flight line, both Flights still unscored.
      const call = tieCalls(event).find((candidate) => candidate.behindTeamId === write.teamId);
      if (!call) {
        const flights = flightMatchups(event);
        const lower = flights.find((flight) => flight.redTeamId === write.teamId);
        const upper = lower && flights.find((flight) => flight.number === lower.number - 1);
        if (upper && lower && [upper, lower].some((flight) => flight.games.some(isScored))) {
          return refuse(event, "A Flight has a score, so the Teams stay.");
        }
        return refuse(event, "That Team isn't level on every count with the Team above it in the next Flight up.");
      }
      const swapped: TeamEventDoc = {
        ...event,
        matchups: event.matchups.map((matchup) => {
          if (matchup.stage !== "flight") return matchup;
          if (matchup.blueTeamId === call.aheadTeamId) return { ...matchup, blueTeamId: call.behindTeamId };
          if (matchup.redTeamId === call.behindTeamId) return { ...matchup, redTeamId: call.aheadTeamId };
          return matchup;
        }),
      };
      // The tie order becomes the placed order, so the standings read the same way.
      const placed = flightMatchups(swapped)
        .sort((a, b) => a.number - b.number)
        .flatMap((flight) => [flight.redTeamId, flight.blueTeamId]);
      return accept({ ...swapped, tieOrder: placed });
    }
  }

  return refuse(event, "Unknown write");
}
