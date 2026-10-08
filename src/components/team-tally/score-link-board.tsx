"use client";

import { useMemo } from "react";

import type { LiveView } from "@/lib/team-tally/actions/live";
import { captainTeamName, scoredRoundsFor, sideOf } from "@/lib/team-tally/event-doc";
import { eventDateLabel } from "@/lib/team-tally/format";
import { MatchupBug } from "./matchup-bug";
import { MatchupRounds } from "./matchup-rounds";
import { QueryProvider } from "./query-provider";
import { RosterForm } from "./roster-form";
import { StandingsTower } from "./standings-tower";
import { TtAppBar } from "./tt-head";
import { useLiveEvent } from "./use-live-event";

/**
 * A captain's Score Link (issue #623): their Matchup's bug, the live Round's
 * two Games with score boxes, the other Rounds folded below, then the
 * standings and their own roster. No account; the token is the credential.
 */
export function ScoreLinkBoard({ token, initial }: { token: string; initial: LiveView }) {
  return (
    <QueryProvider>
      <ScoreLinkBoardInner token={token} initial={initial} />
    </QueryProvider>
  );
}

function ScoreLinkBoardInner({ token, initial }: { token: string; initial: LiveView }) {
  const { view, refresh } = useLiveEvent({ kind: "score", token }, initial);
  const { event } = view;
  const myTeamId = view.myTeamId ?? initial.myTeamId!;
  const teams = useMemo(() => new Map(event.teams.map((team) => [team.id, team])), [event.teams]);
  const me = teams.get(myTeamId)!;
  // The Matchup this Team is playing now: its Flight once there is one.
  const mine = event.matchups.filter((matchup) => sideOf(matchup, myTeamId)).at(-1);
  const writer = { kind: "score" as const, token };

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
            {mine ? (
              <>
                <MatchupBug matchup={mine} teams={teams} />
                <MatchupRounds matchup={mine} teams={teams} writer={writer} onSaved={refresh} />
              </>
            ) : (
              <p className="tt-body">Your Team isn&apos;t in a Matchup yet.</p>
            )}
          </div>

          <div className="tt-live-side">
            <section aria-label="Standings" className="grid gap-2">
              <h2 className="sr-only">Standings</h2>
              <StandingsTower event={event} myTeamId={myTeamId} />
            </section>
            <RosterForm
              team={me}
              title="Your roster"
              scoredRounds={scoredRoundsFor(event, myTeamId)}
              writer={writer}
              onSaved={refresh}
            />
          </div>
        </div>
      </div>
    </>
  );
}
