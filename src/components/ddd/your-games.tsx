"use client";

import { useSyncExternalStore } from "react";

import { STATUS_LABEL } from "@/lib/ddd/dreambreakers";
import type { LinkEvent } from "@/lib/ddd/events";
import { GAME_LABEL, readLineup } from "@/lib/ddd/lineup";
import { duprSpread, forecast, type Matchup } from "@/lib/ddd/matchups";
import { myGames, type MyGame } from "@/lib/ddd/my-games";
import { Underdog } from "./pair";

// Who this phone is, per DDD. Kept in the browser only: no account, nothing sent anywhere.
const CHANGED = "ddd-me";
const keyOf = (eventId: string) => `ddd-me:${eventId}`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function read(eventId: string): string | null {
  try {
    return localStorage.getItem(keyOf(eventId));
  } catch {
    return null; // storage blocked (private mode): the picker just asks again
  }
}

function remember(eventId: string, playerId: string | null) {
  try {
    if (playerId) localStorage.setItem(keyOf(eventId), playerId);
    else localStorage.removeItem(keyOf(eventId));
  } catch {
    // shortcut: storage blocked means the choice lasts until the page reloads, which is fine for one evening
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * "Your games": pick your name once and this phone pins your doubles Games
 * at the top, each with its court, partner, opponents and Goal. Only from
 * Round 2, when the Games are known.
 */
export function YourGames({ event, matchups }: { event: LinkEvent; matchups: Matchup[] }) {
  // Server render and first paint have no storage: show the picker until the browser says otherwise.
  const me = useSyncExternalStore(subscribe, () => read(event.id), () => null);
  const player = me ? event.teams.flatMap((team) => team.players).find((each) => each.id === me) : undefined;

  if (!player) {
    return (
      <section className="ddd-slip ddd-section ddd-mine" aria-labelledby="ddd-mine">
        <h2 id="ddd-mine" className="ddd-team-name">
          Your games
        </h2>
        <div className="ddd-field">
          <label htmlFor="ddd-me">Who are you?</label>
          <select id="ddd-me" value="" onChange={(change) => remember(event.id, change.target.value || null)}>
            <option value="">Pick your name</option>
            {event.teams.map((team) => (
              <optgroup key={team.id} label={team.name}>
                {team.players.map((each) => (
                  <option key={each.id} value={each.id}>
                    {each.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <p className="ddd-note">This phone remembers it. Your Games and Goals then sit at the top.</p>
      </section>
    );
  }

  const teams = event.teams.map((team) => ({ ...team, lineup: readLineup(team.players, team.lineup) }));
  const games = myGames(player.id, teams, matchups, event.courtPlans, event.courts.length);

  return (
    <section className="ddd-slip ddd-section ddd-mine" aria-labelledby="ddd-mine">
      <div className="ddd-mine-head">
        <h2 id="ddd-mine" className="ddd-team-name">
          {player.name}
        </h2>
        <button type="button" className="ddd-quiet" onClick={() => remember(event.id, null)}>
          Not you?
        </button>
      </div>
      {games.length === 0 ? (
        <p className="ddd-note">No doubles Games for you yet.</p>
      ) : (
        <ol className="ddd-mine-games">
          {games.map((game) => (
            <MineGame key={`${game.game}-${game.opponentTeam}`} game={game} courts={event.courts} />
          ))}
        </ol>
      )}
    </section>
  );
}

function MineGame({ game, courts }: { game: MyGame; courts: string[] }) {
  const court = courts[game.court] ?? String(game.court + 1);
  const fc = game.forecast ? forecast(game.forecast.lower, game.forecast.points) : null;
  const underdog = game.forecast ? game.forecast.points.toFixed(1) : null;
  return (
    <li className={`ddd-mine-game ddd-mine-${game.status}`} aria-label={GAME_LABEL[game.game]}>
      <p className="ddd-mine-when">
        {STATUS_LABEL[game.status]} · Court {court} · {GAME_LABEL[game.game]}
      </p>
      <p className="ddd-mine-who">
        With <b>{game.partners.join(" and ") || "–"}</b> v <b>{game.opponents.join(" / ") || game.opponentTeam}</b>
      </p>
      {game.score ? (
        <p className="ddd-mine-result">
          {game.score[0]}-{game.score[1]} · {game.beat ? "You beat the forecast" : "Missed the forecast"}
        </p>
      ) : fc && game.forecast ? (
        <>
          <p className="ddd-mine-goal">
            <span>Goal:</span> <b>{fc.target}</b>
            {game.forecast.lower ? <Underdog /> : null}
          </p>
          <p className="ddd-note">
            Forecast {game.forecast.lower ? `${underdog} to 11` : `11 to ${underdog}`} · Spread {duprSpread(game.forecast.points)}
          </p>
        </>
      ) : (
        <p className="ddd-note">Forecast needed</p>
      )}
    </li>
  );
}
