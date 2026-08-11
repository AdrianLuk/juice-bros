"use client";

import { cn } from "@/lib/utils";
import { teamNameLines } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchState, type TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

/**
 * The two primary targets: one per team, labelled with the players' names
 * rather than "Point A". Full-width, tall, well separated — and nothing
 * destructive sits within a thumb's slip of them.
 *
 * In the ref layout the wrapper goes `display: contents` so the two buttons
 * become direct children of the match screen's three-column grid and can take
 * the outer edges themselves, each on the side of the net its team is actually
 * standing on. Grid placement rather than DOM order, so the portrait stack
 * keeps its fixed A-then-B reading while the landscape columns move.
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
              "disabled:pointer-events-none disabled:opacity-40",
              "ref-landscape:row-start-1 ref-landscape:h-full ref-landscape:px-2",
              team === leftTeam
                ? "ref-landscape:col-start-1"
                : "ref-landscape:col-start-3",
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
              <span className="font-mono text-[0.65rem] tracking-widest text-neutral-500 uppercase ref-landscape:hidden">
                wins rally · {hintAction}
              </span>
              <span className="hidden font-mono text-xs font-semibold tracking-wide text-brand-black uppercase ref-landscape:block">
                wins rally
              </span>
              <span className="hidden font-mono text-xs font-semibold tracking-wide text-brand-orange uppercase ref-landscape:block">
                {hintAction}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
