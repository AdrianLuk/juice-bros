"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  BEST_OF_OPTIONS,
  buildConfig,
  DEFAULT_OPTIONS,
  describeConfig,
  POINTS_OPTIONS,
  type BestOf,
  type MatchOptions,
  type PointsToWin,
} from "@/components/apps/referee-scorekeeper/lib/scoring/formats";
import type { MatchConfig, PlayerPair, TeamId } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

type Names = Record<TeamId, [string, string]>;
type PlayerIndex = 0 | 1;

const EMPTY_NAMES: Names = { A: ["", ""], B: ["", ""] };
const DEFAULT_FIRST_SERVER: Record<TeamId, PlayerIndex> = { A: 0, B: 0 };

export function MatchSetup({ onStart }: { onStart: (config: MatchConfig) => void }) {
  const [options, setOptions] = useState<MatchOptions>(DEFAULT_OPTIONS);
  const [names, setNames] = useState<Names>(EMPTY_NAMES);
  // Which named player in each pair opens the team's serve, for every game
  // they serve first — independent of the order their names were typed in.
  const [firstServer, setFirstServer] = useState<Record<TeamId, PlayerIndex>>(
    DEFAULT_FIRST_SERVER
  );

  const set = <K extends keyof MatchOptions>(key: K, value: MatchOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const setName = (team: TeamId, index: PlayerIndex, value: string) =>
    setNames((prev) => {
      const next: [string, string] = [...prev[team]];
      next[index] = value;
      return { ...prev, [team]: next };
    });

  const setTeamFirstServer = (team: TeamId, index: PlayerIndex) =>
    setFirstServer((prev) => ({ ...prev, [team]: index }));

  const submit = () => {
    const pair = (team: TeamId): PlayerPair => {
      const first =
        names[team][0].trim() || `Team ${team}${options.doubles ? " 1" : ""}`;
      if (!options.doubles) return [first];
      const second = names[team][1].trim() || `Team ${team} 2`;
      // Position 0 is who the reducer starts serving — reorder so that lines
      // up with whichever player was picked, regardless of entry order.
      return firstServer[team] === 0 ? [first, second] : [second, first];
    };
    onStart(buildConfig(options, { A: pair("A"), B: pair("B") }));
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-heading text-2xl font-bold text-neutral-950">New match</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Set the rules, then name the players. Names show on the rally buttons
        and the court diagram.
      </p>

      <div className="mt-6 grid gap-4">
        <Toggle
          label="Players"
          value={options.doubles}
          options={[
            { id: true, label: "Doubles" },
            { id: false, label: "Singles" },
          ]}
          onChange={(value) => set("doubles", value)}
        />
        <Toggle
          label="Scoring"
          value={options.scoring}
          options={[
            { id: "sideout" as const, label: "Side-out" },
            { id: "rally" as const, label: "Rally" },
          ]}
          onChange={(value) =>
            // Freeze only means anything under rally scoring — drop it the
            // moment the ref switches away so it can't linger as hidden state.
            setOptions((prev) => ({
              ...prev,
              scoring: value,
              freezeRule: value === "rally" ? prev.freezeRule : false,
            }))
          }
        />
        {options.scoring === "rally" && (
          <div>
            <Toggle
              label="Freeze"
              value={options.freezeRule ?? false}
              options={[
                { id: false, label: "Off" },
                { id: true, label: "On" },
              ]}
              onChange={(value) => set("freezeRule", value)}
            />
            <p className="mt-1 text-xs text-neutral-500">
              On: a team can only win the game on its own serve — reaching
              game point while receiving holds the score until they do.
            </p>
          </div>
        )}
        <Toggle
          label="Points to win"
          value={options.pointsToWin}
          options={POINTS_OPTIONS.map((points) => ({
            id: points as PointsToWin,
            label: String(points),
          }))}
          onChange={(value) => set("pointsToWin", value)}
        />
        <Toggle
          label="Games"
          value={options.bestOf}
          options={BEST_OF_OPTIONS.map((bestOf) => ({
            id: bestOf as BestOf,
            label: bestOf === 1 ? "1 game" : `Best of ${bestOf}`,
          }))}
          onChange={(value) => set("bestOf", value)}
        />
      </div>

      <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-center text-xs font-medium text-neutral-700">
        {describeConfig(buildConfig(options, { A: [""], B: [""] }))}
      </p>

      <div className="mt-6 grid gap-4">
        {(["A", "B"] as const).map((team) => (
          <fieldset key={team}>
            <legend className="font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              Team {team}
            </legend>
            <div className="mt-2 grid gap-2">
              <NameInput
                label={
                  options.doubles
                    ? `Team ${team} player 1`
                    : `Team ${team} player`
                }
                value={names[team][0]}
                onChange={(v) => setName(team, 0, v)}
              />
              {options.doubles && (
                <NameInput
                  label={`Team ${team} player 2`}
                  value={names[team][1]}
                  onChange={(v) => setName(team, 1, v)}
                />
              )}
            </div>

            {options.doubles && (
              <div className="mt-2">
                <p className="font-mono text-[0.65rem] font-semibold tracking-[0.15em] text-neutral-500 uppercase">
                  First server
                </p>
                <div
                  role="radiogroup"
                  aria-label={`Team ${team} first server`}
                  className="mt-1 grid grid-cols-2 gap-1 rounded-lg border-2 border-neutral-200 bg-white p-1"
                >
                  {([0, 1] as const).map((index) => {
                    const label = names[team][index].trim() || `Player ${index + 1}`;
                    const selected = firstServer[team] === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTeamFirstServer(team, index)}
                        className={cn(
                          "min-h-11 truncate rounded-md px-2 text-xs font-semibold touch-manipulation",
                          selected
                            ? "bg-brand-orange text-white"
                            : "text-neutral-600 hover:bg-neutral-50"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </fieldset>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-8 min-h-14 w-full rounded-xl bg-neutral-950 text-base font-semibold text-white touch-manipulation active:translate-y-px"
      >
        Continue to coin toss
      </button>

      <p className="mt-4 text-center text-xs text-neutral-400">
        Rule specifics come from <code>formats.ts</code>. Confirm against the
        current USAP / Pickleball Canada rulebook before sanctioned play.
      </p>
    </div>
  );
}

// Tailwind needs the full class name in the source, so map rather than build it.
const COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
};

function Toggle<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          "mt-2 grid gap-1 rounded-xl border-2 border-neutral-200 bg-white p-1",
          COLUMNS[options.length] ?? "grid-cols-2"
        )}
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={String(option.id)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                "min-h-12 rounded-lg text-sm font-semibold touch-manipulation",
                selected
                  ? "bg-brand-orange text-white"
                  : "text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NameInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-brand-orange"
      />
    </label>
  );
}
