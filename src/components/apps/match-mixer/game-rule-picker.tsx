"use client";

import { useId } from "react";

import { TARGETS, type GameRule, type Target, type WinBy } from "@/components/apps/match-mixer/lib/live/game-rule";

const TARGET_LABELS: Record<`${Target}`, string> = {
  "11": "To 11",
  "15": "To 15",
  "21": "To 21",
  timed: "Timed",
};

/**
 * The Game Rule as two rows of radio plates (#688): what a Game is played to,
 * then the margin. Timed has no margin to pick, so the second row goes quiet
 * under it but keeps its choice for when the night goes back to points.
 */
export function GameRulePicker({
  value,
  onChange,
  disabled = false,
  note,
}: {
  value: GameRule;
  onChange: (rule: GameRule) => void;
  disabled?: boolean;
  note?: string;
}) {
  const name = useId();
  const timed = value.to === "timed";

  return (
    <fieldset className="mm-formats mm-rule" disabled={disabled} aria-describedby={note ? `${name}-note` : undefined}>
      <legend className="mm-legend">Game Rule</legend>
      <div className="mm-rule-row">
        {TARGETS.map((to) => (
          <label key={to} className="mm-format" data-on={value.to === to ? "true" : undefined}>
            <input
              type="radio"
              name={`${name}-to`}
              checked={value.to === to}
              onChange={() => onChange({ ...value, to })}
            />
            <span className="mm-format-name">{TARGET_LABELS[`${to}`]}</span>
          </label>
        ))}
      </div>
      <div className="mm-rule-row mt-1" data-quiet={timed ? "true" : undefined}>
        {([2, 1] as const satisfies readonly WinBy[]).map((winBy) => (
          <label key={winBy} className="mm-format" data-on={!timed && value.winBy === winBy ? "true" : undefined}>
            <input
              type="radio"
              name={`${name}-by`}
              checked={value.winBy === winBy}
              disabled={timed}
              onChange={() => onChange({ ...value, winBy })}
            />
            <span className="mm-format-name">Win by {winBy}</span>
          </label>
        ))}
      </div>
      {note ? (
        <p className="mm-note mt-2" id={`${name}-note`}>
          {note}
        </p>
      ) : null}
    </fieldset>
  );
}
