"use client";

import { useEffect, useMemo, useState } from "react";

import {
  FloorBoard,
  NOTHING_PENDING,
  type FloorBoardOps,
} from "@/components/on-deck/floor-board";
import { DEMO_CONFIG, demoNightEvents } from "@/lib/on-deck/demo/night";
import { demoEventFor, demoLoadedSession } from "@/lib/on-deck/demo/fold";
import {
  addWalkupOutcome,
  bringBackOutcome,
  dissolveGroupOutcome,
  finishCourtOutcome,
  formGroupOutcome,
  lowerGroupCapOutcome,
  overrideSkillOutcome,
  setAsideOutcome,
  swapNoShowOutcome,
  type FloorOpOutcome,
} from "@/lib/on-deck/floor-ops";
import {
  floorRosterFrom,
  rotationViewFrom,
} from "@/lib/on-deck/session/rotation-view";
import type { Operator, SessionEvent } from "@/lib/on-deck/session/types";

/**
 * The demo night (issue #519): the real floor screen, driven entirely in the
 * browser.
 *
 * Everything here goes through the same two pure layers a real Saturday runs
 * on. A tap asks `floor-ops` what event it should append, exactly as the
 * Organizer's Server Action does; the event goes on the end of an array in
 * `useState` instead of into Postgres; and `reduceSession` folds the whole log
 * again. There is no Supabase client, no Realtime channel and no Server Action
 * anywhere in this file's import graph, which is what makes the demo reachable
 * with no account and no round trip, and what makes a bug it shows a bug in
 * the Floor rather than in a mock of it.
 *
 * The page renders per request (`dynamic = "force-dynamic"`), so the clock the
 * log is stamped against is within a network hop of the browser's own and the
 * two sides of hydration agree on every wait time.
 */
export function DemoFloor() {
  const [origin] = useState(() => Date.now());
  const [events, setEvents] = useState<SessionEvent[]>(() =>
    demoNightEvents(origin),
  );
  const [error, setError] = useState<string | null>(null);

  // The projection's clock — it feeds the Undo window and the idle-court
  // nudge, never the fold. Seeded from the server's `now` so the first render
  // is identical on both sides of hydration, then ticking like the live
  // board's, so a demo somebody leaves open goes the way a real night left
  // untouched would.
  const [now, setNow] = useState(origin);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loaded = useMemo(
    () => demoLoadedSession(DEMO_CONFIG, events),
    [events],
  );
  const view = useMemo(
    () => rotationViewFrom(loaded, undefined, now),
    [loaded, now],
  );
  const roster = useMemo(() => floorRosterFrom(loaded), [loaded]);

  /**
   * Commit one floor decision. An `error` outcome is shown and nothing is
   * appended; a `noop` — a double tap on a Court that already turned over —
   * clears the error and leaves the board alone, exactly as the live path
   * treats it. Returns whether the tap was accepted, for the forms that clear
   * themselves on success.
   */
  const apply = (outcome: FloorOpOutcome): { ok?: boolean } => {
    if (outcome.kind === "error") {
      setError(outcome.error);
      return { ok: false };
    }
    setError(null);
    if (outcome.kind === "noop") return { ok: true };

    const event = demoEventFor(outcome, Date.now(), DEMO_OPERATOR);
    if (!event) return { ok: false };
    setEvents((prev) => [...prev, event]);
    return { ok: true };
  };

  /** Append an event no floor decision produces — the two wrap-up taps. */
  const appendRaw = (event: SessionEvent): void => {
    setError(null);
    setEvents((prev) => [...prev, event]);
  };

  const ops: FloorBoardOps = {
    finishCourt: (court, since) =>
      apply(finishCourtOutcome(loaded.state, court, since)),
    swapNoShow: ({ court, since, outName, inName }) =>
      apply(swapNoShowOutcome(loaded.state, court, since, outName, inName)),
    setPlayerAside: (name) => apply(setAsideOutcome(loaded.state, name)),
    bringPlayerBack: (name) => apply(bringBackOutcome(loaded.state, name)),
    // Undo is the same thing it is in the database: drop the last event and
    // fold again, unless somebody got there first.
    undo: (expectedSeq) => {
      if (expectedSeq !== events.length) {
        setError("The board moved on. Take another look.");
        return;
      }
      setError(null);
      setEvents((prev) => prev.slice(0, -1));
    },
    addWalkup: async ({ first, initial, skill }) =>
      apply(
        addWalkupOutcome(
          loaded.state,
          `walkup-${crypto.randomUUID()}`,
          first,
          initial,
          skill,
        ),
      ),
    overrideSkill: ({ name, skill }) =>
      apply(overrideSkillOutcome(loaded.state, name, skill)),
    formGroup: async (names) =>
      apply(
        formGroupOutcome(loaded.state, names, `group-${crypto.randomUUID()}`),
      ),
    setGroupCap: (cap) => apply(lowerGroupCapOutcome(loaded.state, cap)),
    dissolveGroup: (groupId) =>
      apply(dissolveGroupOutcome(loaded.state, groupId)),
    callLastCall: () =>
      appendRaw({ type: "LAST_CALL", at: Date.now(), operator: DEMO_OPERATOR }),
    closeSession: () =>
      appendRaw({
        type: "SESSION_CLOSED",
        at: Date.now(),
        operator: DEMO_OPERATOR,
      }),
  };

  return (
    <FloorBoard
      view={view}
      roster={roster}
      // There is no Club to join, so there is no code to hold up. Everything
      // else on the board is the screen an Organizer would be looking at.
      joinQr={null}
      auth={{ kind: "organizer" }}
      error={error}
      pending={NOTHING_PENDING}
      ops={ops}
    />
  );
}

/** Whoever is tapping the demo is standing in for the Organizer. */
const DEMO_OPERATOR: Operator = { kind: "organizer", userId: "demo-organizer" };
