"use client";

import { useMemo } from "react";

import type { LiveView } from "@/lib/team-tally/actions/live";
import type { DocMatchup, DocTeam } from "@/lib/team-tally/event-doc";
import { eventDateLabel } from "@/lib/team-tally/format";
import { FlightHandoff } from "./flight-handoff";
import { GameLine } from "./game-card";
import { MatchupBug } from "./matchup-bug";
import { QueryProvider } from "./query-provider";
import { StandingsTower } from "./standings-tower";
import { TtAppBar } from "./tt-head";
import { useLiveEvent } from "./use-live-event";

/**
 * The Public Link's phone layout (issues #623, #624): once the Flights are
 * placed they lead, each hand-off (Flight and court pair at display size)
 * over its score bug; then the standings tower and every opening Matchup's
 * score bug, each opening to its six Games and who entered them. Read-only.
 * The big-screen layout is #625's.
 */
export function PublicBoard({ token, initial }: { token: string; initial: LiveView }) {
  return (
    <QueryProvider>
      <PublicBoardInner token={token} initial={initial} />
    </QueryProvider>
  );
}

function MatchupGames({ matchup, teams }: { matchup: DocMatchup; teams: Map<string, DocTeam> }) {
  const name = `${matchup.stage === "flight" ? `Flight ${matchup.flightLetter}` : `Match ${matchup.number}`} games`;
  return (
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
  );
}

function PublicBoardInner({ token, initial }: { token: string; initial: LiveView }) {
  const { view } = useLiveEvent({ kind: "public", token }, initial);
  const { event } = view;
  const teams = useMemo(() => new Map(event.teams.map((team) => [team.id, team])), [event.teams]);
  const flights = event.matchups.filter((matchup) => matchup.stage === "flight");
  const opening = event.matchups.filter((matchup) => matchup.stage === "opening");

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

        {flights.length > 0 && (
          <section aria-label="Flights" className="grid gap-2">
            <h2 className="tt-sect">
              Flights {event.status === "flights" && <span className="tt-live-mark">Now</span>}
            </h2>
            <ul className="tt-flight-grid">
              {flights.map((flight) => (
                <li key={flight.id} className="grid content-start gap-2">
                  <FlightHandoff flight={flight} teams={teams} />
                  <MatchupBug matchup={flight} teams={teams} />
                  <MatchupGames matchup={flight} teams={teams} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="tt-live-grid tt-live-grid-public">
          <section aria-label="Standings" className="grid content-start gap-2">
            <h2 className="sr-only">Standings</h2>
            <StandingsTower event={event} />
          </section>

          <section aria-label="Matchups" className="grid content-start gap-2">
            <h2 className="tt-sect">{flights.length > 0 ? "Opening round" : "Matchups"}</h2>
            <ul className="tt-matchup-list">
              {opening.map((matchup) => (
                <li key={matchup.id} className="grid gap-2">
                  <MatchupBug matchup={matchup} teams={teams} />
                  <MatchupGames matchup={matchup} teams={teams} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
