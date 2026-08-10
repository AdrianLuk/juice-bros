"use client";

import { cn } from "@/lib/utils";
import { serverCourt, servingPlayer } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import type { MatchState, TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

type Court = "even" | "odd";

/**
 * The four positions with the current server highlighted on their correct side.
 * A ref can see at a glance whether the players lined up wrong.
 *
 * Sides are drawn from each team's own perspective: "even/right" means the
 * player's right as they face the net, so team B's even court sits on the
 * screen's left and team A's on the screen's right.
 *
 * The ref layout turns the whole diagram a quarter turn clockwise so the net
 * runs vertically and each team takes the side of the screen its point button
 * is on — A left, B right. That rotation happens to leave both rows' slot
 * order untouched (a row's left-to-right becomes a column's top-to-bottom, and
 * the top/bottom teams swap to right/left), so it is purely a flex-direction
 * change with no reordering.
 */
export function CourtDiagram({ state }: { state: MatchState }) {
  const court = serverCourt(state);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border-2 border-neutral-300 bg-neutral-50 ref-landscape:min-h-0 ref-landscape:flex-1 ref-landscape:flex-row-reverse">
      <TeamRow state={state} team="B" order={["even", "odd"]} activeCourt={court} />
      <div
        className="h-1 shrink-0 bg-brand-black ref-landscape:h-auto ref-landscape:w-1"
        aria-hidden
      />
      <TeamRow state={state} team="A" order={["odd", "even"]} activeCourt={court} />
    </div>
  );
}

function TeamRow({
  state,
  team,
  order,
  activeCourt,
}: {
  state: MatchState;
  team: TeamId;
  order: [Court, Court];
  activeCourt: Court;
}) {
  const isServing = state.current.serving === team;
  const positions = state.current.positions[team];

  // In singles both players stand in the court matching the server's score
  // parity — the server on their own side of it, the receiver diagonally.
  const occupant = (slot: Court): string | undefined =>
    state.config.doubles
      ? slot === "even"
        ? positions[0]
        : positions[1]
      : slot === activeCourt
        ? positions[0]
        : undefined;

  return (
    <div className="grid grid-cols-2 ref-landscape:min-w-0 ref-landscape:flex-1 ref-landscape:grid-cols-1 ref-landscape:grid-rows-2">
      {order.map((slot) => {
        const name = occupant(slot);
        if (!name) {
          return (
            <div
              key={slot}
              className="min-h-16 border border-neutral-200 bg-neutral-100/60 ref-landscape:min-h-11"
            />
          );
        }
        const isServerCell =
          isServing && slot === activeCourt && name === servingPlayer(state);

        return (
          <div
            key={slot}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center border border-neutral-200 px-2 py-3 text-center",
              "ref-landscape:min-h-11 ref-landscape:py-1",
              isServerCell && "bg-brand-orange/10 ring-2 ring-brand-orange ring-inset"
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold text-neutral-800",
                isServerCell && "text-neutral-950"
              )}
            >
              {name}
            </span>
            <span className="mt-0.5 font-mono text-[0.6rem] tracking-widest text-neutral-400 uppercase">
              {isServerCell ? "serving" : slot === "even" ? "even / R" : "odd / L"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
