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
 * Which side the current server is standing on. Combined with `positions`,
 * this says which named player should be serving from which side — the thing
 * that catches positional faults.
 *
 * For everything except doubles side-out this is derived from score parity
 * (the server stands on the even/right court when their own team's score is
 * even). Doubles side-out is the exception, because there the serving player
 * changes independently of the score: a side-out hands the serve to the
 * right-court player and the second-server handoff moves nobody, so neither
 * transition touches the score. `servingSlot` is the tracked answer.
 */
export function serverCourt(state: MatchState): "even" | "odd" {
  const game = state.current;
  if (state.config.doubles && state.config.scoring === "sideout") {
    return game.servingSlot === 0 ? "even" : "odd";
  }
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

/**
 * How many times the two teams have traded ends since the first serve: once at
 * the end of every completed game, plus the mid-game switch in any game where
 * it fired. Whoever the ref had on their left at the start is on their right
 * after an odd number of these.
 */
export function endChanges(state: MatchState): number {
  const currentIndex = state.games.length - 1;
  return state.games.reduce(
    (count, game, index) =>
      count + (game.sidesSwitched ? 1 : 0) + (index < currentIndex ? 1 : 0),
    0
  );
}

/**
 * Which team the ref has on their left, for the landscape "standing at the net"
 * layout.
 *
 * Two independent things move it. The teams changing ends is derivable from the
 * match (`endChanges`). The ref walking round to the other side of the net is
 * not — nothing in a score log says where a person is standing — so that half
 * comes in as `refFlipped`, which the ref sets by hand. Team A starts on the
 * left purely because it's the pair entered first at setup; the manual flip is
 * what makes that match the actual court.
 */
export function leftTeam(state: MatchState, refFlipped: boolean): TeamId {
  const swapped = (endChanges(state) % 2 === 1) !== refFlipped;
  return swapped ? "B" : "A";
}

export function teamName(config: MatchConfig, team: TeamId): string {
  return teamNameLines(config, team).join(" / ");
}

/**
 * Same names as `teamName`, unjoined — for callers that want to lay a doubles
 * pair out as two lines instead of one slash-separated string (the rally
 * buttons, where a pair of long names squeezed onto one line reads worse than
 * two short ones stacked).
 */
export function teamNameLines(config: MatchConfig, team: TeamId): string[] {
  const named = config.players[team].filter(
    (name): name is string => Boolean(name && name.trim())
  );
  return named.length === 0 ? [`Team ${team}`] : named;
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

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11-13 -> "th" (English ordinal suffix rules). */
function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

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
    const nth = ordinal(record.ordinal);
    const left = config.timeoutsPerGame - record.ordinal;
    return `Timeout — ${who}, ${nth} timeout. ${left} left. ${score}`;
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
