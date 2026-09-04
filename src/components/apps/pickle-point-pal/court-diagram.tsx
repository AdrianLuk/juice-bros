"use client";

import { cn } from "@/lib/utils";
import { serverCourt, servingPlayer } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import type { MatchState, TeamId } from "@/components/apps/pickle-point-pal/lib/scoring/types";

type Court = "even" | "odd";

/**
 * A plan view of the court, drawn as court lines — sidelines, the net down the
 * centre, a non-volley-zone line each side of it, a centreline splitting each
 * half into its two service courts — with the four players placed in the
 * quadrant each is standing in and the current server's quadrant ringed. A ref
 * can see at a glance whether the players lined up wrong.
 *
 * Sides are drawn from each team's own perspective: "even/right" is the
 * player's right as they face the net. `leftTeam` says which team the ref
 * currently has on their left; it moves when the teams change ends and when the
 * ref changes which side of the net they stand on. Both turn the plan view
 * 180°, which is the team order AND each team's two courts running the other
 * way — a pure flex-direction flip.
 */
export function CourtDiagram({
  state,
  leftTeam,
}: {
  state: MatchState;
  leftTeam: TeamId;
}) {
  const court = serverCourt(state);
  const mirrored = leftTeam !== "A";

  return (
    <div className="pp-well relative min-h-0 overflow-hidden ref-landscape:flex-1">
      {/* Court lines — drawn, not filled. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute inset-x-3 top-1/2 border-t border-pp-hairline" />
        <span className="absolute inset-y-3 left-[calc(50%-1.9rem)] border-l border-pp-hairline" />
        <span className="absolute inset-y-3 left-[calc(50%+1.9rem)] border-l border-pp-hairline" />
        <span
          className="absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(var(--pp-ink) 0 6px, transparent 6px 12px)",
          }}
        />
      </div>

      <div className={cn("relative flex", mirrored ? "flex-row" : "flex-row-reverse")}>
        <TeamHalf
          state={state}
          team="B"
          order={["even", "odd"]}
          activeCourt={court}
          mirrored={mirrored}
        />
        <TeamHalf
          state={state}
          team="A"
          order={["odd", "even"]}
          activeCourt={court}
          mirrored={mirrored}
        />
      </div>
    </div>
  );
}

function TeamHalf({
  state,
  team,
  order,
  activeCourt,
  mirrored,
}: {
  state: MatchState;
  team: TeamId;
  order: [Court, Court];
  activeCourt: Court;
  mirrored: boolean;
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
    <div className={cn("flex min-w-0 flex-1", mirrored ? "flex-col-reverse" : "flex-col")}>
      {order.map((slot) => {
        const name = occupant(slot);
        const isServerCell =
          isServing && slot === activeCourt && name === servingPlayer(state);

        return (
          <div
            key={slot}
            className={cn(
              "flex min-h-16 flex-1 flex-col items-center justify-center px-2 py-3 text-center ref-landscape:min-h-11 ref-landscape:py-1",
              isServerCell && "bg-pp-signal-wash ring-2 ring-inset ring-pp-signal"
            )}
          >
            {name ? (
              <>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isServerCell ? "text-pp-ink" : "text-pp-ink-dim"
                  )}
                >
                  {name}
                </span>
                <span
                  className={cn(
                    "mt-0.5 pp-legend text-[0.5625rem]",
                    isServerCell ? "text-pp-signal" : "text-pp-ink-dim"
                  )}
                >
                  {isServerCell ? "serving" : slot === "even" ? "even / R" : "odd / L"}
                </span>
              </>
            ) : (
              <span className="pp-legend text-[0.5625rem] text-pp-hairline">
                {slot === "even" ? "even / R" : "odd / L"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
