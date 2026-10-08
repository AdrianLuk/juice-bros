/**
 * The Demo night's event log, held in the browser (issues #519, #618).
 *
 * The live Floor loads a Session out of Postgres (`../supabase/event-log.ts`),
 * folds it, and commits a tap as a row; the demo does the same two things with
 * the same pure code and no database at all. This module is the in-memory
 * adapter: a `floor-ops` decision's typed body is appended as it is, stamped
 * with `at` and an `operator`, and `demoLoadedSession` folds the log into the
 * `LoadedSession` every board projection takes, through the same
 * `assembleLoadedSession` the live loader uses.
 *
 * The log is an immutable value so it can sit in React state; the
 * `SessionEventLog` wrapper at the bottom is the same functions behind the
 * interface the contract test runs both adapters through.
 *
 * Relative imports only, no `server-only`, no React — the demo route's whole
 * import graph has to stay clear of a Supabase client, and this is the piece
 * that would otherwise be tempted to reach for one.
 */

import {
  assembleLoadedSession,
  type LoggedEvents,
  type SessionEventLog,
} from "../session/codec.ts";
import type { LoadedSession } from "../session/rotation-view.ts";
import type { SessionConfig, SessionEvent } from "../session/types.ts";

export type DemoLog = {
  readonly entries: readonly { seq: number; event: SessionEvent }[];
  /**
   * The `seq` the next append takes. It only grows — an Undo doesn't hand its
   * number back — which is what the database's identity column does too, so a
   * stale Undo aimed at a dropped event can never land on its replacement.
   */
  readonly nextSeq: number;
};

/** An authored log, numbered from 1 in the order given. */
export function demoLogOf(events: readonly SessionEvent[]): DemoLog {
  return {
    entries: events.map((event, i) => ({ seq: i + 1, event })),
    nextSeq: events.length + 1,
  };
}

export function appendToDemoLog(log: DemoLog, event: SessionEvent): DemoLog {
  return {
    entries: [...log.entries, { seq: log.nextSeq, event }],
    nextSeq: log.nextSeq + 1,
  };
}

/**
 * Undo means the same thing it does in the database: drop the newest event,
 * but only if it is still the one the caller saw (`expectedSeq`). Null when
 * somebody — or "let it run" — got there first.
 */
export function undoInDemoLog(log: DemoLog, expectedSeq: number): DemoLog | null {
  const last = log.entries[log.entries.length - 1];
  if (!last || last.seq !== expectedSeq) return null;
  return { entries: log.entries.slice(0, -1), nextSeq: log.nextSeq };
}

/** The log as `load` hands it back: events in order, the newest with its seq. */
export function readDemoLog(log: DemoLog): LoggedEvents {
  const last = log.entries[log.entries.length - 1];
  return {
    events: log.entries.map((entry) => entry.event),
    lastEvent: last
      ? {
          seq: last.seq,
          type: last.event.type,
          at: last.event.at,
          operator: last.event.operator,
        }
      : null,
  };
}

/**
 * Fold the log into the shape a board renders from. There is no Session row
 * to read a status off, so the log supplies it: closed once SESSION_CLOSED is
 * in it.
 */
export function demoLoadedSession(
  config: SessionConfig,
  log: DemoLog,
): LoadedSession {
  const closed = log.entries.some((e) => e.event.type === "SESSION_CLOSED");
  return assembleLoadedSession(config, closed ? "closed" : "open", readDemoLog(log));
}

/** The in-memory adapter behind the `SessionEventLog` interface, one log per
 * Session id. */
export function inMemoryEventLog(): SessionEventLog {
  const logs = new Map<string, DemoLog>();
  const logFor = (sessionId: string) => logs.get(sessionId) ?? demoLogOf([]);
  return {
    async append(sessionId, event) {
      logs.set(sessionId, appendToDemoLog(logFor(sessionId), event));
    },
    async load(sessionId) {
      return readDemoLog(logFor(sessionId));
    },
  };
}
