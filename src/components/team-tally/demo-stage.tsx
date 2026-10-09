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

/** Each screen, who holds it, and what it is for: the tagline under its tab. */
const SCREENS: { id: DemoScreen; label: string; who: string; what: string }[] = [
  { id: "score", label: "Score Link", who: "For each captain", what: "Enter your Matchup's scores from your phone." },
  { id: "public", label: "Public Link", who: "For players and fans", what: "Follow the standings and scores on any phone." },
  { id: "tv", label: "TV", who: "For the venue screen", what: "Standings and Matchups, cycling on their own." },
  { id: "organizer", label: "Organizer", who: "For the Organizer", what: "Fix any score, reopen a Matchup, call a tie." },
  { id: "brief", label: "Brief", who: "For the group chat", what: "Teams, courts and links, ready to paste." },
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
          {SCREENS.map(({ id, label, who, what }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tt-demo-tab-${id}`}
              aria-selected={screen === id}
              aria-controls="tt-demo-panel"
              aria-labelledby={`tt-demo-tab-${id}-label`}
              aria-describedby={`tt-demo-tab-${id}-what`}
              data-testid={`demo-screen-${id}`}
              className="tt-demo-tab"
              onClick={() => setScreen(id)}
            >
              <span id={`tt-demo-tab-${id}-label`} className="tt-demo-tab-label">
                {label}
              </span>
              <span id={`tt-demo-tab-${id}-what`} className="tt-demo-tab-what">
                <span className="tt-demo-tab-who">{who}</span> {what}
              </span>
            </button>
          ))}
        </div>
        <div className="tt-demo-controls">
          <div className="tt-demo-control">
            <button
              type="button"
              className={running ? "tt-btn" : "tt-btn tt-btn-ghost"}
              data-testid="demo-let-it-run"
              aria-pressed={running}
              aria-describedby="tt-demo-run-what"
              disabled={finished}
              onClick={() => setRunning((on) => !on)}
            >
              {running ? "Stop" : "Let it run"}
            </button>
            <p id="tt-demo-run-what" className="tt-demo-control-what">
              Plays out the other courts so you can watch the Flights get placed and the results go up.
            </p>
          </div>
          <div className="tt-demo-control">
            <button
              type="button"
              className="tt-btn tt-btn-ghost"
              data-testid="demo-reset"
              aria-describedby="tt-demo-reset-what"
              onClick={reset}
            >
              Reset
            </button>
            <p id="tt-demo-reset-what" className="tt-demo-control-what">
              Starts the night over from where it opened.
            </p>
          </div>
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
