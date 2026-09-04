"use client";

import { useState } from "react";

import { useMatch } from "@/components/apps/pickle-point-pal/hooks/use-match";
import { useRefFlipped } from "@/components/apps/pickle-point-pal/hooks/use-ref-flipped";
import { useScrollToTopOnChange } from "@/components/apps/pickle-point-pal/hooks/use-scroll-to-top-on-change";
import { useWakeLock } from "@/components/apps/pickle-point-pal/hooks/use-wake-lock";
import { leftTeam, teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchConfig, type MatchEvent } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import { ActionBar, Sheet } from "./action-bar";
import { CoinFlip } from "./coin-flip";
import { SwapIcon } from "./pp-icons";
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
  const [refFlipped, toggleRefFlipped] = useRefFlipped();
  // The reducer flags the switch once per game and never un-flags it, so the
  // prompt needs its own sense of "still relevant." It's pinned to the point
  // total at the moment the switch fired; once another rally is scored the
  // players have had their dead-ball window to move, so it clears on its own.
  // A tap still clears it immediately for a ref who wants it gone sooner —
  // which is why dismissal is a flag on the capture rather than clearing it
  // back to null. `switched` stays true for the rest of the game, so a null
  // here would be re-armed by the guard below on the very next render.
  const [switchTrigger, setSwitchTrigger] = useState<{
    game: number;
    total: number;
    dismissed: boolean;
  } | null>(null);

  useWakeLock(!state.matchComplete);

  const hasPrematch = match.events.some((e) => e.type === "PREMATCH");
  useScrollToTopOnChange(
    !hasPrematch ? "coinflip" : state.matchComplete ? "summary" : "active"
  );

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
  const totalPoints = state.current.scores.A + state.current.scores.B;
  const switched = state.current.sidesSwitched;
  // Recomputed every render, so the landscape layout follows the teams round
  // the net the moment a game is confirmed or the mid-game switch fires.
  const left = leftTeam(state, refFlipped);
  const servingOnLeft = state.current.serving === left;

  // Derived during render rather than an effect: adjust `switchTrigger` the
  // instant it's out of sync with the current game/switch status.
  if (switched && switchTrigger?.game !== gameNumber) {
    setSwitchTrigger({ game: gameNumber, total: totalPoints, dismissed: false });
  } else if (!switched && switchTrigger !== null && switchTrigger.game === gameNumber) {
    setSwitchTrigger(null);
  }

  const showSwitchPrompt =
    switchTrigger !== null &&
    switchTrigger.game === gameNumber &&
    !switchTrigger.dismissed &&
    totalPoints <= switchTrigger.total;

  return (
    // `max-w-xl` is dropped in the ref layout: a ref standing at the net wants
    // the two point keys pinned to the far left and right edges of the device.
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 ref-landscape:max-w-none">
      {/* The fold — one machined panel: status strip, readout, court, and the
          two rally keys cradled in a single anodized chassis. It sizes to its
          content; the control shelf follows directly below. */}
      <div className="pp-frame flex flex-col gap-3 p-2.5 ref-landscape:h-[calc(100dvh-4.75rem)] ref-landscape:min-h-80 ref-landscape:gap-2">
        {/* Portrait stacks; the ref layout becomes left team · panel · right
            team. The centre column is the widest so the readout and court
            stay the thing you read, with the keys as thumb rails. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 ref-landscape:grid ref-landscape:grid-cols-[minmax(6rem,1fr)_minmax(0,2.6fr)_minmax(6rem,1fr)] ref-landscape:gap-2">
          <div className="flex min-h-0 flex-col gap-3 ref-landscape:col-start-2 ref-landscape:row-start-1 ref-landscape:justify-center ref-landscape:gap-2">
            <ScoreCall state={state} servingOnLeft={servingOnLeft} />

            {showSwitchPrompt && (
              <button
                type="button"
                onClick={() =>
                  setSwitchTrigger((t) => t && { ...t, dismissed: true })
                }
                className="pp-well px-4 py-3 text-left ref-landscape:px-3 ref-landscape:py-2"
              >
                <span className="pp-mark pp-mark--structural mb-1.5">
                  <SwapIcon className="size-3.5" />
                  Switch ends
                </span>
                <span className="block text-sm font-semibold text-pp-ink">
                  {config.switchAtScore} reached. Tap once players have changed sides.
                </span>
                <span className="mt-0.5 block text-xs text-pp-ink-dim">
                  The keys and court have already swapped to match.
                </span>
              </button>
            )}

            <CourtDiagram state={state} leftTeam={left} />
          </div>

          <RallyButtons
            state={state}
            leftTeam={left}
            disabled={state.activeTimeout !== null || state.current.complete}
            onRallyWon={match.rallyWon}
          />
        </div>
      </div>

      <ActionBar
        state={state}
        leftTeam={left}
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
        <p className="pp-legend text-center">
          Technical warnings ·{" "}
          {TEAM_IDS.map(
            (t) => `${teamName(config, t).split(" / ")[0]}: ${state.warnings[t]}`
          ).join(" · ")}
        </p>
      )}

      <div className="flex items-center gap-3 ref-landscape:justify-center">
        <button
          type="button"
          onClick={toggleRefFlipped}
          aria-label={`Swap sides — ${teamName(config, left)} is currently on your left`}
          className="pp-key pp-key--quiet min-h-11! flex-row gap-1.5 px-3 text-xs"
        >
          <SwapIcon className="size-3.5" />
          <span className="pp-legend">Swap sides</span>
        </button>

        {/* Last in the flow so it isn't next to the rally keys — outlined red,
            spottable without shouting; the red fill is on the sheet's confirm. */}
        <button
          type="button"
          onClick={() => setEndMatchOpen(true)}
          className="pp-key pp-key--danger min-h-11! flex-1 flex-row px-3 text-xs ref-landscape:flex-none ref-landscape:px-6"
        >
          <span className="pp-legend">End match</span>
        </button>
      </div>

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
          <p className="text-sm text-pp-ink-dim">
            This ends the match now, before it&apos;s reached a normal finish.
            The score so far stays in the log and shows on the summary screen —
            this can still be undone afterward if it was a mistake.
          </p>
          <button
            type="button"
            onClick={() => {
              match.endMatch();
              setEndMatchOpen(false);
            }}
            className="pp-key pp-key--alert min-h-14"
          >
            <span className="pp-plate text-base">End match now</span>
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
