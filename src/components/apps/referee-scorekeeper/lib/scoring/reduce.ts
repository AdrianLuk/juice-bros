import {
  otherTeam,
  TEAM_IDS,
  type ActiveTimeout,
  type GameState,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type PlayerPair,
  type ServerNumber,
  type TeamId,
  type TimeoutKind,
  type TimeoutRecord,
} from "./types.ts";

/**
 * The pure fold. Takes the whole event array — not one event at a time —
 * because that is what makes replay (and therefore undo) trivial.
 *
 * `reduceMatch` must NEVER call `Date.now()`. It reads `at` off the events and
 * expresses the active timeout as absolute timestamps; whether that timeout has
 * *elapsed* is a question for the render layer, which has a ticking clock. The
 * moment this function reads the wall clock, `reduceMatch(cfg, events)` stops
 * being reproducible and the undo-parity guarantee goes with it.
 */
export function reduceMatch(config: MatchConfig, events: MatchEvent[]): MatchState {
  const games: GameState[] = [newGame(config, "A")];
  let current = games[0];

  const gamesWon: Record<TeamId, number> = { A: 0, B: 0 };
  const warnings: Record<TeamId, number> = { A: 0, B: 0 };
  const timeoutHistory: TimeoutRecord[] = [];
  let activeTimeout: ActiveTimeout | null = null;
  let matchComplete = false;
  let prematchDone = false;

  /** While a timeout is active the last record is by construction the open one. */
  const openRecord = () => timeoutHistory[timeoutHistory.length - 1];

  for (const event of events) {
    switch (event.type) {
      case "PREMATCH": {
        if (prematchDone || games.length > 1) break;
        if (current.scores.A !== 0 || current.scores.B !== 0) break;
        // Which team actually serves is resolved before this event is
        // dispatched — see the comment on the PREMATCH event type.
        current.serving = event.server;
        current.firstServer = event.server;
        prematchDone = true;
        break;
      }

      case "RALLY_WON": {
        // Play is stopped during a timeout and after game point; the log
        // shouldn't say otherwise.
        if (activeTimeout || current.complete || matchComplete) break;
        const wasServing = event.team === current.serving;
        awardRally(config, current, event.team);
        applySideSwitch(config, current, games.length);
        applyGameEnd(config, current, event.team, wasServing);
        break;
      }

      case "TECHNICAL_FOUL": {
        if (current.complete || matchComplete) break;
        // A point to the non-offending team with service unchanged — genuinely
        // a different path from RALLY_WON, so no position swap either.
        const scoringTeam = otherTeam(event.team);
        const wasServing = scoringTeam === current.serving;
        current.scores[scoringTeam] += 1;
        applySideSwitch(config, current, games.length);
        applyGameEnd(config, current, scoringTeam, wasServing);
        break;
      }

      case "TECHNICAL_WARNING": {
        if (matchComplete) break;
        warnings[event.team] += 1;
        break;
      }

      case "TIMEOUT_STARTED": {
        if (activeTimeout || current.complete || matchComplete) break;
        const allowanceSpent =
          current.timeoutsUsed[event.team] >= config.timeoutsPerGame;
        if (event.kind === "standard" && allowanceSpent) break;

        let ordinal: number;
        if (event.kind === "standard") {
          current.timeoutsUsed[event.team] += 1;
          ordinal = current.timeoutsUsed[event.team];
        } else {
          ordinal =
            timeoutHistory.filter(
              (r) =>
                r.gameNumber === games.length &&
                r.team === event.team &&
                r.kind === event.kind
            ).length + 1;
        }

        timeoutHistory.push({
          team: event.team,
          kind: event.kind,
          gameNumber: games.length,
          ordinal,
          scoreAtCall: { ...current.scores },
          servingAtCall: current.serving,
          serverNumberAtCall: current.serverNumber,
          startedAt: event.at,
          endedAt: null,
          endReason: null,
          pausedMs: 0,
          pauseCount: 0,
        });

        activeTimeout = {
          team: event.team,
          kind: event.kind,
          startedAt: event.at,
          durationMs: timeoutSeconds(config, event.kind) * 1000,
          accumulatedMs: 0,
          runningSince: event.at,
          pausedSince: null,
        };
        break;
      }

      case "TIMEOUT_PAUSED": {
        if (!activeTimeout || activeTimeout.runningSince === null) break;
        activeTimeout.accumulatedMs += event.at - activeTimeout.runningSince;
        activeTimeout.runningSince = null;
        activeTimeout.pausedSince = event.at;
        openRecord().pauseCount += 1;
        break;
      }

      case "TIMEOUT_RESUMED": {
        if (!activeTimeout || activeTimeout.runningSince !== null) break;
        if (activeTimeout.pausedSince !== null) {
          openRecord().pausedMs += event.at - activeTimeout.pausedSince;
        }
        activeTimeout.runningSince = event.at;
        activeTimeout.pausedSince = null;
        break;
      }

      case "TIMEOUT_ENDED": {
        if (!activeTimeout) break;
        const record = openRecord();
        // Ending a paused timeout outright is valid; still bank the paused span.
        if (activeTimeout.runningSince === null && activeTimeout.pausedSince !== null) {
          record.pausedMs += event.at - activeTimeout.pausedSince;
        }
        record.endedAt = event.at;
        record.endReason = event.reason;
        activeTimeout = null;
        break;
      }

      case "GAME_CONFIRMED": {
        if (!current.complete || matchComplete || current.winner === null) break;
        gamesWon[current.winner] += 1;
        activeTimeout = null;
        if (gamesWon[current.winner] >= gamesToWin(config)) {
          matchComplete = true;
          break;
        }
        // The team that did not serve first last game serves first this game.
        const next = newGame(config, otherTeam(current.firstServer));
        games.push(next);
        current = next;
        break;
      }

      case "MATCH_ENDED": {
        if (matchComplete) break;
        matchComplete = true;
        activeTimeout = null;
        break;
      }
    }
  }

  return {
    config,
    games,
    current,
    gamesWon,
    matchComplete,
    warnings,
    activeTimeout,
    timeoutHistory,
  };
}

