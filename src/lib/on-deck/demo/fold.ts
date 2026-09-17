/**
 * Folding the demo night in the browser (issue #519).
 *
 * The live Floor loads a Session out of Postgres (`../sessions.ts`), folds it,
 * and commits a tap as a row; the demo does the same two things with the same
 * pure code and no database at all. This module is the join: it turns an event
 * array into the `LoadedSession` every board projection takes, and turns a
 * `floor-ops` decision back into the event to append.
 *
 * Relative imports only, no `server-only`, no React — the demo route's whole
 * import graph has to stay clear of a Supabase client, and this is the piece
 * that would otherwise be tempted to reach for one.
 */

import { reduceSession } from "../session/reduce.ts";
import { isPauseReason, isSkillLevel } from "../session/types.ts";
import type { LoadedSession } from "../session/rotation-view.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
} from "../session/types.ts";
import type { FloorOpOutcome } from "../floor-ops.ts";

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

/**
 * Turn a `floor-ops` decision into the event to append, or null when it cannot
 * become one. The live paths hand the same `{ type, payload }` to Postgres,
 * which reads it back through `sessions.ts`'s row parser; this is the browser's
 * half of that same trip.
 *
 * `FloorOpOutcome.payload` is a `Record<string, unknown>`, so every field has
 * to be narrowed on the way out. A field that is missing or the wrong type
 * returns null rather than a `0` or an empty string: an event carrying
 * `court: 0` would fold into a board nobody could explain, and a decision this
 * module has no case for must leave the board untouched, not quietly damage
 * it. Callers surface the null; nothing here throws.
 */
export function demoEventFor(
  outcome: FloorOpOutcome,
  at: number,
  operator: Operator,
): SessionEvent | null {
  if (outcome.kind !== "event") return null;
  const p = outcome.payload;
  const str = (key: string): string | null =>
    typeof p[key] === "string" && p[key] ? (p[key] as string) : null;
  const court = (): number | null =>
    typeof p.court === "number" && Number.isInteger(p.court) ? p.court : null;

  switch (outcome.type) {
    case "COURT_FINISHED": {
      const n = court();
      return n === null ? null : { type: "COURT_FINISHED", at, operator, court: n };
    }
    case "COURT_CONFIRMED": {
      const n = court();
      return n === null
        ? null
        : {
            type: "COURT_CONFIRMED",
            at,
            operator,
            court: n,
            since: typeof p.since === "number" ? p.since : null,
          };
    }
    case "PLAYER_PAUSED": {
      const token = str("token");
      return token && isPauseReason(p.reason)
        ? { type: "PLAYER_PAUSED", at, operator, token, reason: p.reason }
        : null;
    }
    case "PLAYER_REQUEUED": {
      const token = str("token");
      return token ? { type: "PLAYER_REQUEUED", at, operator, token } : null;
    }
    case "FOURSOME_MEMBER_SWAPPED": {
      const n = court();
      const out = str("out");
      const incoming = str("in");
      return n !== null && out && incoming
        ? { type: "FOURSOME_MEMBER_SWAPPED", at, operator, court: n, out, in: incoming }
        : null;
    }
    case "PLAYER_JOINED": {
      const token = str("token");
      const firstName = str("firstName");
      const lastInitial = str("lastInitial");
      return token && firstName && lastInitial && isSkillLevel(p.skillLevel)
        ? {
            type: "PLAYER_JOINED",
            at,
            operator,
            token,
            firstName,
            lastInitial,
            skillLevel: p.skillLevel,
            queueOnJoin: p.queueOnJoin === true,
          }
        : null;
    }
    case "PLAYER_SKILL_SET": {
      const token = str("token");
      return token && isSkillLevel(p.skillLevel)
        ? { type: "PLAYER_SKILL_SET", at, operator, token, skillLevel: p.skillLevel }
        : null;
    }
    case "GROUP_FORMED": {
      const groupId = str("groupId");
      const raw = Array.isArray(p.memberTokens) ? p.memberTokens : null;
      const memberTokens =
        raw?.filter((t): t is string => typeof t === "string") ?? [];
      // Every member has to survive the narrowing, or the Group that forms is
      // not the one the Operator picked.
      return groupId && raw && memberTokens.length === raw.length
        ? { type: "GROUP_FORMED", at, operator, groupId, memberTokens }
        : null;
    }
    case "GROUP_MEMBER_REMOVED": {
      const groupId = str("groupId");
      const token = str("token");
      return groupId && token
        ? { type: "GROUP_MEMBER_REMOVED", at, operator, groupId, token }
        : null;
    }
    case "GROUP_DISSOLVED": {
      const groupId = str("groupId");
      return groupId ? { type: "GROUP_DISSOLVED", at, operator, groupId } : null;
    }
    case "GROUP_CAP_CHANGED":
      return typeof p.cap === "number" && Number.isInteger(p.cap)
        ? { type: "GROUP_CAP_CHANGED", at, operator, cap: p.cap }
        : null;
    default:
      return null;
  }
}
