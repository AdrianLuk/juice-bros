import type { SessionConfig, SessionEvent, SessionState } from "./types.ts";

/**
 * The pure fold. Takes the whole event array — not one event at a time —
 * because that is what makes replay (and therefore undo) trivial: undo is
 * dropping the last event and re-folding, never a compensating action.
 *
 * `reduceSession` must NEVER call `Date.now()`. It reads `at` off each event.
 * Whether anything has *elapsed* since is a question for the render layer,
 * which has a ticking clock. The moment this function reads the wall clock,
 * `reduceSession(config, events)` stops being reproducible and the
 * undo-parity guarantee goes with it.
 *
 * Selection tie-breaks (arriving in later tickets) derive from
 * `config.seed`, never from `Math.random()`, for the same reason.
 */
export function reduceSession(
  config: SessionConfig,
  events: SessionEvent[],
): SessionState {
  const state: SessionState = {
    config,
    startedAt: null,
    startedBy: null,
    status: "pending",
  };

  for (const event of events) {
    switch (event.type) {
      case "SESSION_STARTED": {
        // The log should only ever carry one, but a replayed duplicate must
        // not move the start time or reassign the Operator.
        if (state.status !== "pending") break;
        state.startedAt = event.at;
        state.startedBy = event.operator;
        state.status = "open";
        break;
      }
    }
  }

  return state;
}
