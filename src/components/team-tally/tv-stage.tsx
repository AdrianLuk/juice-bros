"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

import { eventDateLabel } from "@/lib/team-tally/format";
import {
  flightMatchups,
  openingMatchups,
  type DocMatchup,
  type DocTeam,
  type TeamEventDoc,
} from "@/lib/team-tally/event-doc";
import { flightResults } from "@/lib/team-tally/final-places";
import { computeStandings } from "@/lib/team-tally/standings";
import {
  bugGridColumns,
  bugGridScale,
  handoffGridColumns,
  splitStandings,
  tvScreens,
  type TvScreen,
  type TvScreenId,
} from "@/lib/team-tally/tv-screens";
import { FlightHandoff } from "./flight-handoff";
import { MatchupBug } from "./matchup-bug";
import { ChampionsPlate, FinalPlacesPlate } from "./results-summary";
import { StandingsTower, openingLiveRound } from "./standings-tower";

/**
 * When the Public Link lays itself out for a venue TV or a laptop: roughly
 * 1280 wide and up, in landscape, with room enough to read. The same query is
 * repeated in team-tally.css (`.tt-public`), which does the actual switching,
 * so the layout never flashes on load; this copy only tells the cycle timer
 * whether anyone can see the stage.
 */
export const TV_QUERY = "(min-width: 1280px) and (min-aspect-ratio: 3/2) and (min-height: 560px)";

export type PublicView = "auto" | "tv" | "scroll";

function subscribe(query: string) {
  return (notify: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", notify);
    return () => list.removeEventListener("change", notify);
  };
}

/** Whether the stage is on screen: the big-screen query matches, or the link forces it. */
function useStageVisible(view: PublicView): boolean {
  const matches = useSyncExternalStore(
    subscribe(TV_QUERY),
    () => window.matchMedia(TV_QUERY).matches,
    () => false,
  );
  return view === "tv" || (view === "auto" && matches);
}

/** "Flights A to C", "Flight A": the Flights a column of the tower holds. */
function flightRange(firstPosition: number, lastPosition: number): string {
  const letter = (position: number) => String.fromCharCode(65 + Math.floor((position - 1) / 2));
  const first = letter(firstPosition);
  const last = letter(lastPosition);
  return first === last ? `Flight ${first}` : `Flights ${first} to ${last}`;
}

function doneCount(matchups: DocMatchup[]): string {
  return `${matchups.filter((matchup) => matchup.doneAt !== null).length} of ${matchups.length}`;
}

/** What the head says about the night: its stage, and how far through it is. */
function stageOf(event: TeamEventDoc): { name: string; progress: string; live?: string } {
  const opening = openingMatchups(event);
  const flights = flightMatchups(event);
  if (event.status === "finished") {
    return { name: "Final", progress: `${flights.length} Flights played` };
  }
  if (event.status === "flights") {
    return { name: "Flights", progress: `${doneCount(flights)} Flights done`, live: "Now" };
  }
  const round = openingLiveRound(event);
  return {
    name: "Opening round",
    progress: `${doneCount(opening)} Matchups done`,
    live: round ? `Round ${round}` : undefined,
  };
}

function BugGrid({ matchups, teams }: { matchups: DocMatchup[]; teams: Map<string, DocTeam> }) {
  const columns = bugGridColumns(matchups.length);
  const scale = bugGridScale(
    matchups.length,
    matchups.some((matchup) => matchup.doneAt !== null),
  );
  return (
    <ul
      className="tt-tv-bugs"
      data-count={matchups.length}
      style={{ "--tt-tv-cols": columns, "--tt-tv-bug-scale": scale } as CSSProperties}
    >
      {matchups.map((matchup) => (
        <li key={matchup.id}>
          <MatchupBug matchup={matchup} teams={teams} />
        </li>
      ))}
    </ul>
  );
}

function StandingsScreen({ event }: { event: TeamEventDoc }) {
  const standings = computeStandings(event);
  const { left, right } = splitStandings(standings);
  const columns = [left, right].filter((rows) => rows.length > 0);
  return (
    <div className="tt-tv-cols">
      {columns.map((rows) => {
        const first = rows[0].position;
        const last = rows[rows.length - 1].position;
        return (
          <StandingsTower
            key={first}
            event={event}
            size="tv"
            positions={[first, last]}
            label={`Standings · ${flightRange(first, last)}`}
          />
        );
      })}
    </div>
  );
}

