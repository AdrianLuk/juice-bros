/**
 * The Session event codec. The write side turns an `EventBody` (a
 * `SessionEvent` without `at` and `operator`) into the `{ type, payload }` a
 * row carries; the read side turns a row back into a `SessionEvent`, or
 * rejects it; and `assembleLoadedSession` folds a decoded log into the
 * `LoadedSession` every board projection takes.
 *
 * `encode` writes the payload keys SQL already reads by name — the unique
 * indexes on `payload->>'token'`, `on_deck_is_paused` reading `token` / `out`,
 * the queue and form-group pre-checks, the Volunteer and Kiosk append
 * whitelists — so changing a key here is a migration, not a refactor.
 * `codec.test.ts` pins every shape.
 *
 * Relative imports only and no `@supabase/*`, even as a type: the Demo night
 * imports this, and `demo/import-graph.test.ts` keeps its graph clear of a
 * Supabase client.
 */

import type { LastEvent } from "../floor-ops.ts";
import { reduceSession } from "./reduce.ts";
import type { LoadedSession } from "./rotation-view.ts";
import {
  isPauseReason,
  isSkillLevel,
  type EventBody,
  type Operator,
  type SessionConfig,
  type SessionEvent,
} from "./types.ts";

/** A payload value as Postgres `jsonb` holds it. */
export type PayloadValue = string | number | boolean | null | string[];

/** The `payload` column: a flat object of `PayloadValue`s. */
export type EventPayload = Record<string, PayloadValue>;

/** A row's `type` and `payload` columns. */
export type EncodedEvent = {
  type: EventBody["type"];
  payload: EventPayload;
};

export function encode(body: EventBody): EncodedEvent {
  switch (body.type) {
    case "PLAYER_JOINED":
      return {
        type: body.type,
        payload: {
          token: body.token,
          firstName: body.firstName,
          lastInitial: body.lastInitial,
          skillLevel: body.skillLevel,
          // Only an Operator's walk-up carries it; a self-registered Player's
          // row (written by `on_deck_player_join`) has no such key.
          ...(body.queueOnJoin === undefined
            ? {}
            : { queueOnJoin: body.queueOnJoin }),
        },
      };
    case "PLAYER_SKILL_SET":
      return {
        type: body.type,
        payload: { token: body.token, skillLevel: body.skillLevel },
      };
    case "PLAYER_QUEUED":
    case "PLAYER_REQUEUED":
      return { type: body.type, payload: { token: body.token } };
    case "COURT_FINISHED":
      return { type: body.type, payload: { court: body.court } };
    case "COURT_CONFIRMED":
      return {
        type: body.type,
        payload: { court: body.court, since: body.since },
      };
    case "PLAYER_PAUSED":
      return {
        type: body.type,
        payload: { token: body.token, reason: body.reason },
      };
    case "FOURSOME_MEMBER_SWAPPED":
      return {
        type: body.type,
        payload: { court: body.court, out: body.out, in: body.in },
      };
    case "GROUP_FORMED":
      return {
        type: body.type,
        payload: {
          groupId: body.groupId,
          memberTokens: [...body.memberTokens],
        },
      };
    case "GROUP_MEMBER_REMOVED":
      return {
        type: body.type,
        payload: { groupId: body.groupId, token: body.token },
      };
    case "GROUP_DISSOLVED":
      return { type: body.type, payload: { groupId: body.groupId } };
    case "GROUP_CAP_CHANGED":
      return { type: body.type, payload: { cap: body.cap } };
    // Structural events: SQL stamps SESSION_STARTED's config keys itself and
    // nothing decodes them; LAST_CALL and SESSION_CLOSED carry nothing.
    case "SESSION_STARTED":
    case "LAST_CALL":
    case "SESSION_CLOSED":
      return { type: body.type, payload: {} };
  }
}

/**
 * One `on_deck_session_events` row, as PostgREST returns the columns the
 * Session loader selects. `seq` is the table's global identity, not a
 * per-Session counter; `at` is the `timestamptz` as an ISO string.
 */
