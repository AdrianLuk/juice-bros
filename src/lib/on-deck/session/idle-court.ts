/**
 * The idle-court nudge (issue #259).
 *
 * A Game on a Court has no time cap and no score (ADR 0002), so the only sign a
 * Court has finished is an Operator's "Court N done" tap. On a self-serve floor
 * with nobody watching every Court, a forgotten tap stalls the Queue — the four
 * who finished never re-queue and no Foursome walks on. So when a Court has been
 * in play well past a normal Game length, every live surface asks "Is Court N
 * still going?" and any Player standing there can confirm it (which pushes the
 * next nudge out by roughly another Game length) or tap "Court N done".
 *
 * This is a render-layer projection, not part of the fold: it is the one
 * question `reduceSession` deliberately can't answer, because it depends on how
 * much wall-clock time has *elapsed* since the Game was seated. `now` is
 * injected so it stays testable.
 *
 * Relative imports only and no `server-only` — pure logic over a plain object,
 * unit-tested under `node --test`.
 */

import type { SessionState } from "./types.ts";

/**
 * A normal pickleball game to 11, win by 2, runs about this long at a club
 * social. The nudge threshold is a multiple of it, not this value itself — a
 * single game overrunning by a few minutes is normal; a Court sitting at two
 * and a half games is a forgotten tap.
 */
export const EXPECTED_GAME_MS = 15 * 60 * 1000;

/**
 * How many expected Game lengths a Court may sit before the nudge shows. 2.5 →
 * a Court is flagged at ~37 min unconfirmed, comfortably past a long game plus
 * changeover but well short of "they played two full games and forgot twice".
 * A single multiple so every surface agrees; tune here.
 */
export const IDLE_COURT_NUDGE_MULTIPLE = 2.5;

/** The idle interval (ms) past which a Court is nudged. */
export const IDLE_COURT_NUDGE_MS = EXPECTED_GAME_MS * IDLE_COURT_NUDGE_MULTIPLE;

/**
 * The 1-based numbers of the Courts that have been in play, unconfirmed, longer
 * than `IDLE_COURT_NUDGE_MS` — the Courts the Kiosk (and Display) should ask
 * "still going?" about. Measured from the later of the Game's seat time and its
 * last "still going" confirmation (issue #259's `COURT_CONFIRMED`). Empty for a
 * Session with no long-running Court, and never flags an empty Court.
 *
 * `now` is injected (the render layer's ticking clock) — the fold never reads
 * it. A Court seated in the future (clock skew) is treated as just seated.
 */
export function idleCourts(state: SessionState, now: number): number[] {
  const idle: number[] = [];
  for (const court of state.courts) {
    if (court.foursome.length === 0 || court.since === null) continue;
    const confirmedAt = state.courtConfirmedAt[court.number] ?? 0;
    const measuredFrom = Math.max(court.since, confirmedAt);
    if (now - measuredFrom >= IDLE_COURT_NUDGE_MS) {
      idle.push(court.number);
    }
  }
  return idle;
}
