/**
 * Domain types for the referee scorekeeper.
 *
 * Nothing in `src/lib/scoring` may import React. The match is an append-only
 * list of events; all visible state is derived by folding those events through
 * `reduceMatch`. That rule is what keeps this layer testable in plain Node.
 */

export type TeamId = "A" | "B";
export type ServerNumber = 1 | 2;

/** Only `standard` counts against the per-game allowance. */
export type TimeoutKind = "standard" | "medical" | "equipment";

/** `[playerOnEvenCourt, playerOnOddCourt]`. Singles matches only use index 0. */
export type PlayerPair = [string, string?];

export const TEAM_IDS = ["A", "B"] as const;

export function otherTeam(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

export interface MatchConfig {
  scoring: "sideout" | "rally";
  doubles: boolean;
  pointsToWin: number; // 11 | 15 | 21
  winBy: number; // 2 (sometimes 1 in rally formats)
  bestOf: number; // 1 | 3 | 5
  /**
   * Rally scoring only. A team that reaches game point while receiving does
   * not win — the score holds there until they win a rally on their own
   * serve. Meaningless in side-out scoring, where only the server ever scores.
   */
  freezeRule: boolean;
  switchAtScore: number | null; // 6 for games to 11
  /** USAP switches sides mid-game in the deciding game only. */
  switchAtScoreDecidingGameOnly: boolean;
  timeoutsPerGame: number; // 2
  timeoutSeconds: number; // 60
  /** Medical and equipment timeouts bypass the allowance and are timed separately. */
  medicalTimeoutSeconds: number;
  equipmentTimeoutSeconds: number;
  players: Record<TeamId, PlayerPair>;
}

/** Every event carries `at` (epoch ms). It's what makes the timeout clock refresh-proof. */
export type MatchEvent =
  /**
   * `winner` is who won the toss, kept for the record. `server` is the team
   * that actually ends up serving first — resolved by the coin-toss screen,
   * since a "side" pick hands that decision to the opponent rather than
   * fixing it from the winner's choice alone.
   */
  | { type: "PREMATCH"; at: number; winner: TeamId; server: TeamId }
  | { type: "RALLY_WON"; at: number; team: TeamId }
  | { type: "TIMEOUT_STARTED"; at: number; team: TeamId; kind: TimeoutKind }
  | { type: "TIMEOUT_PAUSED"; at: number }
  | { type: "TIMEOUT_RESUMED"; at: number }
  | { type: "TIMEOUT_ENDED"; at: number; reason: "expired" | "ended_early" }
  /** `team` is the team being warned. */
  | { type: "TECHNICAL_WARNING"; at: number; team: TeamId }
  /** `team` is the *offending* team; the point goes to their opponent. */
  | { type: "TECHNICAL_FOUL"; at: number; team: TeamId }
  | { type: "GAME_CONFIRMED"; at: number }
  /** A ref stopping the match before it reached a normal conclusion — forfeit, injury, weather. */
  | { type: "MATCH_ENDED"; at: number };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event before the dispatch layer stamps `at`. */
export type MatchEventDraft = DistributiveOmit<MatchEvent, "at">;

/**
 * A pausable clock can't be a single `endsAt` timestamp — pausing moves the
 * finish line. Model it as budget + consumed instead: `accumulatedMs` is time
 * spent across CLOSED running segments, `runningSince` opens the current one.
 * `runningSince === null` means paused.
 *
 *   remaining = durationMs - accumulatedMs - (runningSince ? now - runningSince : 0)
 *
 * Both fields come from summing event timestamps, so the reducer never reads
 * the wall clock and a refresh mid-timeout — running or paused — restores to
 * the exact right number.
 */
export interface ActiveTimeout {
  team: TeamId;
  kind: TimeoutKind;
  startedAt: number;
  durationMs: number;
  accumulatedMs: number;
  runningSince: number | null;
  /** When the current pause began; needed to accrue `pausedMs` on resume. */
  pausedSince: number | null;
}

/**
 * The audit record. Every field except the timestamps is DERIVED during the
 * fold — the score at the moment of the call is whatever the reducer had
 * accumulated when it hit that event. Never store the score on the event
 * itself; that would let the log contradict the replay after an undo.
 */
export interface TimeoutRecord {
  team: TeamId;
  kind: TimeoutKind;
  gameNumber: number; // 1-indexed
  /** Standard: this team's Nth of the allowance. Other kinds: Nth of that kind this game. */
  ordinal: number;
  scoreAtCall: Record<TeamId, number>;
  servingAtCall: TeamId;
  serverNumberAtCall: ServerNumber;
  startedAt: number;
  endedAt: number | null; // null while still open
  endReason: "expired" | "ended_early" | null;
  pausedMs: number; // total wall time spent paused
  pauseCount: number;
}

export interface GameState {
  scores: Record<TeamId, number>;
  serving: TeamId;
  serverNumber: ServerNumber;
  /**
   * Doubles side-out only: which slot of `positions[serving]` is serving.
   *
   * Must be tracked, not re-derived from score parity. Parity governs where
   * the game's STARTING server stands — not which player is serving. A side-out
   * always opens with the right/even-court player (slot 0), and the second
   * server takes over from wherever they already stand, so either player can
   * end up serving from either side.
   */
  servingSlot: 0 | 1;
  /** index 0 = player currently on the even/right court */
  positions: Record<TeamId, PlayerPair>;
  timeoutsUsed: Record<TeamId, number>;
  sidesSwitched: boolean;
  complete: boolean;
  winner: TeamId | null;
  /** Who served first this game. Alternates each game. */
  firstServer: TeamId;
}

export interface MatchState {
  config: MatchConfig;
  /** Finished games plus the current one; `current` is the same object as the last entry. */
  games: GameState[];
  current: GameState;
  gamesWon: Record<TeamId, number>;
  matchComplete: boolean;
  warnings: Record<TeamId, number>;
  activeTimeout: ActiveTimeout | null; // null once TIMEOUT_ENDED is logged
  timeoutHistory: TimeoutRecord[]; // whole match, chronological
}
