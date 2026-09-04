"use client";

import { cn } from "@/lib/utils";
import {
  receivingPlayer,
  scoreCallParts,
  serverCourt,
  servingPlayer,
  teamName,
} from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchState } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import { SegReadout } from "./seg-readout";

/**
 * The hero of the screen: the readout panel, seated in the instrument's dark
 * bezel with a screen-printed status strip across its top lip. Serving score,
 * receiving score, server number — in the order it's spoken, as one big plain
 * tabular numeral a ref reads in one glance in direct sun. The serving side
 * carries the one orange signal down the panel edge.
 */
export function ScoreCall({
  state,
  servingOnLeft,
}: {
  state: MatchState;
  servingOnLeft: boolean;
}) {
  const { config } = state;
  const { serving, receiving, serverNumber } = scoreCallParts(state);
  const court = serverCourt(state);
  const servingName = teamName(config, state.current.serving);
  const gameNumber = state.games.length;
  const bestOfSeries = config.bestOf > 1;
  const formatSpec = bestOfSeries
    ? `to ${config.pointsToWin}${config.winBy > 1 ? `, win by ${config.winBy}` : ""}`
    : config.winBy > 1
      ? `win by ${config.winBy}`
      : "single game";

  return (
    <section className="flex flex-col gap-1.5">
      {/* The etched status strip, printed straight onto the chassis. */}
      <div className="flex items-center justify-between gap-3 px-2 pt-0.5 pb-1">
        <span className="pp-legend pp-legend--onframe">
          {bestOfSeries ? `Game ${gameNumber} / ${config.bestOf}` : `Game to ${config.pointsToWin}`}
        </span>
        <span className="flex items-center gap-3">
          {bestOfSeries && (
            <span className="pp-data text-xs text-pp-legend">
              {TEAM_IDS.map((t, i) => (
                <span key={t}>
                  {i > 0 && "  "}
                  {teamName(config, t).split(" / ")[0]}{" "}
                  <span className="font-semibold text-white">{state.gamesWon[t]}</span>
                </span>
              ))}
            </span>
          )}
          <span className="pp-legend pp-legend--onframe">{formatSpec}</span>
        </span>
      </div>

      {/* The readout, inset into the chassis. */}
      <div className="pp-panel pp-panel-settle relative overflow-hidden px-6 py-5 ref-landscape:px-5 ref-landscape:py-3">
        <span
          aria-hidden
          className={cn(
            "pp-servebar absolute inset-y-0 w-2.5",
            servingOnLeft ? "left-0" : "right-0"
          )}
        />

        <div className={cn("flex justify-center", servingOnLeft ? "pl-2.5" : "pr-2.5")}>
          <SegReadout
            serving={serving}
            receiving={receiving}
            serverNumber={serverNumber}
            label={`Score ${serving} ${receiving}${serverNumber === null ? "" : ` server ${serverNumber}`}`}
            className="text-[clamp(3rem,17vw,6.5rem)] ref-landscape:text-[clamp(2.5rem,15vh,5rem)]"
          />
        </div>

        <p className="mt-3 flex items-center justify-center gap-2 pp-legend ref-landscape:mt-2">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: "var(--pp-signal)" }}
          />
          {servingName} serving{serverNumber !== null && ` · server ${serverNumber}`}
        </p>

        <p className="mt-1.5 text-center text-sm text-pp-ink-dim ref-landscape:mt-1 ref-landscape:text-xs">
          <span className="font-semibold text-pp-ink">{servingPlayer(state)}</span> from the{" "}
          <span className="font-semibold text-pp-ink">
            {court === "even" ? "right / even" : "left / odd"}
          </span>{" "}
          court, to <span className="font-semibold text-pp-ink">{receivingPlayer(state)}</span>
        </p>
      </div>
    </section>
  );
}
