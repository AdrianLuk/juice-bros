"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { otherTeam, TEAM_IDS, type MatchConfig, type TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

type WinnerChoice = "serve" | "receive" | "side";
type Draw = 1 | 2;

const WINNER_CHOICES: { id: WinnerChoice; label: string; hint: string }[] = [
  { id: "serve", label: "Serve", hint: "They serve first" },
  { id: "receive", label: "Receive", hint: "Their opponent serves first" },
  { id: "side", label: "Side", hint: "Their opponent picks serve or receive" },
];

/**
 * The 1-or-2 call happens between the two teams in real life — a team calls a
 * number, then the ref draws. The drawn number itself carries no meaning to
 * this app; it doesn't map to either team. What matters for scoring is who the
 * ref says won, recorded as its own explicit choice rather than derived from
 * the number.
 *
 * Picking "side" hands the serve/receive decision to the *opponent* — the
 * rulebook doesn't default it to either team, so this screen doesn't either.
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
      <h1 className="font-heading text-2xl font-bold text-neutral-950 ref-landscape:text-lg">
        Coin toss
      </h1>
      <p className="mt-1 text-sm text-neutral-500 ref-landscape:hidden">
        One team calls 1 or 2, then draw. Record who called it and who
        actually won the toss.
      </p>

      {/* The call, the draw, and the winner are three independent questions —
          side by side sideways instead of stacked, since nothing about
          answering one depends on the others having scrolled into view
          first. The draw sits in the middle because it's what's spoken
          between the other two in real play (call, then draw, then the
          winner is whoever the draw favoured). */}
      <div className="ref-landscape:grid ref-landscape:grid-cols-3 ref-landscape:items-start ref-landscape:gap-4">
        {/* The call comes before the draw in real life, so it comes first here. */}
        <div className="mt-6 ref-landscape:mt-3">
          <TeamToggle
            label="Who called it?"
            config={config}
            value={calledBy}
            onChange={setCalledBy}
          />
        </div>

        <div className="mt-6 ref-landscape:mt-3">
          {/* Matches the "Who called it?"/"Who won?" labels on the columns
              either side, so all three boxes start at the same height in the
              landscape row — without it the draw box, having no label of its
              own, sits noticeably higher than its neighbours. */}
          <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
            Draw
          </p>
          <div className="mt-2 flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-6 ref-landscape:mt-1 ref-landscape:min-h-0 ref-landscape:h-24 ref-landscape:py-2">
            {drawn === null ? (
              <p className="text-center text-sm text-neutral-500">
                Nothing drawn yet.
              </p>
            ) : (
              <span
                className="font-mono text-[clamp(4rem,22vw,7rem)] leading-none font-bold text-brand-orange tabular-nums ref-landscape:text-5xl"
                aria-live="polite"
              >
                {drawn}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={draw}
            className="mt-3 min-h-14 w-full rounded-xl bg-brand-orange text-base font-semibold text-white touch-manipulation active:translate-y-px ref-landscape:min-h-11"
          >
            {drawn === null ? "Draw a number" : "Draw again"}
          </button>
        </div>

        <div className="mt-6 ref-landscape:mt-3">
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
          <p className="mt-6 font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase ref-landscape:mt-3">
            Their choice
          </p>
          <div className="mt-2 grid gap-2 ref-landscape:grid-cols-3">
            {WINNER_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={winner === null}
                onClick={() => winner && pickWinnerChoice(choice.id, winner)}
                className="min-h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-left touch-manipulation disabled:opacity-40 ref-landscape:min-h-11"
              >
                <span className="block text-base font-semibold text-neutral-950">
                  {choice.label}
                </span>
                <span className="block text-xs text-neutral-500">
                  {choice.hint}
                </span>
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
        <p className="text-[0.7rem] font-bold tracking-[0.2em] text-neutral-950 uppercase">
          {teamName(config, opponent)}&apos;s choice
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-neutral-500 underline-offset-4 touch-manipulation hover:underline"
        >
          ‹ Back
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-950">
      <span className="font-bold">{teamName(config, winner)}</span> won the toss and <span className="font-bold">chose side</span>,{" "}
        <span className="font-bold">{teamName(config, opponent)}</span> will choose serve or receive.
      </p>
      <div className="mt-2 grid gap-2 ref-landscape:grid-cols-2">
        <button
          type="button"
          onClick={() => onDecided(winner, opponent)}
          className="min-h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-left touch-manipulation ref-landscape:min-h-11"
        >
          <span className="block text-base font-semibold text-neutral-950">
            Serve
          </span>
          <span className="block text-xs text-neutral-500">
            {teamName(config, opponent)} serves first
          </span>
        </button>
        <button
          type="button"
          onClick={() => onDecided(winner, winner)}
          className="min-h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-left touch-manipulation ref-landscape:min-h-11"
        >
          <span className="block text-base font-semibold text-neutral-950">
            Receive
          </span>
          <span className="block text-xs text-neutral-500">
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
      <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-label={label}
        // Stacked in the ref layout: "Who called it?" and "Who won?" each sit
        // in a narrow third of the row, where two team buttons side by side
        // get too cramped for a real team name to read — one above the other
        // gets the full column width instead. The gap that kept the
        // side-by-side pair visually separate becomes a hairline divider
        // instead, since a plain gap between two same-width white rows reads
        // as a rendering gap rather than a deliberate boundary. Pinned to the
        // same height as the draw box next to it (`grid-rows-2` splits that
        // height evenly between the two buttons — a plain two-row grid would
        // size each row to its content and only reach that height by luck).
        className="mt-2 grid grid-cols-2 gap-1 rounded-xl border-2 border-neutral-200 bg-white p-1 ref-landscape:mt-1 ref-landscape:h-24 ref-landscape:grid-cols-1 ref-landscape:grid-rows-2 ref-landscape:gap-0 ref-landscape:divide-y ref-landscape:divide-neutral-200"
      >
        {TEAM_IDS.map((team, index) => {
          const selected = team === value;
          return (
            <button
              key={team}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(team)}
              className={cn(
                "min-h-12 truncate rounded-lg px-2 text-sm font-semibold touch-manipulation ref-landscape:min-h-9 ref-landscape:text-xs",
                // In the ref layout the two buttons stack with no gap and
                // share a divide-y line — rounding both ends of each button
                // would bend that line around the corner where they touch,
                // making a straight divider read as curved.
                index === 0
                  ? "ref-landscape:rounded-b-none"
                  : "ref-landscape:rounded-t-none",
                selected
                  ? "bg-brand-orange text-white"
                  : "text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {teamName(config, team)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
