import { teamName, type DocMatchup, type DocTeam } from "@/lib/team-tally/event-doc";
import { matchupWinnerId } from "@/lib/team-tally/matchup-done";

/**
 * The Flight hand-off (issue #624): the moment fifty people look for their
 * new courts, so the Flight letter and its court pair are the biggest type on
 * the page. A navy plate like every graphic: the bar names the Flight and its
 * courts at display size, then one row per Team (its seed, side stripe, name
 * and the court it meets on). On a Score Link the viewer's own row takes the
 * raised plate and its court sits on the ball-yellow "you" chip, the same
 * chip as your position in the tower. A Flight done names its champion.
 */
export function FlightHandoff({
  flight,
  teams,
  myTeamId,
  size = "hero",
}: {
  flight: DocMatchup;
  teams: Map<string, DocTeam>;
  myTeamId?: string;
  size?: "hero" | "compact";
}) {
  const [courtOne, courtTwo] = flight.courtPair;
  const seed = (flight.number - 1) * 2;
  const winner = flight.doneAt ? matchupWinnerId(flight) : null;
  const label = `Flight ${flight.flightLetter} · Courts ${courtOne} & ${courtTwo}`;

  const rows = [
    { teamId: flight.redTeamId, side: "red" as const, court: courtOne, seed: seed + 1 },
    { teamId: flight.blueTeamId, side: "blue" as const, court: courtTwo, seed: seed + 2 },
  ];

  return (
    <section className="tt-plate tt-handoff" data-size={size} aria-label={label}>
      <div className="tt-handoff-head">
        <span className="tt-handoff-stack">
          <span className="tt-handoff-kicker">Flight</span>
          <span className="tt-handoff-letter">{flight.flightLetter}</span>
        </span>
        <span className="tt-handoff-stack tt-handoff-courts">
          <span className="tt-handoff-kicker">Courts</span>
          <span className="tt-handoff-pair">
            {courtOne} <span className="tt-handoff-amp">&amp;</span> {courtTwo}
          </span>
        </span>
      </div>
      <ol className="tt-handoff-teams" aria-label={`Flight ${flight.flightLetter} Teams`}>
        {rows.map((row) => {
          const team = teams.get(row.teamId)!;
          const mine = row.teamId === myTeamId;
          return (
            <li key={row.teamId} className="tt-handoff-row" data-mine={mine || undefined}>
              <span className="tt-handoff-seed">
                <span className="sr-only">Seed </span>
                {row.seed}
              </span>
              <span aria-hidden className={`tt-tower-chip ${row.side === "red" ? "tt-side-red" : "tt-side-blue"}`} />
              <span className="tt-handoff-name">
                <span className="tt-bug-name">{teamName(team)}</span>
                {winner === row.teamId && <span className="tt-bug-mark">Champion</span>}
              </span>
              <span className="tt-handoff-court">
                <span className="tt-handoff-court-label">{mine ? "Your court" : "Court"}</span>
                <span className="tt-handoff-court-num">{row.court}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
