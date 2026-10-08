import { finalPlaces, flightResults, ordinal, type FlightResult } from "@/lib/team-tally/final-places";
import { teamName, type DocTeam, type TeamEventDoc } from "@/lib/team-tally/event-doc";

type Teams = Map<string, DocTeam>;

/**
 * Each Flight's champion with the score they took the Flight Matchup by,
 * Flight A first. A plate: the numbers are the point, and a Flight decided by
 * its Dreambreaker carries the same dim DB tag as the score bug. On a Score
 * Link the viewer's own Team takes the raised row.
 */
export function ChampionsPlate({
  results,
  teams,
  myTeamId,
  size,
}: {
  results: FlightResult[];
  teams: Teams;
  myTeamId?: string;
  size?: "tv";
}) {
  return (
    <section className="tt-plate tt-champs" data-size={size} aria-label="Flight champions">
      <div className="tt-plate-bar">
        <span>Flight champions</span>
      </div>
      <ol className="tt-champ-list">
        {results.map((result) => {
          const champion = teams.get(result.championId)!;
          const runnerUp = teams.get(result.runnerUpId)!;
          return (
            <li key={result.matchupId} className="tt-champ-row" data-mine={result.championId === myTeamId || undefined}>
              <span className="tt-champ-flight">
                <span className="tt-champ-kicker">Flight</span>{" "}
                <span className="tt-champ-letter">{result.flightLetter}</span>
              </span>
              <span className="tt-champ-who">
                <span className="tt-champ-name">{teamName(champion)}</span>
                <small className="tt-champ-beat">Beat {teamName(runnerUp)}</small>
              </span>
              <span className="tt-champ-score">
                <span className="sr-only">
                  {result.championScore} to {result.runnerUpScore}
                  {result.decidedByDreambreaker ? ", won the Dreambreaker" : ""}
                </span>
                <span aria-hidden>
                  {result.championScore}–{result.runnerUpScore}
                </span>
                {result.decidedByDreambreaker && (
                  <span aria-hidden className="tt-bug-mark">
                    DB
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Final places: Flight A's champion first, its runner-up second, Flight B's
 * champion third, and down. One row per Team. On the big screen the list runs
 * down two columns, places 1 to 7 and then 8 to 14.
 */
export function FinalPlacesPlate({
  event,
  teams,
  myTeamId,
  size,
}: {
  event: Pick<TeamEventDoc, "matchups">;
  teams: Teams;
  myTeamId?: string;
  size?: "tv";
}) {
  const places = finalPlaces(event);
  return (
    <section className="tt-plate tt-places" data-size={size} aria-label="Final places">
      <div className="tt-plate-bar">
        <span>Final places</span>
      </div>
      <ol className="tt-place-list" style={{ ["--tt-place-rows" as string]: Math.ceil(places.length / 2) }}>
        {places.map((place) => (
          <li key={place.teamId} className="tt-place-row" data-mine={place.teamId === myTeamId || undefined}>
            <span className="tt-place-num">
              <span className="sr-only">{ordinal(place.place)}</span>
              <span aria-hidden>{place.place}</span>
            </span>
            <span className="tt-place-who">
              <span className="tt-place-name">{teamName(teams.get(place.teamId)!)}</span>
              <small className="tt-place-role">
                Flight {place.flightLetter} {place.role}
              </small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The summary the results page leads with: the champions, then Final places. */
export function ResultsSummary({
  event,
  teams,
  myTeamId,
}: {
  event: TeamEventDoc;
  teams: Teams;
  myTeamId?: string;
}) {
  return (
    <div className="tt-results">
      <ChampionsPlate results={flightResults(event)} teams={teams} myTeamId={myTeamId} />
      <FinalPlacesPlate event={event} teams={teams} myTeamId={myTeamId} />
    </div>
  );
}
