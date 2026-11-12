import type { PoolStandings } from "@/components/apps/match-mixer/lib/live/night";

/** "+4", "0", "−2": a real minus, so the column lines up. */
function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${-n}`;
  return "0";
}

/**
 * Standings (#688): one table per Pool, never one across them (ADR 0004).
 * Ranked by wins, then point differential, then head-to-head; a shared rank
 * prints once, with the rows level with it left blank.
 */
export function StandingsTables({ standings, pairs }: { standings: readonly PoolStandings[]; pairs: boolean }) {
  return (
    <section aria-labelledby="mm-standings-heading" className="mt-10">
      <h2 id="mm-standings-heading" className="mm-legend mm-rail">
        Standings
      </h2>
      <p className="mm-note mt-2">Wins first, then points won minus points lost, then who beat whom.</p>
      <div className="mm-standings mt-4">
        {standings.map((pool, index) => (
          <table key={index} className="mm-table">
            {pool.label ? <caption className="mm-table-caption">{pool.label}</caption> : null}
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Rank</span>
                </th>
                <th scope="col">{pairs ? "Pair" : "Player"}</th>
                <th scope="col">
                  <abbr title="Won">W</abbr>
                </th>
                <th scope="col">
                  <abbr title="Lost">L</abbr>
                </th>
                <th scope="col">
                  <abbr title="Points won minus points lost">+/&minus;</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {pool.rows.map((row, position) => (
                <tr key={row.players.join("-")}>
                  <td className="mm-table-rank">
                    {position > 0 && pool.rows[position - 1].rank === row.rank ? (
                      <span className="sr-only">{row.rank}</span>
                    ) : (
                      row.rank
                    )}
                  </td>
                  <th scope="row" className="mm-table-name">
                    {row.name}
                  </th>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{signed(row.pointDiff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}
