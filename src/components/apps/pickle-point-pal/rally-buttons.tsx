"use client";

import { cn } from "@/lib/utils";
import { teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchState, type TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

/**
 * The two primary targets: one per team, labelled with the players' names
 * rather than "Point A". Full-width, tall, well separated — and nothing
 * destructive sits within a thumb's slip of them.
 *
 * In the ref layout the wrapper goes `display: contents` so the two buttons
 * become direct children of the match screen's three-column grid and can take
 * the outer edges themselves — team A under the ref's left thumb, team B under
 * their right, matching the sides the teams occupy in the court diagram.
 */
export function RallyButtons({
  state,
  disabled,
  onRallyWon,
}: {
  state: MatchState;
  disabled: boolean;
  onRallyWon: (team: TeamId) => void;
}) {
  return (
    <div className="grid gap-3 ref-landscape:contents">
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
        const hint = isServing
          ? "wins rally · point"
          : isSecondServe
            ? "wins rally · second serve"
            : "wins rally · side out";
        return (
          <button
            key={team}
            type="button"
            disabled={disabled}
            onClick={() => onRallyWon(team)}
            className={cn(
              "flex min-h-20 w-full flex-col items-center justify-center rounded-xl border-2 px-4 py-4 transition-colors",
              "touch-manipulation select-none active:translate-y-px",
              "disabled:pointer-events-none disabled:opacity-40",
              "ref-landscape:row-start-1 ref-landscape:h-full ref-landscape:px-2",
              team === "A"
                ? "ref-landscape:col-start-1"
                : "ref-landscape:col-start-3",
              isServing
                ? "border-brand-orange bg-brand-orange/5"
                : "border-neutral-300 bg-white"
            )}
          >
            <span className="text-lg font-semibold wrap-break-word text-neutral-950">
              {teamName(state.config, team)}
            </span>
            <span className="mt-0.5 font-mono text-[0.65rem] tracking-widest text-neutral-500 uppercase">
              {hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
