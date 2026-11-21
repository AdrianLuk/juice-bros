"use client";

import { useActionState } from "react";

import { saveLineupAction, type LineupState } from "@/lib/ddd/actions/lineup";
import {
  GAME_LABEL,
  LINEUP_GAMES,
  emptyLineup,
  lineupWarnings,
  readLineup,
  slotField,
  type RawLineup,
} from "@/lib/ddd/lineup";
import type { StoredTeam } from "@/lib/ddd/roster";

/**
 * Each Team's Lineup, typed in from the group chat (issue #713). Every Pair
 * picks from that Team's roster. A broken rule shows beside the Pair it is
 * about and the Lineup saves anyway; the warnings come from what is saved, so
 * fixing it and saving clears them.
 */
export function LineupEditor({ teams, lineups }: { teams: StoredTeam[]; lineups: Record<string, RawLineup> }) {
  return (
    <div className="ddd-stack-lg">
      {teams.map((team) => (
        <TeamLineup key={team.id} team={team} raw={lineups[team.id] ?? null} />
      ))}
    </div>
  );
}

function TeamLineup({ team, raw }: { team: StoredTeam; raw: RawLineup | null }) {
  const [state, formAction, saving] = useActionState<LineupState, FormData>(saveLineupAction.bind(null, team.id), {});
  const saved = readLineup(team.players, raw);
  const warnings = saved ? lineupWarnings(team.players, saved) : null;
  const shown = saved ?? emptyLineup();

  return (
    <section className="ddd-slip ddd-section" aria-labelledby={`ddd-lineup-${team.id}`}>
      <h2 id={`ddd-lineup-${team.id}`} className="ddd-team-name">
        {team.name}
      </h2>
      {warnings?.team.map((message) => (
        <p key={message} className="ddd-problem">
          {message}
        </p>
      ))}
      {/* Keyed on what is saved, so the picks always match it. */}
      <form key={JSON.stringify(raw)} action={formAction} className="ddd-stack" aria-label={`${team.name} Lineup`}>
        {LINEUP_GAMES.map((game) => (
          <fieldset key={game} className="ddd-pair">
            <legend>{GAME_LABEL[game]}</legend>
            <div className="ddd-pair-slots">
              {([1, 2] as const).map((slot) => (
                <div key={slot} className="ddd-field">
                  <label>
                    <span className="ddd-sr">
                      {GAME_LABEL[game]} player {slot}
                    </span>
                    <select name={slotField(game, slot)} defaultValue={shown[game][slot - 1] ?? ""}>
                      <option value="">Pick a player</option>
                      {team.players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name} ({player.gender})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
            {warnings?.pairs[game].map((message) => (
              <p key={message} className="ddd-problem">
                {message}
              </p>
            ))}
          </fieldset>
        ))}
        <div className="ddd-actions">
          <button type="submit" className="ddd-btn" disabled={saving}>
            {saving ? "Saving…" : "Save Lineup"}
          </button>
          <p role="status" className="ddd-note empty:hidden">
            {state.saved ? "Saved." : null}
          </p>
          <p role="alert" className="ddd-problem empty:hidden">
            {state.problem}
          </p>
        </div>
      </form>
    </section>
  );
}
