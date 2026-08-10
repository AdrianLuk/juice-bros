"use client";

import { useState } from "react";

import { useMatch } from "@/components/apps/pickle-point-pal/hooks/use-match";
import { useWakeLock } from "@/components/apps/pickle-point-pal/hooks/use-wake-lock";
import { teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchConfig, type MatchEvent } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import { ActionBar, Sheet } from "./action-bar";
import { CoinFlip } from "./coin-flip";
import { CourtDiagram } from "./court-diagram";
import { GameOverSheet } from "./game-over-sheet";
import { MatchSummary } from "./match-summary";
import { RallyButtons } from "./rally-buttons";
import { ScoreCall } from "./score-call";
import { MatchLog } from "./match-log";
import { TimeoutOverlay } from "./timeout-overlay";

export function MatchScreen({
  config,
  initialEvents,
  onNewMatch,
}: {
  config: MatchConfig;
  initialEvents: MatchEvent[];
  onNewMatch: () => void;
}) {
  const match = useMatch(config, initialEvents);
  const { state } = match;

  const [logOpen, setLogOpen] = useState(false);
  const [endMatchOpen, setEndMatchOpen] = useState(false);
  // The reducer flags the switch once per game; this tracks the acknowledgement
  // so the prompt doesn't come back after it's been dismissed.
  const [switchAckGame, setSwitchAckGame] = useState<number | null>(null);

  useWakeLock(!state.matchComplete);

  const hasPrematch = match.events.some((e) => e.type === "PREMATCH");

  if (!hasPrematch) {
    return <CoinFlip config={config} onDecided={match.prematch} />;
  }

  if (state.matchComplete) {
    return (
      <MatchSummary
        state={state}
        events={match.events}
        matchStartedAt={match.matchStartedAt}
        onNewMatch={onNewMatch}
        onUndo={match.undo}
      />
    );
  }

  const gameNumber = state.games.length;
  const showSwitchPrompt =
    state.current.sidesSwitched && switchAckGame !== gameNumber;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 text-xs text-neutral-500">
        <span className="font-mono tracking-widest uppercase">
          Game {gameNumber} of {config.bestOf}
        </span>
        <span className="font-mono tabular-nums">
          {TEAM_IDS.map((t) => state.gamesWon[t]).join("-")} games
        </span>
      </header>

      <ScoreCall state={state} />

      {showSwitchPrompt && (
        <button
          type="button"
          onClick={() => setSwitchAckGame(gameNumber)}
          className="rounded-xl border-2 border-brand-orange bg-brand-orange/10 px-4 py-3 text-left touch-manipulation"
        >
          <span className="block text-sm font-semibold text-neutral-950">
            Switch ends — {config.switchAtScore} reached
          </span>
          <span className="mt-0.5 block text-xs text-neutral-600">
            Tap once the players have changed sides.
          </span>
        </button>
      )}

      <CourtDiagram state={state} />

      <RallyButtons
        state={state}
        disabled={state.activeTimeout !== null || state.current.complete}
        onRallyWon={match.rallyWon}
      />

      <ActionBar
        state={state}
        canUndo={match.canUndo}
        canRedo={match.canRedo}
        onUndo={match.undo}
        onRedo={match.redo}
        onStartTimeout={match.startTimeout}
        onTechnicalFoul={match.technicalFoul}
        onTechnicalWarning={match.technicalWarning}
        onOpenLog={() => setLogOpen(true)}
      />

      {state.warnings.A + state.warnings.B > 0 && (
        <p className="text-center text-xs text-neutral-500">
          Technical warnings ·{" "}
          {TEAM_IDS.map(
            (t) => `${teamName(config, t)}: ${state.warnings[t]}`
          ).join(" · ")}
        </p>
      )}

      {/* Last in the flow so it isn't next to the rally buttons, but red so
          a ref can still spot it fast when a match needs to end early. */}
      <button
        type="button"
        onClick={() => setEndMatchOpen(true)}
        className="min-h-11 rounded-lg bg-destructive px-3 text-xs font-medium text-white touch-manipulation hover:bg-destructive/80"
      >
        End match
      </button>

      {logOpen && (
        <Sheet title="Match log" onClose={() => setLogOpen(false)}>
          <MatchLog
            config={config}
            events={match.events}
            matchStartedAt={match.matchStartedAt}
          />
        </Sheet>
      )}

      {endMatchOpen && (
        <Sheet title="End match?" onClose={() => setEndMatchOpen(false)}>
          <p className="text-sm text-neutral-600">
            This ends the match now, before it&apos;s reached a normal
            finish. The score so far stays in the log and shows on the
            summary screen — this can still be undone afterward if it was a
            mistake.
          </p>
          <button
            type="button"
            onClick={() => {
              match.endMatch();
              setEndMatchOpen(false);
            }}
            className="min-h-14 rounded-xl bg-destructive text-sm font-semibold text-white touch-manipulation active:translate-y-px"
          >
            End match now
          </button>
        </Sheet>
      )}

      {state.activeTimeout && (
        <TimeoutOverlay
          state={state}
          remainingMs={match.remainingMs}
          onPauseClock={match.pauseTimeoutClock}
          onStartClock={match.startTimeoutClock}
          onEndTimeout={match.endTimeout}
          onUndo={match.undo}
        />
      )}

      {state.current.complete && !state.activeTimeout && (
        <GameOverSheet state={state} onConfirm={match.confirmGame} onUndo={match.undo} />
      )}
    </div>
  );
}
