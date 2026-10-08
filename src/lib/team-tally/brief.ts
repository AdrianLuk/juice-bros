/**
 * Writes the Brief: the message an Organizer pastes into the group chat before
 * a Team Event (team-tally/CONTEXT.md, issue #622).
 *
 * The wording, emoji and punctuation are the Organizer's own, copied from the
 * brief they already send by hand, and are kept exactly. That includes their
 * em-dashes: the site's "no em-dashes" copy rule covers Team Tally's own UI,
 * not text written in someone else's voice. The only lines Team Tally adds are
 * the Public Link (once, under TEAM MATCHUPS) and each Team's Score Link (under
 * its roster).
 *
 * Pure and relative-import-only, so `node --test` loads it directly.
 */

export type BriefTeam = {
  captain: string;
  slotA: string;
  slotB: string;
  slotC: string;
  /** Printed in quotes after the captain. Null or blank prints no quoted part. */
  nickname: string | null;
  homeCourt: string;
  scoreLink: string;
};

/** One opening Matchup, in the order the Brief numbers them (MATCH 1, 2...). */
export type BriefMatchup = {
  /** Printed first, with 🔴. */
  red: BriefTeam;
  /** Printed second, with 🔵. */
  blue: BriefTeam;
};

export type BriefInput = {
  matchups: BriefMatchup[];
  publicLink: string;
};

/** The Organizer's letter emoji for Flights A to G (a 14-Team night has 7). */
const FLIGHT_EMOJI = ["🅰️", "🅱️", "🅲", "🅳", "🅴", "🅵", "🅶"];

const FLIGHT_LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

const OPENING = `🏓🔥 PICKLEBALL TEAM EVENT 🔥🏓
Get ready for an evening of teamwork, competition, and fun! 🎉

🕖 ARRIVAL • WARM-UP • TEAM MEET-UP
Please arrive by 7:00 PM!
When you arrive:

👋 Meet your teammates
🏓 Warm up and get some practice in
📍 Find your assigned court and team
🤝 Get organized and ready for your first round

Please make sure your entire team is ready to go so we can keep the event running smoothly and on schedule.

👥 TEAM MATCHUPS`;

const FORMAT = `🔄 ROUND FORMAT
Each team matchup consists of 3 rounds, with games played simultaneously on two courts.
The Captain will partner with each teammate once and will always play against the opposing Captain.

🏓 COURT 1 — Captain Matches
Round 1: Captain + Player A 🆚 Opposing Captain + Player A
Round 2: Captain + Player B 🆚 Opposing Captain + Player B
Round 3: Captain + Player C 🆚 Opposing Captain + Player C
🏓 COURT 2 — Teammate Matches
In each round, the remaining two players from each team will play against the remaining two players from the opposing team.
📊 Scores from both courts are combined after each round to determine the team's total score.

⏱️ GAME FORMAT
🎯 First to 11 points, win by 2
⏰ OR 15-minute time limit — whichever comes first

🏆 FLIGHTS
After all team scores are totaled:`;

const CLOSING = `⚡ TIEBREAKER — DREAMBREAKER
If teams are tied, a Dreambreaker will be played.
Captains/coaches will select the singles order, with players rotating through singles play.

🏆 FLIGHT CHAMPIONSHIPS
Once teams are placed into their respective flights, the same 3-round team format will be used to determine the winner of each flight.
🔥 LET'S PLAY!
Come ready to:
🏓 COMPETE
🤝 SUPPORT YOUR TEAM
🎉 HAVE FUN
👋 MEET NEW PEOPLE
💪 BRING YOUR BEST GAME!

Good luck to everyone!

🏓🔥 LET THE GAMES BEGIN! 🔥🏆`;

function teamBlock(marker: string, team: BriefTeam): string {
  const nickname = team.nickname?.trim();
  const heading = nickname
    ? `${marker} Team ${team.captain} — “${nickname}”`
    : `${marker} Team ${team.captain}`;

  return [
    heading,
    `Court ${team.homeCourt}`,
    [team.captain, team.slotA, team.slotB, team.slotC].join(" • "),
    `🔗 Score link: ${team.scoreLink}`,
  ].join("\n");
}

function matchupBlock(matchup: BriefMatchup, index: number): string {
  return [
    `🏓 MATCH ${index + 1} — Courts ${matchup.red.homeCourt} & ${matchup.blue.homeCourt}`,
    teamBlock("🔴", matchup.red),
    "🆚",
    "",
    teamBlock("🔵", matchup.blue),
  ].join("\n");
}

/** One line per Flight: as many Flights as opening Matchups. */
function flightLines(flightCount: number): string {
  return Array.from({ length: flightCount }, (_, index) => {
    const rank = index === 0 ? "Top" : "Next";
    return `${FLIGHT_EMOJI[index]} ${rank} 2 teams → Flight ${FLIGHT_LETTERS[index]}`;
  }).join("\n");
}

export function generateBrief({ matchups, publicLink }: BriefInput): string {
  return [
    OPENING,
    `📺 Live standings: ${publicLink}`,
    "",
    ...matchups.map((matchup, index) => `${matchupBlock(matchup, index)}\n`),
    FORMAT,
    flightLines(matchups.length),
    "",
    CLOSING,
  ].join("\n");
}
