import { GAME_LABEL, LINEUP_GAMES, readLineup, type RawLineup } from "@/lib/ddd/lineup";
import { captainOf, formatAverage, formatRating, type StoredTeam } from "@/lib/ddd/roster";

type Team = StoredTeam & { lineup: RawLineup | null };

/** A Team's four Pairs, as saved. Nothing until the Lineup is in. No warnings: those are for Organizers. */
function TeamLineup({ team }: { team: Team }) {
  const lineup = readLineup(team.players, team.lineup);
  if (!lineup) return null;
  const name = (id: string | null) => team.players.find((player) => player.id === id)?.name ?? "–";
  return (
    <>
      <h3 className="ddd-slip-head">Lineup</h3>
      <ul className="ddd-lineup">
        {LINEUP_GAMES.map((game) => (
          <li key={game}>
            <span className="ddd-lineup-game">{GAME_LABEL[game]}</span>
            <span>
              {name(lineup[game][0])} &amp; {name(lineup[game][1])}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The 4 Teams with their players, Ratings, Average Rating and Lineup: what
 * the Public Link and Score Link show (issues #712, #713). Read only. The
 * Captain is the player named like the Team.
 */
export function RosterTeams({ teams }: { teams: Team[] }) {
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
            <TeamLineup team={team} />
          </section>
        );
      })}
    </div>
  );
}
