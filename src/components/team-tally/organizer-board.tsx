"use client";

import { useMemo } from "react";

import type { LiveView } from "@/lib/team-tally/actions/live";
import { type DocMatchup, flightMatchups, matchupLabel, openingMatchups, scoredRoundsFor, teamName } from "@/lib/team-tally/event-doc";
import { FlightHandoff } from "./flight-handoff";
import { MatchupBug } from "./matchup-bug";
import { MatchupDonePanel } from "./matchup-done-panel";
import { MatchupRounds } from "./matchup-rounds";
import { QueryProvider } from "./query-provider";
import { RosterForm } from "./roster-form";
import { SeedingPanel } from "./seeding-panel";
import { StandingsTower } from "./standings-tower";
import { useLiveEvent } from "./use-live-event";

/**
 * The Organizer's view of a running Team Event (issues #623, #624): the
 * standings and the Flights sheet (Seed now, a tie on every count, court
 * swaps), then every Matchup, Flights first once placed, with all six Games
 * editable, Matchup done and Reopen, and both rosters. Whatever the
 * Organizer saves is labelled "edited by the organizer".
 */
export function OrganizerBoard({ eventId, initial }: { eventId: string; initial: LiveView }) {
  return (
    <QueryProvider>
      <OrganizerBoardInner eventId={eventId} initial={initial} />
    </QueryProvider>
  );
}

function OrganizerBoardInner({ eventId, initial }: { eventId: string; initial: LiveView }) {
  const { view, refresh } = useLiveEvent({ kind: "organizer", eventId }, initial);
  const { event } = view;
  const teams = useMemo(() => new Map(event.teams.map((team) => [team.id, team])), [event.teams]);
  const writer = { kind: "organizer" as const };
  const flights = flightMatchups(event);
  const opening = openingMatchups(event);
  const openLeft = opening.filter((matchup) => matchup.doneAt === null).length;

  const matchupSection = (matchup: DocMatchup) => (
    <section key={matchup.id} aria-label={matchupLabel(matchup)} className="grid content-start gap-3">
      {matchup.stage === "flight" && <FlightHandoff flight={matchup} teams={teams} size="compact" />}
      <MatchupBug matchup={matchup} teams={teams} />
      <MatchupRounds matchup={matchup} teams={teams} writer={writer} onSaved={refresh} />
      <MatchupDonePanel
        matchup={matchup}
        teams={teams}
        writer={writer}
        onSaved={refresh}
        lastOpening={matchup.stage === "opening" && event.status === "opening" && openLeft === 1}
      />
      <details className="tt-round">
        <summary className="tt-round-summary">
          <b>Rosters</b>
        </summary>
        <div className="tt-round-body">
          {[matchup.redTeamId, matchup.blueTeamId].map((teamId) => {
            const team = teams.get(teamId)!;
            return (
              <RosterForm
                key={teamId}
                team={team}
                title={`${teamName(team)} roster`}
                scoredRounds={scoredRoundsFor(event, teamId)}
                writer={writer}
                onSaved={refresh}
              />
            );
          })}
        </div>
      </details>
    </section>
  );

  return (
    <div className="grid gap-6">
      <div className="tt-organizer-top">
        <section aria-label="Standings" className="grid content-start gap-2">
          <h2 className="sr-only">Standings</h2>
          <StandingsTower event={event} />
        </section>
        <SeedingPanel event={event} onSaved={refresh} />
      </div>

      {flights.length > 0 && <div className="tt-organizer-matchups">{flights.map(matchupSection)}</div>}
      {flights.length > 0 && <h2 className="tt-sect">Opening round</h2>}
      <div className="tt-organizer-matchups">{opening.map(matchupSection)}</div>
    </div>
  );
}
