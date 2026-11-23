"use client";

import { useMemo, useState, useTransition } from "react";

import { saveRosterAction } from "@/lib/ddd/actions/roster";
import {
  canSave,
  captainOf,
  formatAverage,
  formatRating,
  parseRoster,
  TEAM_COUNT,
} from "@/lib/ddd/roster";

/**
 * Paste the roster rows from the sheet (issue #712). The preview shows the
 * Teams as they would be saved, and flags what is wrong before anything is.
 * Re-pasting over a saved roster asks first.
 */
export function RosterPaste({ eventId, hasRoster }: { eventId: string; hasRoster: boolean }) {
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState(false);
  const [saving, startSaving] = useTransition();
  const parsed = useMemo(() => parseRoster(text), [text]);
  const pasted = text.trim() !== "";
  const flags = [...parsed.rowProblems, ...parsed.teamProblems];
  // A Team with no Captain only warns; everything else blocks.
  const ready = pasted && canSave(parsed);

  function save() {
    setProblem("");
    startSaving(async () => {
      const result = await saveRosterAction(eventId, text);
      if (result.problem) setProblem(result.problem);
      else {
        setDone(true);
        setText("");
        setConfirming(false);
      }
    });
  }

  return (
    <section className="ddd-slip ddd-section" aria-labelledby="ddd-paste">
      <h2 id="ddd-paste" className="ddd-slip-head">
        {hasRoster ? "Replace the roster" : "Paste the roster"}
      </h2>
      <div className="ddd-field">
        <label htmlFor="ddd-paste-box">Rows from the sheet</label>
        <textarea
          id="ddd-paste-box"
          className="ddd-paste-box"
          value={text}
          rows={6}
          spellCheck={false}
          placeholder="Player, M/F, DUPR, DUAR, DUSR, Total Avg Rating, Team"
          onChange={(event) => {
            setText(event.target.value);
            setConfirming(false);
            setDone(false);
          }}
        />
        <p className="ddd-note">
          Copy the rows in Google Sheets and paste them here. The header row is skipped and the average column is
          ignored: the app works the Average Rating out itself. Put (C) after each Captain&apos;s name.
        </p>
      </div>

      {done ? <p role="status">Roster saved. The Public Link shows it now.</p> : null}

      {pasted && flags.length > 0 ? (
        <ul className="ddd-flags" aria-label="Problems with the paste">
          {flags.map((flag) => (
            <li key={flag.message} className="ddd-problem">
              {flag.message}
            </li>
          ))}
        </ul>
      ) : null}

      {pasted && parsed.teams.length > 0 ? (
        <div className="ddd-preview" aria-label="Preview">
          <p className="ddd-slip-head">
            Preview: {parsed.teams.length} {parsed.teams.length === 1 ? "Team" : "Teams"}
            {parsed.teams.length === TEAM_COUNT ? "" : ` (need ${TEAM_COUNT})`}
          </p>
          {parsed.teams.map((team) => {
            const captain = captainOf(team);
            return (
              <div key={team.name} className="ddd-preview-team">
                <h3 className="ddd-team-name">{team.name}</h3>
                <p className="ddd-note">{captain ? `Captain: ${captain.name}` : "No Captain"}</p>
                <table className="ddd-roster">
                  <thead>
                    <tr>
                      <th scope="col">Player</th>
                      <th scope="col">DUPR</th>
                      <th scope="col">DUAR</th>
                      <th scope="col">DUSR</th>
                      <th scope="col">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.players.map((player, index) => (
                      <tr key={`${player.name}-${index}`}>
                        <th scope="row">
                          {player.name}
                          <span className="ddd-gender"> {player.gender}</span>
                        </th>
                        <td>{formatRating(player.dupr, "dupr")}</td>
                        <td>{formatRating(player.duar, "duar")}</td>
                        <td>{formatRating(player.dusr, "dusr")}</td>
                        <td>{formatAverage(player)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : null}

      {confirming ? (
        <div className="ddd-confirm" role="alert">
          <p>This replaces every Team and player now on the roster. Lineups, Spreads and Dreambreaker finals that use them go too.</p>
          <div className="ddd-actions">
            <button type="button" className="ddd-btn" disabled={saving} onClick={save}>
              {saving ? "Replacing…" : "Yes, replace the roster"}
            </button>
            <button type="button" className="ddd-quiet" onClick={() => setConfirming(false)}>
              Keep the current roster
            </button>
          </div>
        </div>
      ) : (
        <div className="ddd-actions">
          <button
            type="button"
            className="ddd-btn"
            disabled={!ready || saving}
            onClick={() => (hasRoster ? setConfirming(true) : save())}
          >
            {saving ? "Saving…" : hasRoster ? "Replace the roster" : "Save the roster"}
          </button>
          <p role="alert" className="ddd-problem empty:hidden">
            {problem}
          </p>
        </div>
      )}
    </section>
  );
}
