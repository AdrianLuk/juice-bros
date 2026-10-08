"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { siteConfig } from "@/config/site";
import { generateBrief } from "@/lib/team-tally/brief";
import { demoNight } from "@/lib/team-tally/demo/night";
import { nextRunStep } from "@/lib/team-tally/demo/run";
import { demoBriefInput, demoWrites } from "@/lib/team-tally/demo/seam";
import { createDemoStore } from "@/lib/team-tally/demo/store";
import { flightMatchups, openingMatchups, type TeamEventDoc } from "@/lib/team-tally/event-doc";
import { CopyBriefButton } from "./copy-brief-button";
import { OrganizerScreen } from "./organizer-screen";
import { PublicScreen } from "./public-screen";
import { ScoreLinkScreen } from "./score-link-screen";
import { TvStage } from "./tv-stage";

/**
 * The demo night's stage (issue #631): Team Tally's real screens, all on one
 * night held in the browser. The screens take the demo adapter of the live
 * seam instead of the Server Actions, so a score typed on the Score Link is
 * what the TV, the Public Link and the Organizer's board show next, and a
 * refusal (13-9, a tie with no Dreambreaker) is the real one.
 *
 * Let it run plays the other Matchups one write at a time (`demo/run.ts`)
 * until the night ends; Reset brings back the night as it opened.
 */

/** Long enough to see each score land, short enough to reach the results in under a minute. */
const RUN_INTERVAL_MS = 700;

type DemoScreen = "score" | "public" | "tv" | "organizer" | "brief";

const SCREENS: { id: DemoScreen; label: string }[] = [
  { id: "score", label: "Score Link" },
  { id: "public", label: "Public Link" },
  { id: "tv", label: "TV" },
  { id: "organizer", label: "Organizer" },
  { id: "brief", label: "Brief" },
];

/** Where the night is, in a line: for the bar above the screens. */
function progressOf(event: TeamEventDoc): string {
  if (event.status === "finished") return "Final · results are up";
  const done = (list: { doneAt: string | null }[]) => list.filter((matchup) => matchup.doneAt !== null).length;
  if (event.status === "flights") {
    const flights = flightMatchups(event);
    return `Flights · ${done(flights)} of ${flights.length} done`;
  }
  const opening = openingMatchups(event);
  return `Opening round · ${done(opening)} of ${opening.length} Matchups done`;
}

export function DemoStage({ date }: { date: string }) {
  const [opening] = useState(() => demoNight(date));
  const { myTeamId } = opening;
  const [store] = useState(() => createDemoStore(opening.event));
  const event = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [screen, setScreen] = useState<DemoScreen>("score");
  const [running, setRunning] = useState(false);

  const teamWrites = useMemo(() => demoWrites({ kind: "team", teamId: myTeamId }, store.commit), [myTeamId, store]);
  const organizerWrites = useMemo(() => demoWrites({ kind: "organizer" }, store.commit), [store]);
  const teams = useMemo(() => new Map(event.teams.map((team) => [team.id, team])), [event.teams]);
  const brief = useMemo(() => generateBrief(demoBriefInput(event, siteConfig.url)), [event]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const step = nextRunStep(store.get(), myTeamId);
      if (!step) {
        setRunning(false);
        return;
      }
      void store.commit(step.actor, step.write);
    }, RUN_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [running, myTeamId, store]);

  function reset() {
    setRunning(false);
    store.reset(opening.event);
  }

  const finished = event.status === "finished";

  return (
    <div className="tt-demo">
      <div className="tt-demo-bar">
        <div role="tablist" aria-label="Demo screen" className="tt-demo-tabs">
          {SCREENS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tt-demo-tab-${id}`}
              aria-selected={screen === id}
              aria-controls="tt-demo-panel"
              data-testid={`demo-screen-${id}`}
              className={screen === id ? "tt-btn tt-demo-tab" : "tt-btn tt-btn-ghost tt-demo-tab"}
              onClick={() => setScreen(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tt-demo-controls">
          <button
            type="button"
            className={running ? "tt-btn" : "tt-btn tt-btn-ghost"}
            data-testid="demo-let-it-run"
            aria-pressed={running}
            disabled={finished}
            onClick={() => setRunning((on) => !on)}
          >
            {running ? "Stop" : "Let it run"}
          </button>
          <button type="button" className="tt-btn tt-btn-ghost" data-testid="demo-reset" onClick={reset}>
            Reset
          </button>
        </div>
        <p className="tt-meta tt-demo-progress" role="status" aria-live="polite" data-testid="demo-progress">
          {progressOf(event)}
        </p>
      </div>

      <div id="tt-demo-panel" role="tabpanel" aria-labelledby={`tt-demo-tab-${screen}`} className="tt-demo-panel">
        {screen === "score" && (
          <div className="tt-demo-frame">
            <ScoreLinkScreen live={{ view: { event, myTeamId }, writes: teamWrites }} myTeamId={myTeamId} />
          </div>
        )}

        {screen === "public" && (
          <div className="tt-demo-phone">
            <PublicScreen live={{ view: { event } }} view="scroll" />
          </div>
        )}

        {screen === "tv" && (
          <div className="tt-demo-tv">
            <TvStage event={event} teams={teams} view="tv" framed />
          </div>
        )}

        {screen === "organizer" && (
          <div className="tt-demo-frame tt-demo-organizer">
            <OrganizerScreen live={{ view: { event }, writes: organizerWrites }} />
          </div>
        )}

        {screen === "brief" && (
          <div className="tt-sheet tt-demo-brief">
            <div className="tt-section-head">
              <h2 className="tt-h2">The brief</h2>
              <span className="tt-meta">For the group chat</span>
            </div>
            <div className="tt-section-body pb-0">
              <CopyBriefButton brief={brief} />
            </div>
            <pre aria-label="The brief" className="tt-brief">
              {brief}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
