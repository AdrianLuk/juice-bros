import { GAME_LABEL, LINEUP_GAMES } from "@/lib/ddd/lineup";
import type { LinkEvent } from "@/lib/ddd/events";
import { lineupsOf, pairName, pairings } from "@/lib/ddd/spreads";

/**
 * Every Team pairing's four Spreads, read only: what the Public Link and
 * Score Link show (issue #714). Each reads "Spread needed" until it is set.
 */
export function SpreadsView({ event }: { event: LinkEvent }) {
  const raw = Object.fromEntries(event.teams.map((team) => [team.id, team.lineup]));
  if (event.teams.length < 2) return null;
  return (
    <div className="ddd-stack-lg">
      {pairings(event.teams).map(([a, b]) => {
        const both = lineupsOf(a, b, raw);
        return (
          <section key={`${a.id}-${b.id}`} className="ddd-slip ddd-section" aria-labelledby={`ddd-spread-${a.id}-${b.id}`}>
            <h2 id={`ddd-spread-${a.id}-${b.id}`} className="ddd-team-name">
              {a.name} v {b.name}
            </h2>
            <ul className="ddd-lineup">
              {LINEUP_GAMES.map((game) => {
                const row = event.spreads.find((each) => each.teamA === a.id && each.teamB === b.id && each.game === game);
                const pa = both ? pairName(a.players, both[0], game) : null;
                const pb = both ? pairName(b.players, both[1], game) : null;
                const lowerName = row ? (row.lower === "a" ? pa : pb) : null;
                return (
                  <li key={game}>
                    <span className="ddd-lineup-game">{GAME_LABEL[game]}</span>
                    <span>{pa && pb ? `${pa} v ${pb}` : "Lineup needed"}</span>
                    <span>{row ? `Spread ${row.points.toFixed(1)} on ${lowerName ?? "the lower-rated Pair"}` : "Spread needed"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