export function gamesToWin(config: MatchConfig): number {
  return Math.floor(config.bestOf / 2) + 1;
}

export function timeoutSeconds(config: MatchConfig, kind: TimeoutKind): number {
  if (kind === "medical") return config.medicalTimeoutSeconds;
  if (kind === "equipment") return config.equipmentTimeoutSeconds;
  return config.timeoutSeconds;
}

/** Side-out doubles opens at 0-0-2, so the first service turn ends on the first lost rally. */
function startingServerNumber(config: MatchConfig): ServerNumber {
  return config.scoring === "sideout" && config.doubles ? 2 : 1;
}

function newGame(config: MatchConfig, firstServer: TeamId): GameState {
  return {
    scores: { A: 0, B: 0 },
    serving: firstServer,
    serverNumber: startingServerNumber(config),
    positions: {
      A: [...config.players.A] as PlayerPair,
      B: [...config.players.B] as PlayerPair,
    },
    timeoutsUsed: { A: 0, B: 0 },
    sidesSwitched: false,
    complete: false,
    winner: null,
    firstServer,
  };
}

function swapPositions(game: GameState, team: TeamId): void {
  const [even, odd] = game.positions[team];
  if (odd === undefined) return;
  game.positions[team] = [odd, even];
}

function awardRally(config: MatchConfig, game: GameState, team: TeamId): void {
  const serving = team === game.serving;

  if (config.scoring === "rally") {
    if (!serving && config.freezeRule && wouldWinGame(config, game, team)) {
      // Freeze rule: the game can only be closed out on serve. Winning the
      // rally while receiving, at what would otherwise be the winning
      // score, is just a side-out — service passes, no point is scored.
      game.serving = team;
      game.serverNumber = 1;
      return;
    }
    game.scores[team] += 1;
    if (serving) {
      if (config.doubles) swapPositions(game, team);
    } else {
      game.serving = team;
      game.serverNumber = 1;
    }
    return;
  }

  // Side-out scoring.
  if (serving) {
    game.scores[team] += 1;
    if (config.doubles) swapPositions(game, team);
    return;
  }

  // Receiving team wins the rally — no score change either way.
  if (config.doubles && game.serverNumber === 1) {
    game.serverNumber = 2;
    return;
  }
  game.serving = team;
  game.serverNumber = 1;
}

function applySideSwitch(
  config: MatchConfig,
  game: GameState,
  gameNumber: number
): void {
  if (config.switchAtScore === null || game.sidesSwitched) return;
  if (config.switchAtScoreDecidingGameOnly && gameNumber !== config.bestOf) return;
  if (
    game.scores.A >= config.switchAtScore ||
    game.scores.B >= config.switchAtScore
  ) {
    game.sidesSwitched = true;
  }
}

/** Would `team` winning one more point end the game, at the current score? */
function wouldWinGame(config: MatchConfig, game: GameState, team: TeamId): boolean {
  const nextScore = game.scores[team] + 1;
  return (
    nextScore >= config.pointsToWin &&
    nextScore - game.scores[otherTeam(team)] >= config.winBy
  );
}

/**
 * `scoringTeam`/`scoringTeamWasServing` describe the point that was just
 * awarded. `awardRally` already stops a rally win from crossing the win
 * threshold while receiving (it becomes a side-out instead), so this gate is
 * only ever live for `TECHNICAL_FOUL`, which awards a point without regard
 * to serve: a foul that lands the receiving team on game point still counts,
 * but doesn't end the game until they close it out on serve.
 */
function applyGameEnd(
  config: MatchConfig,
  game: GameState,
  scoringTeam: TeamId,
  scoringTeamWasServing: boolean
): void {
  for (const team of TEAM_IDS) {
    const opponent = otherTeam(team);
    if (
      game.scores[team] >= config.pointsToWin &&
      game.scores[team] - game.scores[opponent] >= config.winBy
    ) {
      const frozen =
        config.scoring === "rally" &&
        config.freezeRule &&
        team === scoringTeam &&
        !scoringTeamWasServing;
      if (frozen) return;
      game.complete = true;
      game.winner = team;
      return;
    }
  }
}
