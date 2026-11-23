"use client";

import { useActionState } from "react";

import {
  addPlayerAction,
  removePlayerAction,
  renameTeamAction,
  savePlayerAction,
  type RosterState,
} from "@/lib/ddd/actions/roster";
import { MAX_TEAM_NAME, captainOf, formatAverage, type StoredPlayer, type StoredTeam } from "@/lib/ddd/roster";

const text = (value: number | null, decimals: number) => (value === null ? "" : value.toFixed(decimals));

/** The Organizer's roster: every player editable, removable and movable, and one add form per Team. */
export function RosterEditor({ teams }: { teams: StoredTeam[] }) {
  return (
    <div className="ddd-stack-lg">
      {teams.map((team) => {
        const captain = captainOf(team);
        return (
          <section key={team.id} className="ddd-slip ddd-section" aria-labelledby={`ddd-team-${team.id}`}>
            <h2 id={`ddd-team-${team.id}`} className="ddd-team-name">
              {team.name}
            </h2>
            <RenameTeam team={team} />
            {captain ? null : <p className="ddd-problem">No Captain: add (C) after a player&apos;s name.</p>}
            <ul className="ddd-players">
              {team.players.map((player) => (
                <li key={`${player.id}-${player.name}-${player.gender}-${player.dupr}-${player.duar}-${player.dusr}-${team.id}`}>
                  <PlayerForm player={player} team={team} teams={teams} isCaptain={player === captain} />
                </li>
              ))}
            </ul>
            <AddPlayer team={team} />
          </section>
        );
      })}
    </div>
  );
}

function PlayerFields({ player }: { player?: StoredPlayer }) {
  return (
    <>
      <div className="ddd-field ddd-field-wide">
        <label>
          Name
          <input name="name" required defaultValue={player?.name} autoComplete="off" />
        </label>
      </div>
      <div className="ddd-field">
        <label>
          M/F
          <select name="gender" defaultValue={player?.gender ?? "M"}>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </label>
      </div>
      <div className="ddd-field ddd-field-rating">
        <label>
          DUPR
          <input name="dupr" inputMode="decimal" defaultValue={text(player?.dupr ?? null, 3)} autoComplete="off" />
        </label>
      </div>
      <div className="ddd-field ddd-field-rating">
        <label>
          DUAR
          <input name="duar" inputMode="decimal" defaultValue={text(player?.duar ?? null, 1)} autoComplete="off" />
        </label>
      </div>
      <div className="ddd-field ddd-field-rating">
        <label>
          DUSR
          <input name="dusr" inputMode="decimal" defaultValue={text(player?.dusr ?? null, 1)} autoComplete="off" />
        </label>
      </div>
    </>
  );
}

function PlayerForm({
  player,
  team,
  teams,
  isCaptain,
}: {
  player: StoredPlayer;
  team: StoredTeam;
  teams: StoredTeam[];
  isCaptain: boolean;
}) {
  const [state, formAction, saving] = useActionState<RosterState, FormData>(
    savePlayerAction.bind(null, player.id, team.id),
    {},
  );
  return (
    <form action={formAction} className="ddd-player" aria-label={`Edit ${player.name}`}>
      <PlayerFields player={player} />
      <div className="ddd-field">
        <label>
          Team
          <select name="teamId" defaultValue={team.id}>
            {teams.map((each) => (
              <option key={each.id} value={each.id}>
                {each.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="ddd-note ddd-player-avg">
        Average {formatAverage(player)}
        {isCaptain ? " · Captain" : ""}
      </p>
      <div className="ddd-actions">
        <button type="submit" className="ddd-btn" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="submit"
          className="ddd-quiet"
          formNoValidate
          formAction={removePlayerAction.bind(null, player.id)}
        >
          Remove
        </button>
        <p role="alert" className="ddd-problem empty:hidden">
          {state.problem}
        </p>
      </div>
    </form>
  );
}

function RenameTeam({ team }: { team: StoredTeam }) {
  const [state, formAction, saving] = useActionState<RosterState, FormData>(renameTeamAction.bind(null, team.id), {});
  return (
    <details className="ddd-add">
      <summary className="ddd-quiet">Rename {team.name}</summary>
      {/* Keyed on the name so a saved rename refills the field. */}
      <form key={team.name} action={formAction} className="ddd-player" aria-label={`Rename ${team.name}`}>
        <div className="ddd-field ddd-field-wide">
          <label>
            Team name
            <input name="name" required maxLength={MAX_TEAM_NAME} defaultValue={team.name} autoComplete="off" />
          </label>
        </div>
        <div className="ddd-actions">
          <button type="submit" className="ddd-btn" disabled={saving}>
            {saving ? "Saving…" : "Save name"}
          </button>
          <p role="alert" className="ddd-problem empty:hidden">
            {state.problem}
          </p>
        </div>
      </form>
    </details>
  );
}

function AddPlayer({ team }: { team: StoredTeam }) {
  const [state, formAction, saving] = useActionState<RosterState, FormData>(addPlayerAction.bind(null, team.id), {});
  return (
    <details className="ddd-add">
      <summary className="ddd-quiet">Add a player to {team.name}</summary>
      {/* Keyed on the player count so a saved add clears the form. */}
      <form key={team.players.length} action={formAction} className="ddd-player" aria-label={`Add a player to ${team.name}`}>
        <PlayerFields />
        <div className="ddd-actions">
          <button type="submit" className="ddd-btn" disabled={saving}>
            {saving ? "Adding…" : "Add player"}
          </button>
          <p role="alert" className="ddd-problem empty:hidden">
            {state.problem}
          </p>
        </div>
      </form>
    </details>
  );
}
