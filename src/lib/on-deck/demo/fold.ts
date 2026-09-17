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
 * Turn a `floor-ops` decision into the event to append, or null when the
 * outcome carried no event. The live paths hand the same `{ type, payload }`
 * to Postgres, which reads it back through `sessions.ts`'s row parser; here
 * the payload is already typed and trusted, so the switch only has to put the
 * fields where the fold expects them.
 *
 * An unhandled type returns null rather than throwing: a decision this demo
 * cannot commit must leave the board untouched, never break it.
 */
export function demoEventFor(
  outcome: FloorOpOutcome,
  at: number,
  operator: Operator,
): SessionEvent | null {
  if (outcome.kind !== "event") return null;
  const p = outcome.payload;
  const str = (key: string): string =>
    typeof p[key] === "string" ? (p[key] as string) : "";
  const num = (key: string): number =>
    typeof p[key] === "number" ? (p[key] as number) : 0;

  switch (outcome.type) {
    case "COURT_FINISHED":
      return { type: "COURT_FINISHED", at, operator, court: num("court") };
    case "COURT_CONFIRMED":
      return {
        type: "COURT_CONFIRMED",
        at,
        operator,
        court: num("court"),
        since: typeof p.since === "number" ? p.since : null,
      };
    case "PLAYER_PAUSED":
      return isPauseReason(p.reason)
        ? {
            type: "PLAYER_PAUSED",
            at,
            operator,
            token: str("token"),
            reason: p.reason,
          }
        : null;
    case "PLAYER_REQUEUED":
      return { type: "PLAYER_REQUEUED", at, operator, token: str("token") };
    case "FOURSOME_MEMBER_SWAPPED":
      return {
        type: "FOURSOME_MEMBER_SWAPPED",
        at,
        operator,
        court: num("court"),
        out: str("out"),
        in: str("in"),
      };
    case "PLAYER_JOINED":
      return isSkillLevel(p.skillLevel)
        ? {
            type: "PLAYER_JOINED",
            at,
            operator,
            token: str("token"),
            firstName: str("firstName"),
            lastInitial: str("lastInitial"),
            skillLevel: p.skillLevel,
            queueOnJoin: p.queueOnJoin === true,
          }
        : null;
    case "PLAYER_SKILL_SET":
      return isSkillLevel(p.skillLevel)
        ? {
            type: "PLAYER_SKILL_SET",
            at,
            operator,
            token: str("token"),
            skillLevel: p.skillLevel,
          }
        : null;
    case "GROUP_FORMED":
      return {
        type: "GROUP_FORMED",
        at,
        operator,
        groupId: str("groupId"),
        memberTokens: Array.isArray(p.memberTokens)
          ? p.memberTokens.filter((t): t is string => typeof t === "string")
          : [],
      };
    case "GROUP_MEMBER_REMOVED":
      return {
        type: "GROUP_MEMBER_REMOVED",
        at,
        operator,
        groupId: str("groupId"),
        token: str("token"),
      };
    case "GROUP_DISSOLVED":
      return { type: "GROUP_DISSOLVED", at, operator, groupId: str("groupId") };
    case "GROUP_CAP_CHANGED":
      return { type: "GROUP_CAP_CHANGED", at, operator, cap: num("cap") };
    default:
      return null;
  }
}
