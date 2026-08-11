"use client";

import { cn } from "@/lib/utils";
import { teamNameLines } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchState, type TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

/**
 * The two primary targets: one per team, labelled with the players' names
 * rather than "Point A". Tall, well separated — and nothing destructive sits
 * within a thumb's slip of them. Side by side, on whichever side of the
 * screen that team's court is drawn on, so "which button did I just hit"
 * matches "which side just won" without any mental remapping.
 *
 * In the ref layout the wrapper goes `display: contents` so the two buttons
 * become direct children of the match screen's three-column grid and can take
 * the outer edges themselves, each on the side of the net its team is actually
 * standing on. `order` rather than DOM order, so the DOM stays fixed A-then-B
 * while which side each button renders on moves with `leftTeam`.
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
        // In doubles side-out scoring, a receiving-team win only ends the
        // service turn outright once the second server is up. While the
        // first server is still up, winning the rally just hands the serve
        // to their partner — that's a second serve, not a side out.
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
              "flex min-h-20 w-full flex-col items-center justify-center rounded-xl border-2 px-4 py-4 transition-colors",
              "touch-manipulation select-none active:translate-y-px",
              "ref-landscape:row-start-1 ref-landscape:h-full ref-landscape:px-2",
              "disabled:pointer-events-none disabled:opacity-40",
              team === leftTeam
                ? "order-1 ref-landscape:col-start-1"
                : "order-2 ref-landscape:col-start-3",
              isServing
                ? "border-brand-orange bg-brand-orange/5"
                : "border-neutral-300 bg-white"
            )}
          >
            {/* One line per player rather than "Alexandra / Bartholomew" run
                together — a doubles pair of long names wraps mid-word on the
                narrow ref-layout buttons otherwise. */}
            <span className="flex flex-col items-center leading-tight">
              {teamNameLines(state.config, team).map((name) => (
                <span
                  key={name}
                  className="text-lg font-semibold wrap-break-word text-neutral-950"
                >
                  {name}
                </span>
              ))}
            </span>
            <span className="mt-1 flex flex-col items-center ref-landscape:mt-2">
              <span className="font-mono text-xs font-semibold tracking-wide text-brand-black uppercase">
                wins rally
              </span>
              <span className="font-mono text-xs font-semibold tracking-wide text-brand-orange uppercase">
                {hintAction}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
