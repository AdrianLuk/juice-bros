"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useTimeoutClock } from "@/components/apps/referee-scorekeeper/hooks/use-timeout-clock";
import { save } from "@/components/apps/referee-scorekeeper/lib/persistence/match-storage";
import { reduceMatch } from "@/components/apps/referee-scorekeeper/lib/scoring/reduce";
import type {
  MatchConfig,
  MatchEvent,
  MatchEventDraft,
  MatchState,
  TeamId,
  TimeoutKind,
} from "@/components/apps/referee-scorekeeper/lib/scoring/types";

type LogState = { events: MatchEvent[]; redo: MatchEvent[] };

type LogAction =
  | { type: "APPEND"; event: MatchEvent }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "LOAD"; events: MatchEvent[] };

/**
 * A tiny reducer over the log itself. All domain logic lives in `reduceMatch`.
 *
 * Note this stays pure — `Date.now()` is applied by `append` before dispatch,
 * not in here. React invokes reducers twice under StrictMode, and a reducer
 * that stamps its own timestamps would produce two different events.
 */
function eventLog(state: LogState, action: LogAction): LogState {
  switch (action.type) {
    case "APPEND":
      return { events: [...state.events, action.event], redo: [] };
    case "UNDO": {
      if (state.events.length === 0) return state;
      const last = state.events[state.events.length - 1];
      return { events: state.events.slice(0, -1), redo: [...state.redo, last] };
    }
    case "REDO": {
      if (state.redo.length === 0) return state;
      const next = state.redo[state.redo.length - 1];
      return { events: [...state.events, next], redo: state.redo.slice(0, -1) };
    }
    case "LOAD":
      return { events: action.events, redo: [] };
  }
}

export interface UseMatchResult {
  state: MatchState;
  events: MatchEvent[];
  /** Epoch ms of the first event, for relative timestamps in the timeout log. */
  matchStartedAt: number;
  remainingMs: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  prematch: (winner: TeamId, server: TeamId) => void;
  rallyWon: (team: TeamId) => void;
  technicalFoul: (team: TeamId) => void;
  technicalWarning: (team: TeamId) => void;
  startTimeout: (team: TeamId, kind: TimeoutKind) => void;
  pauseTimeoutClock: () => void;
  startTimeoutClock: () => void;
  endTimeout: () => void;
  confirmGame: () => void;
  endMatch: () => void;
}

export function useMatch(
  config: MatchConfig,
  initialEvents: MatchEvent[] = []
): UseMatchResult {
  const [{ events, redo }, dispatch] = useReducer(eventLog, {
    events: initialEvents,
    redo: [],
  });

  const state = useMemo(() => reduceMatch(config, events), [config, events]);

  // Every append writes the whole log. Belt and braces with the beforeunload
  // confirm below: the confirm prevents most refreshes, the save catches the
  // rest plus crashes and OS tab-eviction.
  useEffect(() => {
    if (events.length) save(config, events);
  }, [config, events]);

  useEffect(() => {
    if (!events.length || state.matchComplete) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [events.length, state.matchComplete]);

  const append = useCallback((draft: MatchEventDraft) => {
    dispatch({
      type: "APPEND",
      event: { ...draft, at: Date.now() } as MatchEvent,
    });
  }, []);

  // The clock can fire onExpire more than once between dispatch and re-render.
  // The reducer would ignore the duplicate, but it would still pollute the log
  // and cost an undo, so remember which timeout we've already closed.
  const activeStartedAt = state.activeTimeout?.startedAt ?? null;
  const expiredFor = useRef<number | null>(null);

  useEffect(() => {
    expiredFor.current = null;
  }, [activeStartedAt]);

  const onExpire = useCallback(() => {
    if (activeStartedAt === null || expiredFor.current === activeStartedAt) return;
    expiredFor.current = activeStartedAt;
    append({ type: "TIMEOUT_ENDED", reason: "expired" });
  }, [activeStartedAt, append]);

  const remainingMs = useTimeoutClock(state.activeTimeout, onExpire);

  return {
    state,
    events,
    // Only read once there are events, and the first event predates any timeout.
    matchStartedAt: events[0]?.at ?? 0,
    remainingMs,
    canUndo: events.length > 0,
    canRedo: redo.length > 0,
    undo: useCallback(() => dispatch({ type: "UNDO" }), []),
    redo: useCallback(() => dispatch({ type: "REDO" }), []),
    prematch: useCallback(
      (winner: TeamId, server: TeamId) =>
        append({ type: "PREMATCH", winner, server }),
      [append]
    ),
    rallyWon: useCallback(
      (team: TeamId) => append({ type: "RALLY_WON", team }),
      [append]
    ),
    technicalFoul: useCallback(
      (team: TeamId) => append({ type: "TECHNICAL_FOUL", team }),
      [append]
    ),
    technicalWarning: useCallback(
      (team: TeamId) => append({ type: "TECHNICAL_WARNING", team }),
      [append]
    ),
    startTimeout: useCallback(
      (team: TeamId, kind: TimeoutKind) =>
        append({ type: "TIMEOUT_STARTED", team, kind }),
      [append]
    ),
    pauseTimeoutClock: useCallback(
      () => append({ type: "TIMEOUT_PAUSED" }),
      [append]
    ),
    startTimeoutClock: useCallback(
      () => append({ type: "TIMEOUT_RESUMED" }),
      [append]
    ),
    endTimeout: useCallback(
      () => append({ type: "TIMEOUT_ENDED", reason: "ended_early" }),
      [append]
    ),
    confirmGame: useCallback(() => append({ type: "GAME_CONFIRMED" }), [append]),
    endMatch: useCallback(() => append({ type: "MATCH_ENDED" }), [append]),
  };
}
