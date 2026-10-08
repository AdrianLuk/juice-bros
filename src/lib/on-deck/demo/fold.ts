/**
 * Folding the demo night in the browser (issue #519).
 *
 * The live Floor loads a Session out of Postgres (`../sessions.ts`), folds it,
 * and commits a tap as a row; the demo does the same two things with the same
 * pure code and no database at all. This module is the join: it turns an event
 * array into the `LoadedSession` every board projection takes. A `floor-ops`
 * decision needs no turning back: its typed body is appended as it is, stamped
 * with `at` and an `operator`.
 *
 * Relative imports only, no `server-only`, no React — the demo route's whole
 * import graph has to stay clear of a Supabase client, and this is the piece
 * that would otherwise be tempted to reach for one.
 */

import { reduceSession } from "../session/reduce.ts";
import type { LoadedSession } from "../session/rotation-view.ts";
import type { SessionConfig, SessionEvent } from "../session/types.ts";

/**
 * Fold an authored log into the shape a board renders from. `lastEvent`'s
 * `seq` is the event's 1-based position, which is exactly what the database
 * column means — so operator Undo (#247) offers the same phrase here as on a
 * real night, and "undo" means the same thing: drop the last event, re-fold.
 */
export function demoLoadedSession(
  config: SessionConfig,
  events: SessionEvent[],
): LoadedSession {
  const state = reduceSession(config, events);
  const last = events[events.length - 1];
  return {
    config,
    status: state.status === "closed" ? "closed" : "open",
    state,
    events,
    lastEvent: last
      ? {
          seq: events.length,
          type: last.type,
          at: last.at,
          operator: last.operator,
        }
      : null,
  };
}
