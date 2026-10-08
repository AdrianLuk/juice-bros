"use client";

import { useState, useTransition, type FormEvent } from "react";

import { saveGameScore, type LiveWriter } from "@/lib/team-tally/actions/live";
import {
  captainTeamName,
  isScored,
  playersIn,
  sideOf,
  teamName,
  type DocGame,
  type DocMatchup,
  type DocTeam,
  type GameKind,
  type Round,
} from "@/lib/team-tally/event-doc";
import { checkGameScore } from "@/lib/team-tally/score";

export const KIND_LABEL: Record<GameKind, string> = {
  captains: "Captains' game",
  teammates: "Teammates' game",
};

/** "Round 2, captains' game": what each Game's form is called. */
export function gameName(round: Round, kind: GameKind): string {
  return `Round ${round}, ${kind === "captains" ? "captains'" : "teammates'"} game`;
}

/**
 * The broadcast lower third under a scored Game: who last saved it, with
 * their side's colour bar. Nothing when the Game has no score yet.
 */
export function EditedBy({
  game,
  matchup,
  teams,
}: {
  game: DocGame;
  matchup: DocMatchup;
  teams: Map<string, DocTeam>;
}) {
  if (!isScored(game) || !game.lastEditedByKind) return null;

  if (game.lastEditedByKind === "organizer") {
    return <span className="tt-lower-third">Edited by the organizer</span>;
  }
  const editor = game.lastEditedByTeamId ? teams.get(game.lastEditedByTeamId) : undefined;
  if (!editor) return null;
  return (
    <span className="tt-lower-third" data-side={sideOf(matchup, editor.id)}>
      Entered by {captainTeamName(editor)}
    </span>
  );
}

function Who({ team, players, side }: { team: DocTeam; players: string[]; side: "red" | "blue" }) {
  return (
    <span className="tt-who">
      <span aria-hidden className={`tt-side tt-who-side ${side === "red" ? "tt-side-red" : "tt-side-blue"}`} />
      <span className="tt-who-names">{players.join(" + ")}</span>
      <small>{teamName(team)}</small>
    </span>
  );
}

function toPoints(value: string): number | null {
  if (value.trim() === "") return null;
  const points = Number(value);
  return Number.isFinite(points) ? points : null;
}

/**
 * One Game with its two score boxes, red side first as the brief prints it.
 * Standard number inputs restyled in the world. The boxes follow the live
 * score until someone types; a typed score is theirs until it saves.
 */
export function GameCard({
  game,
  matchup,
  teams,
  writer,
  onSaved,
}: {
  game: DocGame;
  matchup: DocMatchup;
  teams: Map<string, DocTeam>;
  writer: LiveWriter;
  onSaved: () => Promise<unknown>;
}) {
  const red = teams.get(matchup.redTeamId)!;
  const blue = teams.get(matchup.blueTeamId)!;
  const [draft, setDraft] = useState<{ red: string; blue: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = draft ?? {
    red: game.redScore === null ? "" : String(game.redScore),
    blue: game.blueScore === null ? "" : String(game.blueScore),
  };
  const redPoints = toPoints(shown.red);
  const bluePoints = toPoints(shown.blue);
  const scored = isScored(game);
  const name = gameName(game.round, game.kind);

  function edit(side: "red" | "blue", value: string) {
    setProblem(null);
    setDraft({ ...shown, [side]: value });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (redPoints === null || bluePoints === null) {
      setProblem("Enter both scores.");
      return;
    }
    const check = checkGameScore(redPoints, bluePoints);
    if (!check.ok) {
      setProblem(check.problem);
      return;
    }
    startTransition(async () => {
      const result = await saveGameScore(writer, game.id, redPoints, bluePoints);
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      await onSaved();
      setDraft(null);
    });
  }

  const showSave = draft !== null || !scored;

  return (
    <form className="tt-sheet tt-game" aria-label={name} onSubmit={submit} noValidate>
      <span className="tt-game-label">{KIND_LABEL[game.kind]}</span>
      {/* Red row over blue row, the score bug's own order. */}
      <div className="tt-game-sides">
        {(["red", "blue"] as const).map((side) => {
          const team = side === "red" ? red : blue;
          return (
            <div key={side} className="tt-game-side">
              <Who team={team} players={playersIn(team, game.round, game.kind)} side={side} />
              <input
                className="tt-score-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                placeholder="–"
                aria-label={`${teamName(team)} points`}
                aria-invalid={problem ? true : undefined}
                value={shown[side]}
                onChange={(event) => edit(side, event.target.value)}
              />
            </div>
          );
        })}
      </div>
      {problem && (
        <p className="tt-flag-note tt-game-problem" role="alert">
          {problem}
        </p>
      )}
      {(scored || showSave) && (
        <div className="tt-game-foot">
          <EditedBy game={game} matchup={matchup} teams={teams} />
          {showSave && (
            <button
              type="submit"
              className="tt-btn tt-game-save"
              disabled={pending || redPoints === null || bluePoints === null}
            >
              {pending ? "Saving" : "Save score"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

/** A Game as the Public Link reads it: who played, the score, who entered it. */
export function GameLine({
  game,
  matchup,
  teams,
}: {
  game: DocGame;
  matchup: DocMatchup;
  teams: Map<string, DocTeam>;
}) {
  const red = teams.get(matchup.redTeamId)!;
  const blue = teams.get(matchup.blueTeamId)!;
  return (
    <li className="tt-game-line">
      <span className="tt-game-label">
        R{game.round} · {KIND_LABEL[game.kind]}
      </span>
      {(["red", "blue"] as const).map((side) => {
        const team = side === "red" ? red : blue;
        const points = side === "red" ? game.redScore : game.blueScore;
        return (
          <span key={side} className="tt-game-line-row">
            <span aria-hidden className={`tt-side tt-who-side ${side === "red" ? "tt-side-red" : "tt-side-blue"}`} />
            <span className="tt-game-line-names">{playersIn(team, game.round, game.kind).join(" + ")}</span>
            <span className={`tt-game-line-score ${points === null ? "tt-game-line-pending" : ""}`}>{points ?? "–"}</span>
          </span>
        );
      })}
      <EditedBy game={game} matchup={matchup} teams={teams} />
    </li>
  );
}
