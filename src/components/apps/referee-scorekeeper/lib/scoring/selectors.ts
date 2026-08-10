import { gamesToWin } from "./reduce.ts";
import {
  otherTeam,
  type MatchConfig,
  type MatchState,
  type ServerNumber,
  type TeamId,
  type TimeoutKind,
  type TimeoutRecord,
} from "./types.ts";

export type ScoreCallParts = {
  serving: number;
  receiving: number;
  serverNumber: ServerNumber | null;
};

/** Serving score, receiving score, server number — in the order it's spoken. */
export function scoreCallParts(state: MatchState): ScoreCallParts {
  const game = state.current;
  const usesServerNumber =
    state.config.doubles && state.config.scoring === "sideout";
  return {
    serving: game.scores[game.serving],
    receiving: game.scores[otherTeam(game.serving)],
    serverNumber: usesServerNumber ? game.serverNumber : null,
  };
}

export function scoreCall(state: MatchState): string {
  const { serving, receiving, serverNumber } = scoreCallParts(state);
  return serverNumber === null
    ? `${serving}-${receiving}`
    : `${serving}-${receiving}-${serverNumber}`;
}

/** The score call as it stood when a timeout was called. */
export function recordScoreCall(
  record: TimeoutRecord,
  config: MatchConfig
): string {
  const serving = record.scoreAtCall[record.servingAtCall];
  const receiving = record.scoreAtCall[otherTeam(record.servingAtCall)];
  return config.doubles && config.scoring === "sideout"
    ? `${serving}-${receiving}-${record.serverNumberAtCall}`
    : `${serving}-${receiving}`;
}

export function isGameOver(state: MatchState): boolean {
  return state.current.complete;
}

export function timeoutsRemaining(state: MatchState, team: TeamId): number {
  return Math.max(
    0,
    state.config.timeoutsPerGame - state.current.timeoutsUsed[team]
  );
}

export function canCallTimeout(
  state: MatchState,
  team: TeamId,
  kind: TimeoutKind
): boolean {
  if (state.activeTimeout || state.current.complete || state.matchComplete) {
    return false;
  }
  if (kind !== "standard") return true;
  return timeoutsRemaining(state, team) > 0;
}

/**
 * The correct serving court is derived, never stored: the server stands on the
 * even/right court when their own team's score is even. Combined with
 * `positions`, this says which named player should be serving from which side —
 * the thing that catches positional faults.
 */
export function serverCourt(state: MatchState): "even" | "odd" {
  const game = state.current;
  return game.scores[game.serving] % 2 === 0 ? "even" : "odd";
}

export function servingPlayer(state: MatchState): string {
  const game = state.current;
  const pair = game.positions[game.serving];
  if (!state.config.doubles) return pair[0];
  return serverCourt(state) === "even" ? pair[0] : (pair[1] ?? pair[0]);
}

/** The receiver stands diagonally opposite, i.e. on the same court parity. */
export function receivingPlayer(state: MatchState): string {
  const game = state.current;
  const pair = game.positions[otherTeam(game.serving)];
  if (!state.config.doubles) return pair[0];
  return serverCourt(state) === "even" ? pair[0] : (pair[1] ?? pair[0]);
}

export function teamName(config: MatchConfig, team: TeamId): string {
  const named = config.players[team].filter(
    (name): name is string => Boolean(name && name.trim())
  );
  if (named.length === 0) return `Team ${team}`;
  return named.join(" / ");
}

export function playerLabel(
  config: MatchConfig,
  team: TeamId,
  index: 0 | 1
): string {
  const name = config.players[team][index];
  if (name && name.trim()) return name;
  return config.doubles ? `Team ${team} ${index + 1}` : `Team ${team}`;
}

const ORDINAL_WORDS = ["first", "second", "third", "fourth"];

/**
 * Sanctioned play requires the ref to say the team, the timeout number, and the
 * score. Built from the TimeoutRecord so what's spoken and what's logged can't
 * diverge.
 */
export function timeoutAnnouncement(
  record: TimeoutRecord,
  config: MatchConfig
): string {
  const who = teamName(config, record.team);
  const score = `Score ${recordScoreCall(record, config)}.`;
  if (record.kind === "standard") {
    const nth = ORDINAL_WORDS[record.ordinal - 1] ?? `#${record.ordinal}`;
    return `Timeout — ${who}, ${nth} of ${config.timeoutsPerGame}. ${score}`;
  }
  const kind = record.kind === "medical" ? "Medical timeout" : "Equipment timeout";
  return `${kind} — ${who}. ${score}`;
}

export function matchWinner(state: MatchState): TeamId | null {
  if (!state.matchComplete) return null;
  const needed = gamesToWin(state.config);
  if (state.gamesWon.A >= needed) return "A";
  if (state.gamesWon.B >= needed) return "B";
  return null;
}

/** 1-indexed number of the game being played (or the last one played). */
export function currentGameNumber(state: MatchState): number {
  return state.games.length;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Wall-clock offset from the first event of the match, for the timeout log. */
export function elapsedLabel(at: number, matchStartedAt: number): string {
  return formatClock(Math.max(0, at - matchStartedAt));
}
