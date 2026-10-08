"use client";

import { useMemo } from "react";

import type { LiveView } from "@/lib/team-tally/actions/live";
import { eventDateLabel } from "@/lib/team-tally/format";
import { GameLine } from "./game-card";
import { MatchupBug } from "./matchup-bug";
import { QueryProvider } from "./query-provider";
import { StandingsTower } from "./standings-tower";
import { TtAppBar } from "./tt-head";
import { useLiveEvent } from "./use-live-event";

/**
 * The Public Link's phone layout (issue #623): the standings tower, then
 * every Matchup's score bug, each opening to its six Games and who entered
 * them. Read-only. The big-screen layout is #625's.
 */
export function PublicBoard({ token, initial }: { token: string; initial: LiveView }) {
  return (
    <QueryProvider>
      <PublicBoardInner token={token} initial={initial} />
    </QueryProvider>
  );
}

function PublicBoardInner({ token, initial }: { token: string; initial: LiveView }) {
  const { view } = useLiveEvent({ kind: "public", token }, initial);
  const { event } = view;
  const teams = useMemo(() => new Map(event.teams.map((team) => [team.id, team])), [event.teams]);

  return (
    <>
      <TtAppBar context="Live standings" />
      <div className="tt-wrap tt-livepage">
        <header className="tt-live-head">
          <h1 className="tt-live-title">{event.name}</h1>
          <p className="tt-meta m-0">
            {eventDateLabel(event.date)} · {event.teams.length} Teams
          </p>
        </header>

        <div className="tt-live-grid tt-live-grid-public">
          <section aria-label="Standings" className="grid content-start gap-2">
            <h2 className="sr-only">Standings</h2>
            <StandingsTower event={event} />
          </section>

          <section aria-label="Matchups" className="grid content-start gap-2">
            <h2 className="tt-sect">Matchups</h2>
            <ul className="tt-matchup-list">
              {event.matchups.map((matchup) => {
                const name = `${matchup.stage === "flight" ? `Flight ${matchup.flightLetter}` : `Match ${matchup.number}`} games`;
                return (
                  <li key={matchup.id} className="grid gap-2">
                    <MatchupBug matchup={matchup} teams={teams} />
                    <details className="tt-round">
                      <summary className="tt-round-summary">
                        <b>{name}</b>
                      </summary>
                      <section aria-label={name} className="tt-round-body">
                        <ol className="tt-game-lines">
                          {matchup.games.map((game) => (
                            <GameLine key={game.id} game={game} matchup={matchup} teams={teams} />
                          ))}
                        </ol>
                      </section>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
