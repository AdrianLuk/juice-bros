"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  FloorBoard,
  NOTHING_PENDING as FLOOR_NOTHING_PENDING,
  type FloorBoardOps,
} from "@/components/on-deck/floor-board";
import { DisplayBoard } from "@/components/on-deck/display-board";
import {
  KioskBoard,
  NOTHING_PENDING as KIOSK_NOTHING_PENDING,
  type KioskBoardOps,
} from "@/components/on-deck/kiosk-board";
import { useBoardClock } from "@/components/on-deck/use-board-clock";
import { DEMO_CONFIG, demoNightEvents } from "@/lib/on-deck/demo/night";
import {
  appendToDemoLog,
  demoLoadedSession,
  demoLogOf,
  undoInDemoLog,
  type DemoLog,
} from "@/lib/on-deck/demo/fold";
import {
  dispatchFloorCommand,
  mintFloorIds,
  type FloorCommand,
} from "@/lib/on-deck/floor-commands";
import {
  floorRosterFrom,
  rotationViewFrom,
} from "@/lib/on-deck/session/rotation-view";
import type { Operator } from "@/lib/on-deck/session/types";
import type { OnDeckFunnelEvent } from "@/lib/on-deck/analytics-events";
import { trackWhenReady } from "@/lib/on-deck/analytics-browser";

/**
 * The demo's three screens sharing one night (issue #522): a visitor can flip
 * between the Floor, the Display and the Kiosk without losing a single
 * turnover, let the night run on its own, and start it over. Everything below
 * folds the identical event log `demo-floor.tsx` folded alone for #519 — this
 * is that same seam widened to the Kiosk, which had none until now, plus the
 * Display, which already had no taps to widen a seam for.
 *
 * `FloorBoard` stands in for the Organizer; `KioskBoard` stands in for
 * whoever is stood at the courts. Both send their taps through the same pure
 * `dispatchFloorCommand` the live Server Actions call (issue #612), appended
 * to the same
 * in-memory log (`demo/fold.ts`) held in `useState`, so a tap on one screen is
 * exactly what the other two see on their next render.
 */

/** How often "let it run" fires a turnover — long enough to watch each one
 * land, short enough that a stranger doesn't get bored waiting for the next. */
const LET_IT_RUN_INTERVAL_MS = 3000;

/**
 * How many turnovers count as having seen the demo work (issue #524).
 *
 * A chosen number, not a derived one. The demo's night has no ending to reach
 * — a rolling queue with no time cap (ADR 0002), which is the product's
 * actual behaviour and not a shortcut taken here — so the only literal
 * "finished" available is the visitor tapping Last Call and then Close, which
 * next to nobody will do. Three is the smallest count that is unmistakably a
 * decision to keep watching rather than a single curious tap. If it turns out
 * to be the wrong threshold, `od_demo_opened` is still the honest denominator
 * and this number can move without losing what has already been counted.
 */
const DEMO_FINISHED_TURNOVERS = 3;

const DEMO_OPENED: OnDeckFunnelEvent = "od_demo_opened";
const DEMO_FINISHED: OnDeckFunnelEvent = "od_demo_finished";

/**
 * Funnel state for the page load, not for the mount — deliberately module
 * scope rather than refs.
 *
 * A visitor who clicks "Create your Club" under the board and then comes back
 * has client-side-navigated away and back, which unmounts and remounts this
 * component. Refs would be fresh, so that one visit would report two opens and
 * could report two finishes, and both of those are denominators in the funnel
 * read — `od_club_intent ÷ od_demo_finished` is the headline number. Module
 * scope survives the router and resets on an actual page load, which is the
 * unit being counted.
 *
 * `demoTurnovers` survives the same way on purpose: somebody who watched two
 * turnovers, went to look at the sign-in page and came back to watch a third
 * has watched three.
 */
let demoOpenedFired = false;
let demoFinishedFired = false;
let demoTurnovers = 0;

type DemoScreen = "floor" | "display" | "kiosk";

const SCREENS: { id: DemoScreen; label: string }[] = [
  { id: "floor", label: "Floor" },
  { id: "display", label: "Display" },
  { id: "kiosk", label: "Kiosk" },
];

/** The two Operators the demo stands in for. */
type DemoOperator = Extract<Operator, { kind: "organizer" | "kiosk" }>;

/** Whoever is tapping the demo's Floor is standing in for the Organizer. */
const ORGANIZER: DemoOperator = { kind: "organizer", userId: "demo-organizer" };
/** A tap on the demo's Kiosk carries the Kiosk's own Operator kind, exactly
 * like a real one — so Undo attributes it correctly on every screen. */
const KIOSK: DemoOperator = { kind: "kiosk" };

