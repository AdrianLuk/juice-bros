"use client";

import { useMemo, type CSSProperties } from "react";

import type { LiveView } from "@/lib/team-tally/actions/live";
import { flightMatchups, openingMatchups } from "@/lib/team-tally/event-doc";
import { eventDateLabel } from "@/lib/team-tally/format";
import { FlightHandoff } from "./flight-handoff";
import { MatchupBug } from "./matchup-bug";
import { MatchupGames } from "./matchup-games";
import { QueryProvider } from "./query-provider";
import { ResultsSummary } from "./results-summary";
import { StandingsTower } from "./standings-tower";
import { TtAppBar } from "./tt-head";
import { TvStage, type PublicView } from "./tv-stage";
import { useLiveEvent } from "./use-live-event";

/**
 * The Public Link (issues #623, #624, #625). It lays itself out for whatever
 * screen opens it, in CSS (`.tt-public`), so there is no flash: a venue TV or
 * a laptop gets the big-screen stage, a phone gets the scrolling layout, and
 * both are in the page, one hidden. Read-only, kept live.
 *
 * Scrolling layout: once the Flights are placed they lead, each hand-off
 * (Flight and court pair at display size) over its score bug; then the
 * standings tower and every opening Matchup's score bug, each opening to its
 * six Games and who entered them. Once the night has ended it becomes the
 * results page: the Flight champions and Final places, then the opening
 * standings with their tie-break notes, then every Matchup's Games.
 *
 * `view` forces a layout (the link's `?view=`), `screen` pins one big-screen
 * screen (`?screen=`).
 */
/**
 * How many Matchup slots the opening standings stand beside on the desktop
 * results page: the tower's height (a row per Team, a band per Flight) over
 * one Matchup's (a FINAL bug over its folded Games), about 3.9 at 14 Teams,
 * plus the row the "Every Matchup" heading takes.
 */
function towerSpan(teamCount: number): number {
  const towerPx = 80 + teamCount * 42 + (teamCount / 2) * 26;
  return Math.max(1, Math.round(towerPx / 215)) + 1;
}

export function PublicBoard({
  token,
  initial,
  view = "auto",
  screen,
}: {
  token: string;
  initial: LiveView;
  view?: PublicView;
  screen?: string;
}) {
  return (
    <QueryProvider>
      <PublicBoardInner token={token} initial={initial} view={view} screen={screen} />
    </QueryProvider>
  );
}

function PublicBoardInner({
  token,
  initial,
  view: forced,
  screen,
}: {
  token: string;
  initial: LiveView;
  view: PublicView;
  screen?: string;
}) {
  const { view } = useLiveEvent({ kind: "public", token }, initial);
  const { event } = view;
  const teams = useMemo(() => new Map(event.teams.map((team) => [team.id, team])), [event.teams]);
  const flights = flightMatchups(event);
  const opening = openingMatchups(event);
  const finished = event.status === "finished";

  const matchupItem = (matchup: (typeof event.matchups)[number]) => (
    <li key={matchup.id} className="grid gap-2">
      <MatchupBug matchup={matchup} teams={teams} />
      <MatchupGames matchup={matchup} teams={teams} />
    </li>
  );

  return (
    <div className="tt-public" data-view={forced}>
      <div className="tt-public-scroll">
        <TtAppBar context={finished ? "Results" : "Live standings"} />
        <div className="tt-wrap tt-livepage">
          <header className="tt-live-head">
            <h1 className="tt-live-title">{event.name}</h1>
            <p className="tt-meta m-0">
              {eventDateLabel(event.date)} · {event.teams.length} Teams
            </p>
            <a href="?view=tv" className="tt-quietlink tt-public-tvlink">
              Big-screen view
            </a>
          </header>

          {finished && (
            <section aria-label="Results" className="grid gap-2">
              <h2 className="tt-sect">
                Results <span className="tt-final">Final</span>
              </h2>
              <ResultsSummary event={event} teams={teams} />
            </section>
          )}

          {!finished && flights.length > 0 && (
            <section aria-label="Flights" className="grid gap-2">
              <h2 className="tt-sect">
                Flights <span className="tt-live-mark">Now</span>
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

          {finished ? (
            <>
              {/* Every Matchup two across, Flights first, flowing round the
                  opening standings: the tower takes the left column for as
                  many Matchups as it is tall, then the Matchups run both
                  columns, so no column runs on alone. */}
              <div
                className="tt-results-flow"
                style={{ "--tt-tower-span": towerSpan(event.teams.length) } as CSSProperties}
              >
                <section aria-label="Standings" className="tt-results-tower grid content-start gap-2">
                  <h2 className="sr-only">Opening standings</h2>
                  <StandingsTower event={event} />
                </section>
                <section aria-label="Every Matchup" className="contents">
                  <h2 className="tt-sect tt-results-flow-head">Every Matchup</h2>
                  <ul className="contents">
                    {flights.map(matchupItem)}
                    {opening.map(matchupItem)}
                  </ul>
                </section>
              </div>
            </>
          ) : (
            <div className="tt-live-grid tt-live-grid-public">
              <section aria-label="Standings" className="grid content-start gap-2">
                <h2 className="sr-only">Standings</h2>
                <StandingsTower event={event} />
              </section>

              <section aria-label="Matchups" className="grid content-start gap-2">
                <h2 className="tt-sect">{flights.length > 0 ? "Opening round" : "Matchups"}</h2>
                <ul className="tt-matchup-list">{opening.map(matchupItem)}</ul>
              </section>
            </div>
          )}
        </div>
      </div>

      <TvStage event={event} teams={teams} view={forced} pinned={screen} />
    </div>
  );
}
