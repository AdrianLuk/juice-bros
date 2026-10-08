"use client";

import { useMemo } from "react";

import type { LiveView } from "@/lib/team-tally/actions/live";
import { matchupLabel, scoredRoundsFor, teamName } from "@/lib/team-tally/event-doc";
import { MatchupBug } from "./matchup-bug";
import { MatchupRounds } from "./matchup-rounds";
import { QueryProvider } from "./query-provider";
import { RosterForm } from "./roster-form";
import { StandingsTower } from "./standings-tower";
import { useLiveEvent } from "./use-live-event";

/**
 * The Organizer's view of a running Team Event (issue #623): the standings,
 * then every Matchup with all six Games editable and both rosters. Whatever
 * the Organizer saves is labelled "edited by the organizer".
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
  const writer = { kind: "organizer" as const, eventId };

  return (
    <div className="grid gap-6">
      <section aria-label="Standings" className="grid gap-2">
        <h2 className="sr-only">Standings</h2>
        <StandingsTower event={event} />
      </section>

      <div className="tt-organizer-matchups">
        {event.matchups.map((matchup) => (
          <section key={matchup.id} aria-label={matchupLabel(matchup)} className="grid content-start gap-3">
            <MatchupBug matchup={matchup} teams={teams} />
            <MatchupRounds matchup={matchup} teams={teams} writer={writer} onSaved={refresh} />
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
        ))}
      </div>
    </div>
  );
}
