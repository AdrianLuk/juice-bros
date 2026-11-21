import { captainOf, formatAverage, formatRating, type StoredTeam } from "@/lib/ddd/roster";

/**
 * The 4 Teams with their players, Ratings and Average Rating: what the
 * Public Link and Score Link show (issue #712). Read only. The Captain is
 * the player named like the Team.
 */
export function RosterTeams({ teams }: { teams: StoredTeam[] }) {
  if (teams.length === 0) return null;
  return (
    <div className="ddd-stack-lg">
      {teams.map((team) => {
        const captain = captainOf(team);
        return (
          <section key={team.id} className="ddd-slip ddd-section" aria-labelledby={`ddd-team-${team.id}`}>
            <h2 id={`ddd-team-${team.id}`} className="ddd-team-name">
              {team.name}
            </h2>
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
                {team.players.map((player) => (
                  <tr key={player.id}>
                    <th scope="row">
                      {player.name}
                      <span className="ddd-gender"> {player.gender}</span>
                      {player === captain ? <span className="ddd-captain">Captain</span> : null}
                    </th>
                    <td>{formatRating(player.dupr, "dupr")}</td>
                    <td>{formatRating(player.duar, "duar")}</td>
                    <td>{formatRating(player.dusr, "dusr")}</td>
                    <td>{formatAverage(player)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