export function DemoStage() {
  const { origin, now } = useBoardClock();
  const [log, setLog] = useState<DemoLog>(() =>
    demoLogOf(demoNightEvents(origin)),
  );
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<DemoScreen>("floor");
  const [running, setRunning] = useState(false);

  const loaded = useMemo(
    () => demoLoadedSession(DEMO_CONFIG, log),
    [log],
  );
  const view = useMemo(
    () => rotationViewFrom(loaded, undefined, now),
    [loaded, now],
  );
  const roster = useMemo(() => floorRosterFrom(loaded), [loaded]);

  /**
   * The demo's two funnel events (issue #524). Both are browser-side and
   * anonymous, because that is all they can be: there is no account here, no
   * row is written, and this route's import graph must stay clear of a
   * Supabase client.
   *
   * The guards deliberately survive `reset()` as well as a remount: somebody
   * who starts the night over has still watched the turnovers they watched,
   * and counting them twice would inflate the one number this release has.
   */
  useEffect(() => {
    // Guarded rather than trusting the empty dependency array: Strict Mode
    // double-invokes this in development, and the count of people who opened
    // the demo is the denominator for everything else in the funnel.
    if (demoOpenedFired) return;
    demoOpenedFired = true;
    // `trackWhenReady`, not `track`: this is the repo's only mount-time client
    // event, and a bare `track()` here lands before `<Analytics />` has set
    // itself up and is dropped without a word. Nothing is returned to clean
    // up with, on purpose — see `analytics-browser.ts`.
    trackWhenReady(DEMO_OPENED);
  }, []);

  /**
   * One more foursome walked on. Counted from the committed event rather than
   * from the tap, so a tap that no-ops (a Court that already turned over) or
   * one the rules refuse does not count as a turnover somebody watched.
   *
   * Undo does not decrement. They saw it happen.
   */
  const countTurnover = (): void => {
    if (demoFinishedFired) return;
    demoTurnovers += 1;
    if (demoTurnovers < DEMO_FINISHED_TURNOVERS) return;
    demoFinishedFired = true;
    trackWhenReady(DEMO_FINISHED);
  };

  /**
   * The demo night's adapter over the floor dispatcher: decide `command` as
   * `operator` over `state` (the board as last folded, unless "let it run"
   * passes the latest) and commit the outcome. An `error` outcome is shown
   * and nothing is appended; a `noop` — a double tap on a Court that already
   * turned over — clears the error and leaves the board alone, exactly as the
   * live path treats it. Returns whether the tap was accepted, for the forms
   * that clear themselves on success.
   */
  const sendAs = (
    operator: DemoOperator,
    command: FloorCommand,
    state = loaded.state,
  ): { ok?: boolean } => {
    const outcome = dispatchFloorCommand(
      state,
      operator.kind,
      command,
      mintFloorIds(),
    );
    if (outcome.kind === "error") {
      setError(outcome.error);
      return { ok: false };
    }
    setError(null);
    if (outcome.kind === "noop") return { ok: true };

    // A wrap-up (`wrapUp`) appends as it stands: there is no RPC to go through.
    const at = Date.now();
    setLog((prev) => appendToDemoLog(prev, outcome.body, operator, at));
    // Every path that calls a new foursome onto a Court comes through here —
    // a tap on the Floor, a tap on the Kiosk, and "let it run" alike.
    if (outcome.body.type === "COURT_FINISHED") countTurnover();
    return { ok: true };
  };

  /** Undo means the same thing it does in the database: drop the last event
   * and fold again, unless somebody — or "let it run" — got there first. */
  const undo = (expectedSeq: number): void => {
    const undone = undoInDemoLog(log, expectedSeq);
    if (!undone) {
      setError("The board moved on. Take another look.");
      return;
    }
    setError(null);
    setLog(undone);
  };

  const floorOps: FloorBoardOps = {
    send: async (command) => sendAs(ORGANIZER, command),
    undo,
  };

  const kioskOps: KioskBoardOps = {
    send: async (command) => sendAs(KIOSK, command),
    undo,
  };

  /**
   * "Let it run": every `LET_IT_RUN_INTERVAL_MS`, finish whichever occupied
   * Court has been going longest — the one a real Organizer would notice
   * next. Reads through refs rather than closing over `view`/`loaded` so the
   * interval never has to be torn down and rebuilt on every turnover, and
   * keeps ticking even on a turn a tap happens to no-op.
   */
  const loadedRef = useRef(loaded);
  const viewRef = useRef(view);
  useEffect(() => {
    loadedRef.current = loaded;
    viewRef.current = view;
  });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const currentView = viewRef.current;
      if (currentView.status !== "open") return;
      const occupied = currentView.courts.filter((c) => c.players.length > 0);
      if (occupied.length === 0) return;
      const oldest = occupied.reduce((longest, court) =>
        (court.since ?? Number.POSITIVE_INFINITY) <
        (longest.since ?? Number.POSITIVE_INFINITY)
          ? court
          : longest,
      );
      sendAs(
        ORGANIZER,
        { kind: "finishCourt", court: oldest.number, since: oldest.since },
        loadedRef.current.state,
      );
    }, LET_IT_RUN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running]);

  const reset = (): void => {
    setRunning(false);
    setError(null);
    setLog(demoLogOf(demoNightEvents(Date.now())));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Demo screen"
          className="flex flex-wrap gap-2"
        >
          {SCREENS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={screen === id}
              data-testid={`demo-screen-${id}`}
              className={
                screen === id ? "od-key od-key--go" : "od-key od-key--ghost"
              }
              onClick={() => setScreen(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={running ? "od-key od-key--go" : "od-key od-key--ghost"}
            data-testid="demo-let-it-run"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? "Stop" : "Let it run"}
          </button>
          <button
            type="button"
            className="od-key od-key--ghost"
            data-testid="demo-reset"
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </div>

      {screen === "floor" && (
        <FloorBoard
          view={view}
          roster={roster}
          // There is no Club to join, so there is no code to hold up.
          joinQr={null}
          auth={{ kind: "organizer" }}
          error={error}
          pending={FLOOR_NOTHING_PENDING}
          now={now}
          ops={floorOps}
        />
      )}

      {screen === "display" && (
        <DisplayBoard view={view} joinQr={null} now={now} />
      )}

      {screen === "kiosk" && (
        <KioskBoard
          view={view}
          error={error}
          pending={KIOSK_NOTHING_PENDING}
          now={now}
          ops={kioskOps}
        />
      )}
    </div>
  );
}
