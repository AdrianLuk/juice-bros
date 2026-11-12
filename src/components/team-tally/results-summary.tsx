import {
  finalPlaces,
  flightResults,
  openFlights,
  ordinal,
  type FlightResult,
  type OpenFlight,
} from "@/lib/team-tally/final-places";
import { teamName, type DocTeam, type TeamEventDoc } from "@/lib/team-tally/event-doc";

type Teams = Map<string, DocTeam>;

/**
 * Each Flight's champion with the score they took the Flight Matchup by,
 * Flight A first. A plate: the numbers are the point, and a Flight decided by
 * its Dreambreaker carries the same dim DB tag as the score bug. On a Score
 * Link the viewer's own Team takes the raised row. A Flight the Organizer
 * ended the night without (`open`) holds its row, dimmed, as not played out.
 */
export function ChampionsPlate({
  results,
  open = [],
  teams,
  myTeamId,
  size,
}: {
  results: FlightResult[];
  open?: OpenFlight[];
  teams: Teams;
  myTeamId?: string;
  size?: "tv";
}) {
  const rows = [
    ...results.map((result) => ({ letter: result.flightLetter, result })),
    ...open.map((flight) => ({ letter: flight.flightLetter, result: null })),
  ].sort((a, b) => a.letter.localeCompare(b.letter));
  return (
    <section className="tt-plate tt-champs" data-size={size} aria-label="Flight champions">
      <div className="tt-plate-bar">
        <span>Flight champions</span>
      </div>
      <ol className="tt-champ-list">
        {rows.map(({ letter, result }) => {
          if (!result) {
            return (
              <li key={`open-${letter}`} className="tt-champ-row" data-open>
                <span className="tt-champ-flight">
                  <span className="tt-champ-kicker">Flight</span> <span className="tt-champ-letter">{letter}</span>
                </span>
                <span className="tt-champ-who">
                  <span className="tt-champ-name">Not played out</span>
                </span>
              </li>
            );
          }
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
 * down two columns, places 1 to 7 and then 8 to 14. `flights` limits it to
 * one big-screen page of Flights, as a slice [from, to) of Flight indexes.
 */
export function FinalPlacesPlate({
  event,
  teams,
  myTeamId,
  size,
  flights,
}: {
  event: Pick<TeamEventDoc, "matchups">;
  teams: Teams;
  myTeamId?: string;
  size?: "tv";
  flights?: [number, number];
}) {
  const inPage = (first: number) => !flights || (first > flights[0] * 2 && first <= flights[1] * 2);
  // A Flight not played out is one row for its two blank places, in place order.
  const rows = [
    ...finalPlaces(event)
      .filter((place) => inPage(place.place))
      .map((place) => ({ first: place.place, place, blank: null })),
    ...openFlights(event)
      .filter((flight) => inPage(flight.places[0]))
      .map((flight) => ({ first: flight.places[0], place: null, blank: flight })),
  ].sort((a, b) => a.first - b.first);
  return (
    <section className="tt-plate tt-places" data-size={size} aria-label="Final places">
      <div className="tt-plate-bar">
        <span>Final places</span>
      </div>
      <ol className="tt-place-list" style={{ ["--tt-place-rows" as string]: Math.ceil(rows.length / 2) }}>
        {rows.map(({ place, blank }) =>
          blank ? (
            <li key={`open-${blank.flightLetter}`} className="tt-place-row" data-open>
              <span className="tt-place-num">
                <span className="sr-only">
                  {ordinal(blank.places[0])} and {ordinal(blank.places[1])}
                </span>
                <span aria-hidden>
                  {blank.places[0]}–{blank.places[1]}
                </span>
              </span>
              <span className="tt-place-who">
                <span className="tt-place-name">Flight {blank.flightLetter}</span>
                <small className="tt-place-role">Not played out</small>
              </span>
            </li>
          ) : (
            <li key={place!.teamId} className="tt-place-row" data-mine={place!.teamId === myTeamId || undefined}>
              <span className="tt-place-num">
                <span className="sr-only">{ordinal(place!.place)}</span>
                <span aria-hidden>{place!.place}</span>
              </span>
              <span className="tt-place-who">
                <span className="tt-place-name">{teamName(teams.get(place!.teamId)!)}</span>
                <small className="tt-place-role">
                  Flight {place!.flightLetter} {place!.role}
                </small>
              </span>
            </li>
          ),
        )}
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
      <ChampionsPlate results={flightResults(event)} open={openFlights(event)} teams={teams} myTeamId={myTeamId} />
      <FinalPlacesPlate event={event} teams={teams} myTeamId={myTeamId} />
    </div>
  );
}
