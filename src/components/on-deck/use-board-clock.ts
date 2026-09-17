"use client";

import { useEffect, useState } from "react";

/** How often a board catches its clock up. Wait times are shown in whole
 * minutes, so half a minute is close enough and cheap. */
const TICK_MS = 30_000;

/**
 * A live board's wall clock.
 *
 * Every On Deck board shows two things the fold deliberately cannot answer:
 * how long each Player in the Queue has been waiting, and how long a Court has
 * sat since its Game was seated. Both are "how much time has elapsed", which is
 * a render-layer question (`reduceSession` never reads the clock, and
 * `idleCourts` and `describeUndo` take a `now` for exactly this reason).
 *
 * One clock per board, owned by whoever drives it. The Queue's minutes, the
 * idle-court nudge and the Undo window all have to agree, and three
 * independent `setInterval`s would leave them up to half a minute apart on the
 * same screen.
 *
 * `origin` is the moment the board first rendered and never changes — what the
 * demo night (#519) stamps its authored log against, so the log and the first
 * projection of it share a zero. `now` catches up on the tick, so a board
 * nobody is touching still counts its waits up.
 */
export function useBoardClock(): { origin: number; now: number } {
  const [origin] = useState(() => Date.now());
  const [now, setNow] = useState(origin);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return { origin, now };
}
