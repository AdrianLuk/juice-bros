"use client";

import { useMemo } from "react";

import { captainTeamName, type DocMatchup, flightMatchups, openingMatchups, scoredRoundsFor, sideOf, teamName } from "@/lib/team-tally/event-doc";
import { finalPlaces, ordinal } from "@/lib/team-tally/final-places";
import { eventDateLabel } from "@/lib/team-tally/format";
import type { LiveSeam } from "@/lib/team-tally/live-seam";
import { FlightHandoff } from "./flight-handoff";
import { MatchupBug } from "./matchup-bug";
import { MatchupDonePanel } from "./matchup-done-panel";
import { MatchupGames } from "./matchup-games";
import { MatchupRounds } from "./matchup-rounds";
import { ResultsSummary } from "./results-summary";
import { RosterForm } from "./roster-form";
import { StandingsTower } from "./standings-tower";
import { TtAppBar } from "./tt-head";

function isMatchup(matchup: DocMatchup | undefined): matchup is DocMatchup {
  return matchup !== undefined;
}

/**
 * A captain's Score Link (issues #623, #624): their Matchup's bug, the live
 * Round's two Games with score boxes, the other Rounds folded below, and
 * Matchup done once Round 3 is in; then the standings and their own roster.
 * Once the Flights are placed it switches to their Flight: the hand-off
 * (Flight and court pair, at display size) leads, every other Flight and the
 * opening record sit beside it.
 *
 * Reads and writes through the live seam (issue #631): a real Score Link's
 * adapter is `ScoreLinkBoard`, the demo night's is the demo stage.
 */
export function ScoreLinkScreen({ live, myTeamId }: { live: LiveSeam; myTeamId: string }) {
  const { view, writes } = live;
  const { event } = view;
  const teams = useMemo(() => new Map(event.teams.map((team) => [team.id, team])), [event.teams]);
  const me = teams.get(myTeamId)!;

  const myMatchups = event.matchups.filter((matchup) => sideOf(matchup, myTeamId));
  const opening = myMatchups.find((matchup) => matchup.stage === "opening");
  const myFlight = myMatchups.find((matchup) => matchup.stage === "flight");
  // The Matchup this Team is playing now: its Flight once there is one.
  const mine = myFlight ?? opening;
  const flights = flightMatchups(event);
  const openingLeft = openingMatchups(event).filter((matchup) => matchup.doneAt === null);

  // The night has ended: scores are final. The page still opens, with no inputs.
  if (event.status === "finished") {
    const place = finalPlaces(event).find((candidate) => candidate.teamId === myTeamId);
    return (
      <>
        <TtAppBar context={`${captainTeamName(me)} · Score link`} />
        <div className="tt-wrap tt-livepage">
          <header className="tt-live-head">
            <h1 className="tt-live-title">{event.name}</h1>
            <p className="tt-meta m-0">{eventDateLabel(event.date)}</p>
          </header>

          <section className="tt-sheet tt-over" aria-label="The night is over">
            <p className="tt-done-line m-0">
              <span className="tt-final">Final</span>
              <span>
                The night is over, so this link is read-only.
                {place && (
                  <>
                    {" "}
                    {teamName(me)} finished <b>{ordinal(place.place)}</b>, Flight {place.flightLetter}{" "}
                    {place.role}.
                  </>
                )}
              </span>
            </p>
          </section>

          <ResultsSummary event={event} teams={teams} myTeamId={myTeamId} />

          <div className="tt-live-grid">
            <div className="tt-live-main">
              <h2 className="tt-sect">Your Matchups</h2>
              <ul className="tt-matchup-list">
                {[myFlight, opening].filter(isMatchup).map((matchup) => (
                  <li key={matchup.id} className="grid gap-2">
                    <MatchupBug matchup={matchup} teams={teams} />
                    <MatchupGames matchup={matchup} teams={teams} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="tt-live-side">
              <section aria-label="Standings" className="grid gap-2">
                <h2 className="sr-only">Opening standings</h2>
                <StandingsTower event={event} myTeamId={myTeamId} />
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TtAppBar context={`${captainTeamName(me)} · Score link`} />
      <div className="tt-wrap tt-livepage">
        <header className="tt-live-head">
          <h1 className="tt-live-title">{event.name}</h1>
          <p className="tt-meta m-0">{eventDateLabel(event.date)}</p>
        </header>

        <div className="tt-live-grid">
          <div className="tt-live-main">
            {myFlight && (
              <section aria-label="Your Flight" className="grid gap-2">
                <h2 className="tt-sect">
                  Your Flight {myFlight.doneAt === null && <span className="tt-live-mark">Now</span>}
                </h2>
                <FlightHandoff flight={myFlight} teams={teams} myTeamId={myTeamId} />
              </section>
            )}
            {mine ? (
              <>
                <MatchupBug matchup={mine} teams={teams} />
                <MatchupRounds matchup={mine} teams={teams} writes={writes} />
                <MatchupDonePanel
                  matchup={mine}
                  teams={teams}
                  writes={writes}
                  lastOpening={
                    mine.stage === "opening" &&
                    event.status === "opening" &&
                    openingLeft.length === 1 &&
                    openingLeft[0].id === mine.id
                  }
                />
              </>
            ) : (
              <p className="tt-body">Your Team isn&apos;t in a Matchup yet.</p>
            )}
          </div>

          <div className="tt-live-side">
            {flights.length > 0 && (
              <section aria-label="Every Flight" className="grid gap-2">
                <h2 className="tt-sect">Every Flight</h2>
                <ul className="tt-handoff-list">
                  {flights.map((flight) => (
                    <li key={flight.id}>
                      <FlightHandoff flight={flight} teams={teams} myTeamId={myTeamId} size="compact" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="Standings" className="grid gap-2">
              <h2 className="sr-only">Standings</h2>
              <StandingsTower event={event} myTeamId={myTeamId} />
            </section>
            {myFlight && opening && (
              <section aria-label="Your opening Matchup" className="grid gap-2">
                <h2 className="tt-sect">Your opening Matchup</h2>
                <MatchupBug matchup={opening} teams={teams} />
                {opening.doneAt === null && (
                  <details className="tt-round">
                    <summary className="tt-round-summary">
                      <b>Finish the opening Matchup</b>
                    </summary>
                    <div className="tt-round-body">
                      <MatchupRounds matchup={opening} teams={teams} writes={writes} />
                      <MatchupDonePanel matchup={opening} teams={teams} writes={writes} />
                    </div>
                  </details>
                )}
              </section>
            )}
            <RosterForm
              team={me}
              title="Your roster"
              scoredRounds={scoredRoundsFor(event, myTeamId)}
              writes={writes}
            />
          </div>
        </div>
      </div>
    </>
  );
}
