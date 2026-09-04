"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { handleRadioKeyDown } from "@/components/apps/pickle-point-pal/lib/radio-keyboard";
import {
  BEST_OF_OPTIONS,
  buildConfig,
  DEFAULT_OPTIONS,
  describeConfig,
  POINTS_OPTIONS,
  WIN_BY_OPTIONS,
  type BestOf,
  type MatchOptions,
  type PointsToWin,
  type WinBy,
} from "@/components/apps/pickle-point-pal/lib/scoring/formats";
import type { MatchConfig, PlayerPair, TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

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
    <div className="mx-auto w-full max-w-md ref-landscape:max-w-4xl">
      <h1 className="pp-plate text-2xl text-pp-ink ref-landscape:text-lg">New match</h1>
      {/* Cut in the ref layout — the one line here that's explanation rather
          than a control, and height is what's scarce sideways. */}
      <p className="mt-1.5 text-sm text-pp-ink-dim ref-landscape:hidden">
        Set the rules, then name the players. Names show on the rally keys and
        the court diagram. Turn your phone sideways once play starts; scoring is
        easier in landscape.
      </p>

      {/* Rules and names run in their own scrolling column side by side in the
          ref layout instead of one long stack. */}
      <div className="mt-6 ref-landscape:mt-3 ref-landscape:grid ref-landscape:grid-cols-2 ref-landscape:items-start ref-landscape:gap-x-6">
        <div className="pp-well grid gap-4 p-4 ref-landscape:gap-4">
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
            onChange={(value) => set("scoring", value)}
          />
          {options.scoring === "rally" && (
            <>
              <div>
                <Toggle
                  label="Win by"
                  value={options.winBy ?? 1}
                  options={WIN_BY_OPTIONS.map((winBy) => ({
                    id: winBy as WinBy,
                    label: winBy === 1 ? "1 (flat)" : "2 (deuce)",
                  }))}
                  onChange={(value) => set("winBy", value)}
                />
                <p className="mt-1.5 text-xs text-pp-ink-dim ref-landscape:hidden">
                  1: the game ends the moment someone hits the target. 2: play
                  continues past it until a team leads by two — the USAP margin.
                </p>
              </div>
              <div>
                <Toggle
                  label="Freeze"
                  value={options.freezeRule ?? true}
                  options={[
                    { id: false, label: "Off" },
                    { id: true, label: "On" },
                  ]}
                  onChange={(value) => set("freezeRule", value)}
                />
                <p className="mt-1.5 text-xs text-pp-ink-dim ref-landscape:hidden">
                  On: a team can only win the game on its own serve — reaching
                  game point while receiving holds the score until they do. USAP
                  dropped this for 2026; set it Off for a sanctioned event.
                </p>
              </div>
            </>
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

          <p className="pp-data rounded-(--pp-radius) bg-white px-3 py-2 text-center text-xs font-medium text-pp-ink">
            {describeConfig(buildConfig(options, { A: [""], B: [""] }))}
          </p>
        </div>

        <div className="mt-6 grid gap-4 ref-landscape:mt-0 ref-landscape:gap-4">
          {(["A", "B"] as const).map((team) => (
            <fieldset key={team} className="pp-well p-4">
              <legend className="pp-legend px-1">Team {team}</legend>
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
                <div className="mt-4">
                  <p className="pp-legend text-[0.625rem]">First server</p>
                  <RadioRow
                    ariaLabel={`Team ${team} first server`}
                    count={2}
                    selectedIndex={firstServer[team]}
                    onSelect={(i) => setTeamFirstServer(team, i as PlayerIndex)}
                    options={([0, 1] as const).map((index) => ({
                      key: String(index),
                      label: names[team][index].trim() || `Player ${index + 1}`,
                    }))}
                  />
                </div>
              )}
            </fieldset>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        className="pp-key pp-key--primary mx-auto mt-8 block min-h-14 w-full ref-landscape:mt-4 ref-landscape:w-auto ref-landscape:px-10"
      >
        <span className="pp-plate text-base">Continue to coin toss</span>
      </button>
    </div>
  );
}

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
      <p className="pp-legend">{label}</p>
      <RadioRow
        ariaLabel={label}
        count={options.length}
        selectedIndex={options.findIndex((o) => o.id === value)}
        onSelect={(i) => onChange(options[i].id)}
        options={options.map((o) => ({ key: String(o.id), label: o.label }))}
      />
    </div>
  );
}

/**
 * A segmented control: a strip of milled keys, the selected one armed orange.
 * Shared by every rule toggle and the first-server pickers.
 */
function RadioRow({
  ariaLabel,
  count,
  selectedIndex,
  onSelect,
  options,
}: {
  ariaLabel: string;
  count: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "mt-2 grid gap-1 rounded-(--pp-radius-key) border border-pp-hairline bg-white p-1",
        count >= 3 ? "grid-cols-3" : "grid-cols-2"
      )}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        const isTabStop = selected || (selectedIndex < 0 && index === 0);
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={isTabStop ? 0 : -1}
            onKeyDown={(e) => handleRadioKeyDown(e, count, index, onSelect)}
            onClick={() => onSelect(index)}
            className={cn(
              "min-h-12 truncate rounded-md px-2 text-sm font-semibold ref-landscape:min-h-9 ref-landscape:text-xs",
              selected
                ? "bg-pp-frame text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.14)]"
                : "text-pp-ink-dim hover:bg-pp-panel-sink"
            )}
            style={{ touchAction: "manipulation" }}
          >
            {option.label}
          </button>
        );
      })}
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
        className="w-full rounded-(--pp-radius) border border-pp-hairline bg-white px-3 py-3 text-base text-pp-ink outline-none placeholder:text-pp-ink-dim focus:border-pp-signal ref-landscape:py-2"
      />
    </label>
  );
}
