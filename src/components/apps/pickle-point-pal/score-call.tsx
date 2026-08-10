"use client";

import {
  receivingPlayer,
  scoreCallParts,
  serverCourt,
  servingPlayer,
  teamName,
} from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import type { MatchState } from "@/components/apps/pickle-point-pal/lib/scoring/types";

/**
 * The hero of the screen: serving score, receiving score, server number — in
 * that order, because that's the order it's spoken. A ref glances at this
 * between rallies in direct sunlight, so it is deliberately enormous and the
 * one memorable piece of typography in the app.
 */
export function ScoreCall({ state }: { state: MatchState }) {
  const { serving, receiving, serverNumber } = scoreCallParts(state);
  const court = serverCourt(state);

  return (
    <section className="text-center">
      <p className="font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase ref-landscape:hidden">
        Score call
      </p>
      {/* Portrait scales off the viewport width; the ref layout scales off its
          height instead, because sideways the centre column is only a third of
          a wide screen and height is what actually runs out. */}
      <div
        className="mt-1 font-mono text-[clamp(3.5rem,20vw,8rem)] leading-[0.9] font-bold tracking-tight text-neutral-950 tabular-nums ref-landscape:mt-0 ref-landscape:text-[clamp(2.5rem,14vh,6rem)]"
        aria-label={`Score ${serving} ${receiving}${
          serverNumber === null ? "" : ` server ${serverNumber}`
        }`}
      >
        {serving}
        <Dash />
        {receiving}
        {serverNumber !== null && (
          <>
            <Dash />
            {serverNumber}
          </>
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-neutral-700 ref-landscape:mt-1">
        <span className="text-brand-orange">●</span>{" "}
        {teamName(state.config, state.current.serving)} serving
      </p>
      <p className="text-sm text-neutral-500">
        {servingPlayer(state)} from the{" "}
        {court === "even" ? "right (even)" : "left (odd)"} court, to{" "}
        {receivingPlayer(state)}
      </p>
    </section>
  );
}

function Dash() {
  return <span className="mx-[0.06em] text-neutral-300">-</span>;
}
