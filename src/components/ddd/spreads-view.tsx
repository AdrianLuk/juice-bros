import { courtTurns } from "@/lib/ddd/courts";
import type { LinkEvent } from "@/lib/ddd/events";
import { GAME_LABEL, readLineup, type LineupGame } from "@/lib/ddd/lineup";
import { duprSpread, forecast } from "@/lib/ddd/matchups";
import { pairings, pairPlayers } from "@/lib/ddd/spreads";
import { PairNames, TurnBand, Underdog } from "./pair";

type Team = LinkEvent["teams"][number];

/**
 * The Order of play: every Team pairing's four Games in the order they'd be
 * played, each Pair with its Forecast and the target that beats it. What the
 * Public Link and Score Link show until the Seeding is final; after that each
 * Matchup card carries its own. Each Game reads "Spread needed" until it is set.
 */
export function SpreadsView({ event }: { event: LinkEvent }) {
  if (event.teams.length < 2) return null;
  return (
    <section className="ddd-stack ddd-spreads-view" aria-labelledby="ddd-order-of-play">
      <h2 id="ddd-order-of-play" className="ddd-on-green ddd-band-head">
        Order of play
      </h2>
      {pairings(event.teams).map(([a, b]) => {
        const turns = courtTurns(readLineup(a.players, a.lineup), readLineup(b.players, b.lineup));
        return (
          <section key={`${a.id}-${b.id}`} className="ddd-slip ddd-pairing" aria-labelledby={`ddd-spread-${a.id}-${b.id}`}>
            <h3 id={`ddd-spread-${a.id}-${b.id}`} className="ddd-team-name">
              {a.name} v {b.name}
            </h3>
            <p className="ddd-fc-key" aria-hidden="true">
              Forecast
            </p>
            {turns.map((turn, index) => (
              <div key={turn.join()}>
                <TurnBand turn={index} />
                <ol className="ddd-games">
                  {turn.map((game) => (
                    <PairingGame key={game} event={event} a={a} b={b} game={game} />
                  ))}
                </ol>
              </div>
            ))}
          </section>
        );
      })}
    </section>
  );
}

function PairingGame({ event, a, b, game }: { event: LinkEvent; a: Team; b: Team; game: LineupGame }) {
  const row = event.spreads.find((each) => each.teamA === a.id && each.teamB === b.id && each.game === game);
  return (
    <li className="ddd-game" aria-label={GAME_LABEL[game]}>
      <p className="ddd-db-status">
        <span>
          {GAME_LABEL[game]}
          {row ? <span className="ddd-spread">Spread {duprSpread(Number(row.points))}</span> : null}
        </span>
      </p>
      <ul className="ddd-pairs">
        {([a, b] as const).map((team, i) => {
          const lower = row ? (row.lower === "a") === (i === 0) : false;
          const fc = row ? forecast(lower, Number(row.points)) : null;
          return (
            <li key={team.id} className="ddd-pair-row">
              <span className="ddd-db-team">
                <PairNames names={pairPlayers(team, game)} />
                <span className="ddd-pair-team">
                  {team.name}
                  {/* Beside the Team, not under the Goal, so both Pairs' right columns stay the same height. */}
                  {lower ? <Underdog /> : null}
                </span>
              </span>
              {fc ? (
                <span className="ddd-fc-side">
                  <span className="ddd-fc-n">
                    <span className="ddd-sr">Forecast </span>
                    {fc.points}
                  </span>
                  <span className="ddd-fc-target">Goal: {fc.target}</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {row ? null : <p className="ddd-note">Forecast needed</p>}
    </li>
  );
}
