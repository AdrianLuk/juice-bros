import { liveRound, matchupLabel, roundPoints, teamName, type DocMatchup, type DocTeam } from "@/lib/team-tally/event-doc";
import { ScoreBug } from "./score-bug";

/** A Matchup from the live document as its score bug, red first, live Round underlined. */
export function MatchupBug({ matchup, teams }: { matchup: DocMatchup; teams: Map<string, DocTeam> }) {
  const side = (teamId: string, color: "red" | "blue") => {
    const rounds = roundPoints(matchup, color);
    return {
      name: teamName(teams.get(teamId)!),
      rounds,
      total: rounds.reduce<number>((sum, points) => sum + (points ?? 0), 0),
    };
  };

  return (
    <ScoreBug
      label={matchupLabel(matchup)}
      liveRound={liveRound(matchup)}
      red={side(matchup.redTeamId, "red")}
      blue={side(matchup.blueTeamId, "blue")}
    />
  );
}
