import { liveRound, matchupLabel, teamName, type DocMatchup, type DocTeam } from "@/lib/team-tally/event-doc";
import { matchupWinnerId, needsDreambreaker } from "@/lib/team-tally/matchup-done";
import { bugRows } from "@/lib/team-tally/score-bug";
import { ScoreBug } from "./score-bug";

/**
 * A Matchup from the live document as its score bug, red first, each Team's
 * two Games on their own rows, live Round underlined. Done, it carries the FINAL bar naming the winner (a Flight's,
 * its champion); a tie settled by a Dreambreaker tags who won it.
 */
export function MatchupBug({ matchup, teams }: { matchup: DocMatchup; teams: Map<string, DocTeam> }) {
  const done = matchup.doneAt !== null;
  const winner = matchupWinnerId(matchup);
  const settledByDreambreaker = needsDreambreaker(matchup);

  const side = (teamId: string, color: "red" | "blue") => ({
    name: teamName(teams.get(teamId)!),
    rows: bugRows(matchup.games, color),
    dreambreaker: settledByDreambreaker && winner === teamId,
  });

  let final: string | undefined;
  if (done && winner) {
    const name = teamName(teams.get(winner)!);
    final = matchup.stage === "flight" ? `Flight ${matchup.flightLetter} champion · ${name}` : `Winner · ${name}`;
  }

  return (
    <ScoreBug
      label={matchupLabel(matchup)}
      liveRound={done ? undefined : liveRound(matchup)}
      final={final}
      red={side(matchup.redTeamId, "red")}
      blue={side(matchup.blueTeamId, "blue")}
    />
  );
}