function ScreenBody({ id, event, teams }: { id: TvScreenId; event: TeamEventDoc; teams: Map<string, DocTeam> }) {
  const flights = flightMatchups(event);
  switch (id) {
    case "standings":
      return <StandingsScreen event={event} />;
    case "matchups":
      return <BugGrid matchups={openingMatchups(event)} teams={teams} />;
    case "handoff":
      return (
        <ul
          className="tt-tv-bugs tt-tv-handoffs"
          data-count={flights.length}
          style={{ "--tt-tv-cols": handoffGridColumns(flights.length) } as CSSProperties}
        >
          {flights.map((flight) => (
            <li key={flight.id}>
              <FlightHandoff flight={flight} teams={teams} size="tv" />
            </li>
          ))}
        </ul>
      );
    case "flight-scores":
      return <BugGrid matchups={flights} teams={teams} />;
    case "summary":
      return (
        <div className="tt-tv-summary">
          <ChampionsPlate results={flightResults(event)} teams={teams} size="tv" />
          <FinalPlacesPlate event={event} teams={teams} size="tv" />
        </div>
      );
  }
}

/** The screen to show now: the pinned one if the night has it, else the cycle's. */
function screenNamed(screens: TvScreen[], id: string | undefined): TvScreen | undefined {
  return screens.find((screen) => screen.id === id);
}

/**
 * The Public Link's big-screen layout (issue #625), for a venue TV or a
 * laptop: one full-viewport stage that never scrolls, cutting between complete
 * screens on a timer. Hard cuts, no transitions: broadcast graphics cut.
 *
 * What it shows follows the night. The opening round cycles the standings
 * (a full-width tower in two columns) and the Matchups. After Seeding the
 * Flight hand-off, the Flights and their court pairs at display size, holds the
 * stage alone until a Flight has a score, then leads the cycle. A finished
 * night leads with its results. `pinned` (the link's `?screen=`) holds one
 * screen still.
 *
 * Every screen stays mounted and only the current one is shown, so the
 * standings tower keeps its up and down marks and can slide its rows when it
 * comes back on screen.
 */
export function TvStage({
  event,
  teams,
  view,
  pinned,
}: {
  event: TeamEventDoc;
  teams: Map<string, DocTeam>;
  view: PublicView;
  pinned?: string;
}) {
  const screens = tvScreens(event);
  const screensKey = screens.map((screen) => screen.id).join(",");
  const visible = useStageVisible(view);
  const [cycleId, setCycleId] = useState<TvScreenId | undefined>(undefined);

  const pin = screenNamed(screens, pinned);
  const current = pin ?? screenNamed(screens, cycleId) ?? screens[0];

  useEffect(() => {
    if (!visible || pin || screens.length < 2) return;
    const timer = window.setTimeout(() => {
      const at = screens.findIndex((screen) => screen.id === current.id);
      setCycleId(screens[(at + 1) % screens.length].id);
    }, current.dwellMs);
    return () => window.clearTimeout(timer);
    // `screens` is derived from `screensKey` and `current.id`; both are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pin, screensKey, current.id, current.dwellMs]);

  const stage = stageOf(event);

  return (
    <div className="tt-tv" aria-label="Big screen">
      <header className="tt-tv-head">
        <div className="tt-tv-id">
          <h1 className="tt-tv-title">{event.name}</h1>
          <p className="tt-tv-meta">
            {eventDateLabel(event.date)} · {event.teams.length} Teams
          </p>
        </div>
        <div className="tt-tv-stage">
          <span className="tt-tv-stage-name">
            {stage.name}
            {stage.live && <span className="tt-live-mark tt-tv-live">{stage.live}</span>}
          </span>
          <span className="tt-tv-stage-progress">{stage.progress}</span>
        </div>
      </header>

      <div className="tt-tv-body">
        {screens.map((screen) => (
          <section
            key={screen.id}
            className="tt-tv-screen"
            aria-label={screen.label}
            hidden={screen.id !== current.id}
          >
            <ScreenBody id={screen.id} event={event} teams={teams} />
          </section>
        ))}
      </div>

      <footer className="tt-tv-foot">
        {screens.length > 1 ? (
          <ol className="tt-tv-cycle" aria-label="Screens">
            {screens.map((screen) => (
              <li key={screen.id} aria-current={screen.id === current.id ? "true" : undefined}>
                {screen.label}
              </li>
            ))}
          </ol>
        ) : (
          <span />
        )}
        <div className="tt-tv-sign">
          <a href="?view=scroll" className="tt-tv-link">
            Scrolling view
          </a>
          <span className="tt-mark tt-tv-mark">
            <span aria-hidden className="tt-mark-blocks" />
            Team Tally
          </span>
        </div>
      </footer>
    </div>
  );
}
