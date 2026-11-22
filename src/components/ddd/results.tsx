"use client";

import type { LiveReader } from "@/lib/ddd/actions/live";
import { seedTeams } from "@/lib/ddd/dreambreakers";
import { PLACES, type LinkEvent } from "@/lib/ddd/events";
import { doublesMatchups, finalPlaces, shotTotals } from "@/lib/ddd/matchups";
import { shotWord } from "./matchups";
import { useDddLive } from "./use-ddd-live";

/**
 * The results on the Public Link (#718), for the TV at dinner: each Final
 * place with its Team, its Punishment and the shots the Team ran up. Before
 * the Playoff is decided it shows what each place will drink.
 */
export function Results({ reader, initial }: { reader: LiveReader; initial: LinkEvent }) {
  const { event } = useDddLive(reader, initial);
  const teamIds = event.teams.map((team) => team.id);
  const seeds = seedTeams(teamIds, event.dreambreakers, event.tieOrder);
  const matchups = doublesMatchups(seeds, { spreads: event.spreads, games: event.games, calls: event.calls });
  const places = finalPlaces(matchups);
  const totals = shotTotals(teamIds, matchups);
  const nameOf = (id: string) => event.teams.find((team) => team.id === id)?.name ?? "";

  return (
    <section className="ddd-results" aria-labelledby="ddd-results-head">
      <h2 id="ddd-results-head" className="ddd-on-green ddd-band-head">
        Final places
      </h2>
      {places ? null : <p className="ddd-results-wait">The Teams land here once both Playoff Matchups are decided.</p>}
      <ol className="ddd-results-list">
        {event.punishments.map((punishment, index) => {
          const id = places?.[index];
          return (
            <li key={PLACES[index]} className="ddd-result" aria-label={`${PLACES[index]} place`}>
              <span className="ddd-result-n" aria-hidden>
                {index + 1}
              </span>
              <div>
                <p className={id ? "ddd-result-team" : "ddd-result-team ddd-result-pending"}>{id ? nameOf(id) : PLACES[index]}</p>
                <p className="ddd-result-punishment">{punishment}</p>
              </div>
              {id ? (
                <p className="ddd-result-shots">
                  <span className="ddd-result-shots-n">{totals[id]}</span> {shotWord(totals[id])}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
