"use client";

import { useActionState, useState } from "react";

import { savePairingAction, type SpreadsState } from "@/lib/ddd/actions/spreads";
import { GAME_LABEL, LINEUP_GAMES, type RawLineup } from "@/lib/ddd/lineup";
import { duprSpread } from "@/lib/ddd/matchups";
import type { StoredTeam } from "@/lib/ddd/roster";
import { lineupsOf, needsRecheck, pairName, pairings, readSpreadPoints, type SpreadRow } from "@/lib/ddd/spreads";

/**
 * The 24 Spreads (issue #714), on screen "forecasts": one form per Team pairing, one cell per Game.
 * Each cell names both Pairs from the Lineups; pick the underdog and
 * its forecast. An empty cell reads "Forecast needed". A
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
        {
          "For each Game, pick the underdog Pair and type its forecast from DUPR: the score under the underdog, like 4.5. The spread works itself out, so you can check it against DUPR's."
        }
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

/**
 * The one number Godfrey types per Game: the underdog's forecast off DUPR's
 * Forecast screen. DUPR's own "Spread" (11 minus it) shows under it as he
 * types, so he can check the two screens agree.
 */
function UnderdogForecast({ id, name, initial }: { id: string; name: string; initial: string }) {
  const [typed, setTyped] = useState(initial);
  const read = readSpreadPoints(typed);
  const value = "value" in read ? read.value : null;
  return (
    <div className="ddd-field">
      <label htmlFor={id}>{"Underdog's forecast"}</label>
      <input
        id={id}
        name={name}
        inputMode="decimal"
        placeholder="Like 4.5"
        defaultValue={initial}
        onChange={(change) => setTyped(change.target.value)}
        autoComplete="off"
        aria-describedby={`${id}-spread`}
      />
      <p id={`${id}-spread`} className="ddd-note">
        {value === null ? "The spread shows here." : `Spread ${duprSpread(value)}, as DUPR shows it.`}
      </p>
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
      {both ? null : <p className="ddd-note">Forecasts open once both Teams have a Lineup.</p>}
      {/* Keyed on what is saved and on what a refused save typed, so the cells match them (React resets a form after its action). */}
      <form key={JSON.stringify([rows, state.typed])} action={formAction} className="ddd-stack" aria-label={`${a.name} v ${b.name} forecasts`}>
        {LINEUP_GAMES.map((game) => {
          const row = rows.find((each) => each.game === game);
          const names = both ? ([pairName(a.players, both[0], game), pairName(b.players, both[1], game)] as const) : null;
          return (
            <fieldset key={game} className="ddd-pair" disabled={!names}>
              <legend>{GAME_LABEL[game]}</legend>
              <div className="ddd-pair-slots">
                <div className="ddd-field">
                  <label htmlFor={`${a.id}-${b.id}-${game}-lower`}>Underdog Pair</label>
                  <select
                    id={`${a.id}-${b.id}-${game}-lower`}
                    name={`${game}-lower`}
                    defaultValue={state.typed?.[`${game}-lower`] ?? row?.lower ?? ""}
                  >
                    <option value="">{names ? "Pick one" : "Lineup needed"}</option>
                    {names ? (
                      <>
                        <option value="a">
                          {names[0]} ({a.name})
                        </option>
                        <option value="b">
                          {names[1]} ({b.name})
                        </option>
                      </>
                    ) : null}
                  </select>
                </div>
                <UnderdogForecast
                  id={`${a.id}-${b.id}-${game}-points`}
                  name={`${game}-points`}
                  initial={state.typed?.[`${game}-points`] ?? (row ? row.points.toFixed(1) : "")}
                />
              </div>
              {row ? null : <p className="ddd-note">Forecast needed</p>}
              {row && both && needsRecheck(row, both) ? (
                <p className="ddd-problem">The Lineup changed since this forecast was set. Check it, then save.</p>
              ) : null}
            </fieldset>
          );
        })}
        <div className="ddd-actions">
          <button type="submit" className="ddd-btn" disabled={saving || !both}>
            {saving ? "Saving…" : "Save forecasts"}
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
