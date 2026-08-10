import { reduceMatch } from "./reduce.ts";
import { formatClock, scoreCall, teamName } from "./selectors.ts";
import {
  otherTeam,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type TimeoutRecord,
} from "./types.ts";

/**
 * The human-readable audit trail: one row per thing that actually happened.
 *
 * Not a 1:1 rendering of the event log. A timeout is four events
 * (started/paused/resumed/ended) but one occurrence, so it collapses to a
 * single row carrying its outcome. Events the reducer ignored produce no row at
 * all — a log that claims a rally was scored during a timeout is worse than no
 * log, because the whole point of this list is settling disputes.
 */
export type LogEntryTone = "setup" | "point" | "timeout" | "technical" | "game";

export interface MatchLogEntry {
  key: string;
  at: number;
  gameNumber: number;
  /** The score call as it read at the moment this row describes. */
  scoreCall: string;
  label: string;
  detail: string | null;
  tone: LogEntryTone;
}

/**
 * Every row needs the state as it stood at that point in the match, and
 * `reduceMatch` only folds whole arrays — so this re-folds each prefix. That's
 * quadratic, but a full five-game match is a few hundred events and this only
 * runs when the log is opened. Deriving rather than storing is the same rule
 * the reducer follows for `TimeoutRecord`: state on an event can contradict the
 * replay after an undo, derived state cannot.
 */
export function buildMatchLog(
  config: MatchConfig,
  events: MatchEvent[]
): MatchLogEntry[] {
  const final = reduceMatch(config, events);
  const entries: MatchLogEntry[] = [];

  let before = reduceMatch(config, []);
  let prematchLogged = false;

  events.forEach((event, i) => {
    const after = reduceMatch(config, events.slice(0, i + 1));

    // PREMATCH is the one applied event the signature can't see (it can set the
    // serve to the team that already holds it by default), so gate it on
    // first-one-wins, matching the reducer.
    const applied =
      event.type === "PREMATCH" ? !prematchLogged : changedAnything(before, after);

    if (applied) {
      if (event.type === "PREMATCH") prematchLogged = true;
      const entry = describe(config, event, before, after, final, i);
      if (entry) entries.push(entry);
    }

    before = after;
  });

  return entries;
}

function describe(
  config: MatchConfig,
  event: MatchEvent,
  before: MatchState,
  after: MatchState,
  final: MatchState,
  index: number
): MatchLogEntry | null {
  const key = `${event.at}-${index}`;

  switch (event.type) {
    case "PREMATCH":
      return {
        key,
        at: event.at,
        gameNumber: 1,
        scoreCall: scoreCall(after),
        label: "Coin toss",
        detail: `${teamName(config, event.winner)} won it · ${teamName(config, event.server)} serves first`,
        tone: "setup",
      };

    case "RALLY_WON": {
      const scored =
        after.current.scores[event.team] > before.current.scores[event.team];
      const sideOut = after.current.serving !== before.current.serving;
      const who = teamName(config, event.team);

      return {
        key,
        at: event.at,
        gameNumber: after.games.length,
        scoreCall: scoreCall(after),
        label: scored
          ? `Point — ${who}`
          : sideOut
            ? `Side out — ${who}`
            : `Second server — ${teamName(config, after.current.serving)}`,
        detail: scored
          ? null
          : sideOut
            ? `Serve to ${who}`
            : `Rally to ${who}`,
        tone: "point",
      };
    }

    case "TIMEOUT_STARTED": {
      // The record is the reducer's own derivation of this timeout, read off
      // the FINAL state so the row knows how it ended, not just that it began.
      const record = final.timeoutHistory.find((r) => r.startedAt === event.at);
      return {
        key,
        at: event.at,
        gameNumber: after.games.length,
        scoreCall: scoreCall(after),
        label: `Timeout — ${teamName(config, event.team)}`,
        detail: record ? timeoutDetail(record, config) : event.kind,
        tone: "timeout",
      };
    }

    case "TECHNICAL_WARNING":
      return {
        key,
        at: event.at,
        gameNumber: after.games.length,
        scoreCall: scoreCall(after),
        label: `Warning — ${teamName(config, event.team)}`,
        detail: "No point awarded",
        tone: "technical",
      };

    case "TECHNICAL_FOUL":
      return {
        key,
        at: event.at,
        gameNumber: after.games.length,
        scoreCall: scoreCall(after),
        label: `Technical foul — ${teamName(config, event.team)}`,
        detail: `Point to ${teamName(config, otherTeam(event.team))}`,
        tone: "technical",
      };

    case "GAME_CONFIRMED": {
      const winner = before.current.winner;
      return {
        key,
        at: event.at,
        gameNumber: before.games.length,
        // The after-state has already opened the next game at 0-0.
        scoreCall: scoreCall(before),
        label: `Game ${before.games.length}${winner ? ` — ${teamName(config, winner)}` : ""}`,
        detail: `Games ${after.gamesWon.A}-${after.gamesWon.B}`,
        tone: "game",
      };
    }

    case "MATCH_ENDED":
      return {
        key,
        at: event.at,
        gameNumber: before.games.length,
        scoreCall: scoreCall(before),
        label: "Match ended early",
        detail: "Stopped by the referee",
        tone: "game",
      };

    // The clock events are folded into their timeout's row.
    case "TIMEOUT_PAUSED":
    case "TIMEOUT_RESUMED":
    case "TIMEOUT_ENDED":
      return null;
  }
}

function timeoutDetail(record: TimeoutRecord, config: MatchConfig): string {
  const kind =
    record.kind === "standard"
      ? `standard ${record.ordinal}/${config.timeoutsPerGame}`
      : record.kind;

  const outcome =
    record.endedAt === null
      ? "in progress"
      : `${record.endReason === "expired" ? "expired" : "ended early"} after ${formatClock(record.endedAt - record.startedAt)}`;

  const paused =
    record.pauseCount > 0
      ? ` · paused ${record.pauseCount}× for ${formatClock(record.pausedMs)}`
      : "";

  return `${kind} · ${outcome}${paused}`;
}

/**
 * Did the reducer act on this event? Restating its guards here would let the
 * two drift apart, so compare the state either side of the fold instead. Every
 * field an applied event can move is in the signature.
 */
function changedAnything(before: MatchState, after: MatchState): boolean {
  return signature(before) !== signature(after);
}

function signature(state: MatchState): string {
  const game = state.current;
  return [
    state.games.length,
    game.scores.A,
    game.scores.B,
    game.serving,
    game.serverNumber,
    game.servingSlot,
    game.complete,
    game.sidesSwitched,
    game.firstServer,
    state.gamesWon.A,
    state.gamesWon.B,
    state.warnings.A,
    state.warnings.B,
    state.matchComplete,
    state.timeoutHistory.length,
    state.activeTimeout?.startedAt ?? "-",
  ].join("|");
}
