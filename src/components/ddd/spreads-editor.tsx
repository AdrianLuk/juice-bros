"use client";

import { useActionState } from "react";

import { savePairingAction, type SpreadsState } from "@/lib/ddd/actions/spreads";
import { GAME_LABEL, LINEUP_GAMES, type RawLineup } from "@/lib/ddd/lineup";
import type { StoredTeam } from "@/lib/ddd/roster";
import { lineupsOf, needsRecheck, pairName, pairings, type SpreadRow } from "@/lib/ddd/spreads";

/**
 * The 24 Spreads (issue #714): one form per Team pairing, one cell per Game.
 * Each cell names both Pairs from the Lineups; pick the lower-rated one and
 * the points it is forecast to score. An empty cell reads "Spread needed". A
 * Lineup change after a Spread was set flags the cell, and keeps the Spread.
 */
export function SpreadsEditor({
  eventId,
  teams,
  lineups,
  spreads,
}: {
  eventId: string;
  teams: StoredTeam[];
  lineups: Record<string, RawLineup>;
  spreads: SpreadRow[];
}) {
  return (
    <div className="ddd-stack-lg">
      <p className="ddd-slip ddd-notice">
        {"From DUPR's Forecast, type the underdog's points (like 4.5), not DUPR's Spread (6.5)."}
      </p>
      {pairings(teams).map(([a, b]) => (
        <PairingForm
          key={`${a.id}-${b.id}`}
          eventId={eventId}
          a={a}
          b={b}
          lineups={lineups}
          rows={spreads.filter((row) => row.teamA === a.id && row.teamB === b.id)}
        />
      ))}
    </div>
  );
}

function PairingForm({
  eventId,
  a,
  b,
  lineups,
  rows,
}: {
  eventId: string;
  a: StoredTeam;
  b: StoredTeam;
  lineups: Record<string, RawLineup>;
  rows: SpreadRow[];
}) {
  const [state, formAction, saving] = useActionState<SpreadsState, FormData>(
    savePairingAction.bind(null, eventId, a.id, b.id),
    {},
  );
  const both = lineupsOf(a, b, lineups);

  return (
    <section className="ddd-slip ddd-section" aria-labelledby={`ddd-pairing-${a.id}-${b.id}`}>
      <h2 id={`ddd-pairing-${a.id}-${b.id}`} className="ddd-team-name">
        {a.name} v {b.name}
      </h2>
      {both ? null : <p className="ddd-note">Spreads open once both Teams have a Lineup.</p>}
      {/* Keyed on what is saved and on what a refused save typed, so the cells match them (React resets a form after its action). */}
      <form key={JSON.stringify([rows, state.typed])} action={formAction} className="ddd-stack" aria-label={`${a.name} v ${b.name} Spreads`}>
        {LINEUP_GAMES.map((game) => {
          const row = rows.find((each) => each.game === game);
          const names = both ? ([pairName(a.players, both[0], game), pairName(b.players, both[1], game)] as const) : null;
          return (
            <fieldset key={game} className="ddd-pair" disabled={!names}>
              <legend>{GAME_LABEL[game]}</legend>
              <div className="ddd-pair-slots">
                <div className="ddd-field">
                  <label>
                    <span className="ddd-sr">{GAME_LABEL[game]} lower-rated Pair</span>
                    <select name={`${game}-lower`} defaultValue={state.typed?.[`${game}-lower`] ?? row?.lower ?? ""}>
                      <option value="">{names ? "Underdog Pair" : "Lineup needed"}</option>
                      {names ? (
                        <>
                          <option value="a">
                            {a.name}: {names[0]}
                          </option>
                          <option value="b">
                            {b.name}: {names[1]}
                          </option>
                        </>
                      ) : null}
                    </select>
                  </label>
                </div>
                <div className="ddd-field">
                  <label>
                    <span className="ddd-sr">{GAME_LABEL[game]} Spread points</span>
                    <input
                      name={`${game}-points`}
                      inputMode="decimal"
                      placeholder="Underdog's points, like 4.5"
                      defaultValue={state.typed?.[`${game}-points`] ?? (row ? row.points.toFixed(1) : "")}
                      autoComplete="off"
                    />
                  </label>
                </div>
              </div>
              {row ? null : <p className="ddd-note">Spread needed</p>}
              {row && both && needsRecheck(row, both) ? (
                <p className="ddd-problem">The Lineup changed since this Spread was set. Check it, then save.</p>
              ) : null}
            </fieldset>
          );
        })}
        <div className="ddd-actions">
          <button type="submit" className="ddd-btn" disabled={saving || !both}>
            {saving ? "Saving…" : "Save Spreads"}
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
