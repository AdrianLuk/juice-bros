"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { handleRadioKeyDown } from "@/components/apps/pickle-point-pal/lib/radio-keyboard";
import { teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { otherTeam, TEAM_IDS, type MatchConfig, type TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import { SegDigit } from "./seg-readout";

type WinnerChoice = "serve" | "receive" | "side";
type Draw = 1 | 2;

const WINNER_CHOICES: { id: WinnerChoice; label: string; hint: string }[] = [
  { id: "serve", label: "Serve", hint: "They serve first" },
  { id: "receive", label: "Receive", hint: "Their opponent serves first" },
  { id: "side", label: "Side", hint: "Their opponent picks serve or receive" },
];

/**
 * The 1-or-2 call happens between the two teams in real life — a team calls a
 * number, then the ref draws. The drawn number carries no meaning to this app;
 * what matters for scoring is who the ref says won, recorded as its own
 * explicit choice. Picking "side" hands the serve/receive decision to the
 * *opponent* — the rulebook doesn't default it, so this screen doesn't either.
 */
export function CoinFlip({
  config,
  onDecided,
}: {
  config: MatchConfig;
  onDecided: (winner: TeamId, server: TeamId) => void;
}) {
  const [drawn, setDrawn] = useState<Draw | null>(null);
  const [calledBy, setCalledBy] = useState<TeamId | null>(null);
  const [winner, setWinner] = useState<TeamId | null>(null);
  const [gaveSideToOpponent, setGaveSideToOpponent] = useState(false);

  const draw = () => setDrawn(Math.random() < 0.5 ? 1 : 2);

  const selectWinner = (team: TeamId) => {
    setWinner(team);
    setGaveSideToOpponent(false);
  };

  const pickWinnerChoice = (choice: WinnerChoice, team: TeamId) => {
    if (choice === "serve") return onDecided(team, team);
    if (choice === "receive") return onDecided(team, otherTeam(team));
    setGaveSideToOpponent(true);
  };

  return (
    <div className="mx-auto w-full max-w-md ref-landscape:max-w-4xl">
      <h1 className="pp-plate text-2xl text-pp-ink ref-landscape:text-lg">Coin toss</h1>
      <p className="mt-1.5 text-sm text-pp-ink-dim ref-landscape:hidden">
        One team calls 1 or 2, then draw. Record who called it and who actually
        won the toss.
      </p>

      {/* The call, the draw, and the winner are three independent questions —
          side by side sideways instead of stacked. The draw sits in the middle
          because it's what's spoken between the other two in real play. */}
      <div className="mt-6 ref-landscape:mt-3 ref-landscape:grid ref-landscape:grid-cols-3 ref-landscape:items-start ref-landscape:gap-4">
        <div>
          <TeamToggle
            label="Who called it?"
            config={config}
            value={calledBy}
            onChange={setCalledBy}
          />
        </div>

        <div className="mt-6 ref-landscape:mt-0">
          <p className="pp-legend">Draw</p>
          <div className="pp-panel mt-2 flex min-h-40 flex-col items-center justify-center px-4 py-6 ref-landscape:mt-2 ref-landscape:min-h-0 ref-landscape:h-24 ref-landscape:py-2">
            {drawn === null ? (
              <p className="text-center text-sm text-pp-ink-dim">Nothing drawn yet.</p>
            ) : (
              <span
                className="text-[clamp(3.5rem,20vw,6rem)] leading-none ref-landscape:text-[clamp(2rem,13vh,3rem)]"
                aria-live="polite"
                aria-label={`Drew ${drawn}`}
              >
                <SegDigit digit={drawn} />
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={draw}
            className="pp-key pp-key--primary mt-3 min-h-14 w-full ref-landscape:min-h-11"
          >
            <span className="pp-plate text-base">
              {drawn === null ? "Draw a number" : "Draw again"}
            </span>
          </button>
        </div>

        <div className="mt-6 ref-landscape:mt-0">
          <TeamToggle
            label="Who won the toss?"
            config={config}
            value={winner}
            onChange={selectWinner}
          />
        </div>
      </div>

      {winner && gaveSideToOpponent ? (
        <OpponentChoice
          config={config}
          winner={winner}
          onBack={() => setGaveSideToOpponent(false)}
          onDecided={onDecided}
        />
      ) : (
        <>
          <p className="pp-legend mt-6 ref-landscape:mt-3">Their choice</p>
          <div className="mt-2 grid gap-2 ref-landscape:grid-cols-3">
            {WINNER_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={winner === null}
                onClick={() => winner && pickWinnerChoice(choice.id, winner)}
                className="pp-key items-start px-4 py-3 text-left disabled:opacity-40 ref-landscape:min-h-11"
              >
                <span className="pp-plate text-base text-pp-ink">{choice.label}</span>
                <span className="text-xs text-pp-ink-dim">{choice.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The toss winner gave up the side choice — the opponent decides serve or receive. */
function OpponentChoice({
  config,
  winner,
  onBack,
  onDecided,
}: {
  config: MatchConfig;
  winner: TeamId;
  onBack: () => void;
  onDecided: (winner: TeamId, server: TeamId) => void;
}) {
  const opponent = otherTeam(winner);

  return (
    <div className="mt-6 ref-landscape:mt-3">
      <div className="flex items-baseline justify-between">
        <p className="pp-legend text-pp-ink">{teamName(config, opponent)}&apos;s choice</p>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-pp-ink-dim underline-offset-4 hover:underline"
        >
          ‹ Back
        </button>
      </div>
      <p className="mt-1 text-xs text-pp-ink">
        <span className="font-bold">{teamName(config, winner)}</span> won the toss and{" "}
        <span className="font-bold">chose side</span>,{" "}
        <span className="font-bold">{teamName(config, opponent)}</span> will choose serve or
        receive.
      </p>
      <div className="mt-2 grid gap-2 ref-landscape:grid-cols-2">
        <button
          type="button"
          onClick={() => onDecided(winner, opponent)}
          className="pp-key items-start px-4 py-3 text-left ref-landscape:min-h-11"
        >
          <span className="pp-plate text-base text-pp-ink">Serve</span>
          <span className="text-xs text-pp-ink-dim">
            {teamName(config, opponent)} serves first
          </span>
        </button>
        <button
          type="button"
          onClick={() => onDecided(winner, winner)}
          className="pp-key items-start px-4 py-3 text-left ref-landscape:min-h-11"
        >
          <span className="pp-plate text-base text-pp-ink">Receive</span>
          <span className="text-xs text-pp-ink-dim">
            {teamName(config, winner)} serves first
          </span>
        </button>
      </div>
    </div>
  );
}

function TeamToggle({
  label,
  config,
  value,
  onChange,
}: {
  label: string;
  config: MatchConfig;
  value: TeamId | null;
  onChange: (team: TeamId) => void;
}) {
  return (
    <div>
      <p className="pp-legend">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="mt-2 grid grid-cols-2 gap-1 rounded-(--pp-radius-key) border border-pp-hairline bg-white p-1 ref-landscape:h-24 ref-landscape:grid-cols-1"
      >
        {TEAM_IDS.map((team, index) => {
          const selected = team === value;
          const isTabStop = selected || (value === null && index === 0);
          return (
            <button
              key={team}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={isTabStop ? 0 : -1}
              onKeyDown={(e) =>
                handleRadioKeyDown(e, TEAM_IDS.length, index, (i) => onChange(TEAM_IDS[i]))
              }
              onClick={() => onChange(team)}
              className={cn(
                "min-h-12 truncate rounded-md px-2 text-sm font-semibold ref-landscape:min-h-9 ref-landscape:text-xs",
                selected
                  ? "bg-pp-frame text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.14)]"
                  : "text-pp-ink-dim hover:bg-[var(--pp-panel-sink)]"
              )}
              style={{ touchAction: "manipulation" }}
            >
              {teamName(config, team)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