export type EventRow = {
  seq: number;
  type: string;
  at: string;
  operator_kind: string;
  operator_user_id: string | null;
  payload: Record<string, unknown> | null;
};

export type DecodeResult =
  | { ok: true; event: SessionEvent }
  | { ok: false; reason: string };

function reject(reason: string): DecodeResult {
  return { ok: false, reason };
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function toOperator(row: EventRow): Operator | null {
  switch (row.operator_kind) {
    case "organizer":
      // The foundation's CHECK pairs an organizer with an account, so a null
      // here can't be written; reject rather than invent an empty user id.
      return isText(row.operator_user_id)
        ? { kind: "organizer", userId: row.operator_user_id }
        : null;
    case "volunteer":
    case "kiosk":
    case "player":
      return { kind: row.operator_kind };
    default:
      return null;
  }
}

/**
 * A row back to the `SessionEvent` it was appended as, or a rejection. Strict:
 * every string field non-empty, every number an integer where it names a Court
 * or a cap, `COURT_CONFIRMED.since` present as a number or null, and only the
 * 15 types `SessionEvent` knows (the DB CHECK also allows GROUP_MEMBER_ADDED
 * and FLOOR_MODE_CHANGED, which nothing writes and the fold has no case for).
 * A caller skips a rejected row rather than mis-folding it.
 */
export function decode(row: EventRow): DecodeResult {
  const at = new Date(row.at).getTime();
  if (!Number.isFinite(at)) return reject("at is not a timestamp");
  const operator = toOperator(row);
  if (!operator) return reject(`bad operator ${row.operator_kind}`);
  const payload = row.payload ?? {};
  const base = { at, operator };

  switch (row.type) {
    case "SESSION_STARTED":
    case "LAST_CALL":
    case "SESSION_CLOSED":
      return { ok: true, event: { type: row.type, ...base } };

    case "PLAYER_JOINED": {
      const { token, firstName, lastInitial, skillLevel, queueOnJoin } = payload;
      if (!isText(token) || !isText(firstName) || !isText(lastInitial)) {
        return reject("token, firstName and lastInitial must be non-empty");
      }
      if (!isSkillLevel(skillLevel)) return reject("unknown skillLevel");
      // Only an Operator's walk-up (issue #249) carries the key at all.
      if (queueOnJoin !== undefined && typeof queueOnJoin !== "boolean") {
        return reject("queueOnJoin is not a boolean");
      }
      return {
        ok: true,
        event: {
          type: "PLAYER_JOINED",
          ...base,
          token,
          firstName,
          lastInitial,
          skillLevel,
          ...(queueOnJoin === undefined ? {} : { queueOnJoin }),
        },
      };
    }

    case "PLAYER_SKILL_SET": {
      const { token, skillLevel } = payload;
      if (!isText(token)) return reject("token must be non-empty");
      if (!isSkillLevel(skillLevel)) return reject("unknown skillLevel");
      return {
        ok: true,
        event: { type: "PLAYER_SKILL_SET", ...base, token, skillLevel },
      };
    }

    case "PLAYER_QUEUED":
    case "PLAYER_REQUEUED": {
      const { token } = payload;
      if (!isText(token)) return reject("token must be non-empty");
      return { ok: true, event: { type: row.type, ...base, token } };
    }

    case "COURT_FINISHED": {
      const { court } = payload;
      if (!isInteger(court)) return reject("court is not an integer");
      return { ok: true, event: { type: "COURT_FINISHED", ...base, court } };
    }

    case "COURT_CONFIRMED": {
      const { court, since } = payload;
      if (!isInteger(court)) return reject("court is not an integer");
      // `since` is the Game's seat time the confirming surface saw, or null —
      // and always written, so a missing key is a bad row, not a null.
      if (since !== null && typeof since !== "number") {
        return reject("since is not a number or null");
      }
      return {
        ok: true,
        event: { type: "COURT_CONFIRMED", ...base, court, since },
      };
    }

    case "PLAYER_PAUSED": {
      const { token, reason } = payload;
      if (!isText(token)) return reject("token must be non-empty");
      if (!isPauseReason(reason)) return reject("unknown reason");
      return {
        ok: true,
        event: { type: "PLAYER_PAUSED", ...base, token, reason },
      };
    }

    case "FOURSOME_MEMBER_SWAPPED": {
      const { court, out, in: inbound } = payload;
      if (!isInteger(court)) return reject("court is not an integer");
      if (!isText(out) || !isText(inbound)) {
        return reject("out and in must be non-empty");
      }
      return {
        ok: true,
        event: {
          type: "FOURSOME_MEMBER_SWAPPED",
          ...base,
          court,
          out,
          in: inbound,
        },
      };
    }

    case "GROUP_FORMED": {
      const { groupId, memberTokens } = payload;
      if (!isText(groupId)) return reject("groupId must be non-empty");
      if (!Array.isArray(memberTokens) || !memberTokens.every(isText)) {
        return reject("memberTokens must be non-empty strings");
      }
      return {
        ok: true,
        event: { type: "GROUP_FORMED", ...base, groupId, memberTokens },
      };
    }

    case "GROUP_MEMBER_REMOVED": {
      const { groupId, token } = payload;
      if (!isText(groupId) || !isText(token)) {
        return reject("groupId and token must be non-empty");
      }
      return {
        ok: true,
        event: { type: "GROUP_MEMBER_REMOVED", ...base, groupId, token },
      };
    }

    case "GROUP_DISSOLVED": {
      const { groupId } = payload;
      if (!isText(groupId)) return reject("groupId must be non-empty");
      return { ok: true, event: { type: "GROUP_DISSOLVED", ...base, groupId } };
    }

    case "GROUP_CAP_CHANGED": {
      const { cap } = payload;
      if (!isInteger(cap)) return reject("cap is not an integer");
      return { ok: true, event: { type: "GROUP_CAP_CHANGED", ...base, cap } };
    }

    default:
      return reject("not a SessionEvent type");
  }
}

/**
 * What an event log hands back for one Session: its decoded events in append
 * order, and the newest of them with the `seq` it was stored under — the event
 * operator Undo (#247) targets.
 */
export type LoggedEvents = {
  events: SessionEvent[];
  lastEvent: LastEvent | null;
};

/**
 * One Session's event log, whatever holds it: Postgres
 * (`../supabase/event-log.ts`) on a real night, an array in the browser
 * (`../demo/fold.ts`) on the Demo night. `seq` is the log's own: a global
 * identity in the database, a per-log counter in memory — never reused, so a
 * stale Undo can't hit the event that replaced the one it saw.
 */
export type SessionEventLog = {
  append(sessionId: string, event: SessionEvent): Promise<void>;
  load(sessionId: string): Promise<LoggedEvents>;
};

/**
 * Rows, in `seq` order, to `LoggedEvents`. A row that fails to decode is
 * skipped and logged, never fatal: one bad row must not take a whole Session's
 * board down. `lastEvent` is the last row that *did* decode, so Undo is only
 * offered on an event the fold applied; if a bad row is newer, the Undo RPC's
 * seq check refuses rather than deleting a row nobody saw.
 */
export function decodeLog(rows: readonly EventRow[]): LoggedEvents {
  const events: SessionEvent[] = [];
  let lastEvent: LastEvent | null = null;
  for (const row of rows) {
    const result = decode(row);
    if (!result.ok) {
      console.error("on-deck: skipped an event row", {
        seq: row.seq,
        type: row.type,
        reason: result.reason,
      });
      continue;
    }
    const { event } = result;
    events.push(event);
    lastEvent = {
      seq: row.seq,
      type: event.type,
      at: event.at,
      operator: event.operator,
    };
  }
  return { events, lastEvent };
}

/**
 * Fold a loaded log into the shape every board renders from. The log's owner
 * supplies `config` and `status` (a Session row's columns live, the authored
 * night's own in the demo); everything else comes from the events.
 */
export function assembleLoadedSession(
  config: SessionConfig,
  status: LoadedSession["status"],
  log: LoggedEvents,
): LoadedSession {
  return {
    config,
    status,
    state: reduceSession(config, log.events),
    events: log.events,
    lastEvent: log.lastEvent,
  };
}
