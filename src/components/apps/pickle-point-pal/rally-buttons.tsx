"use client";

import { cn } from "@/lib/utils";
import { teamNameLines } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchState, type TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

/**
 * The two primary targets: one per team, labelled with the players' names and a
 * screen-printed legend for what the tap does. Tall, well separated — and
 * nothing destructive sits within a thumb's slip of them. Side by side, on
 * whichever side of the screen that team's court is drawn on, so "which button
 * did I just hit" matches "which side just won" without any mental remapping.
 *
 * The serving team's key is armed: an orange bar across its top edge, the same
 * serve signal that runs down the readout panel's edge.
 *
 * In the ref layout the wrapper goes `display: contents` so the two buttons
 * become direct children of the match screen's three-column grid and can take
 * the outer edges themselves. `order` rather than DOM order, so the DOM stays
 * fixed A-then-B while which side each button renders on moves with `leftTeam`.
 */
export function RallyButtons({
  state,
  leftTeam,
  disabled,
  onRallyWon,
}: {
  state: MatchState;
  leftTeam: TeamId;
  disabled: boolean;
  onRallyWon: (team: TeamId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 ref-landscape:contents">
      {TEAM_IDS.map((team) => {
        const isServing = state.current.serving === team;
        const isSecondServe =
          !isServing &&
          state.config.doubles &&
          state.config.scoring === "sideout" &&
          state.current.serverNumber === 1;
        const hintAction = isServing
          ? "point"
          : isSecondServe
            ? "second serve"
            : "side out";
        return (
          <button
            key={team}
            type="button"
            disabled={disabled}
            onClick={() => onRallyWon(team)}
            className={cn(
              "pp-key min-h-24 w-full",
              "ref-landscape:row-start-1 ref-landscape:h-full ref-landscape:px-2",
              team === leftTeam
                ? "order-1 ref-landscape:col-start-1"
                : "order-2 ref-landscape:col-start-3",
              isServing && "pp-key--armed"
            )}
          >
            {/* One line per player rather than "Alexandra / Bartholomew" run
                together — a doubles pair of long names wraps mid-word on the
                narrow ref-layout buttons otherwise. */}
            <span className="flex flex-col items-center leading-[1.05]">
              {teamNameLines(state.config, team).map((name) => (
                <span
                  key={name}
                  className="pp-plate wrap-break-word text-[1.15rem] text-pp-ink"
                >
                  {name}
                </span>
              ))}
            </span>
            <span className="mt-1 flex flex-col items-center gap-0.5 ref-landscape:mt-2">
              <span className="text-[0.5625rem] tracking-[0.14em] text-pp-ink-dim uppercase">
                wins rally
              </span>
              <span
                className={cn(
                  "pp-plate text-[0.9375rem] tracking-[0.06em]",
                  isServing ? "text-pp-signal" : "text-pp-ink"
                )}
              >
                {hintAction}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
