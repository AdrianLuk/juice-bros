# Grill: Dink Dine & Drink (DDD) app

Live record of a `/grilling` + `/domain-modeling` session (the `/grill-with-docs` pair),
started 2026-11-20. Any session can pick this up: read this file, then ask the next
open question. Questions go **one at a time**. Settled terms live in
`dink-dine-drink/CONTEXT.md`.

Next event: **2026-11-28**. This year's teams and captains are already drafted.

## The spec as given (2026-11-20)

- Event with friends: Dink Dine & Drink. Scoring similar to Team Tally, different format.
- Input players, teams, captains (today they live in a spreadsheet).
- Each player has 3 ratings: DUPR (standard), DUAR (alcohol), DUSR (singing). An average
  rating column is the mean of the three.
- Draft night (on a video call) currently updates the spreadsheet live; the app should
  replace it so everyone sees who is drafted to which team. Not needed for 2026-11-28.
- Game day: dashboard like Team Tally. Everyone or captains enter scores; live standings
  everyone can see.
- A couple of courts are blocked off; organizer(s) assign courts.
- Round 1: MLP-style Dreambreaker, singles, rotating every 3 points, to seed the 4 teams.
  Matchups pair highest DUPR vs highest DUPR, 2nd vs 2nd, and so on.
- Round 2: seed 1 vs 4, seed 2 vs 3, normal MLP format: 2 gendered doubles + 2 mixed
  doubles.
- Playoff round: same 4-game format, decides winners and final standings.
- Final standings decide drinking punishments: organizers set drinks per team, editable
  later.
- Spread from DUPR forecast: e.g. a 3.5 pair may only need more than 5.5 points against a
  4.5 pair in a game to 11 to win that game. The difference between actual score and the
  spread = shots of soju to drink.
- Godfrey audits DUPR spreads: he enters the forecast per match after captains submit
  their MLP lineups, before the event.
- 4 teams of about 6 players for 2026-11-28.

## Facts found in the repo

- Team Tally (`team-tally/CONTEXT.md`) was designed for one format and says other team
  formats ("MLP-style gender doubles, for one") are a reason to add a second Format later.
- Reusable pieces: site sign-in, token Score Links / Public Link pattern, the shared court
  grid and saved Venues, TanStack Query sync (`use-team-event-sync.ts`).
- Team Tally stores a night as plain tables, derived standings computed on read (ADR 0001).
- `CONTEXT-MAP.md` lists word collisions (Game, Round, Matchup, Organizer, Dreambreaker…)
  that DDD's glossary must avoid or reuse deliberately.

## Decisions

- **D1 (Q1): A separate app, not a Format in Team Tally.** Its own context, data and
  route (working name `/tools/dink-dine-drink`). It reuses Team Tally's building blocks
  (site sign-in, token links, public page, court grid/Venues) by copying patterns, not by
  sharing Team Tally's tables. Team Tally stays one-format.
- **D2 (Q2): Scope for 2026-11-28.** Must work: roster entry (players, teams, captains,
  three ratings), lineup submission, spread entry, scoring with soju shots, live standings,
  court assignment, punishments. After 2026-11-28: the live draft-night screen.
  **Roster entry has to work days before the event**, so Godfrey can enter spreads ahead
  of time rather than on the day. The spreadsheet is coming from Adrian later (shapes Q3/Q4).
- **D3 (Q5): One fixed lineup per team for the whole day.** Each team names its men's
  doubles, women's doubles and two mixed doubles pairs once; the same pairs play Round 2
  and the playoff. No changes on the day. Godfrey enters a spread for every possible
  pairing before the event: 6 team pairings x 4 games = 24 spreads, and the app uses the
  right ones once seeds are known. **Captains' lineup deadline: Sunday 2026-11-22.**
- **D4 (Q13): Lineups go through the group chat for 2026-11-28.** Captains post them by
  Sunday; Godfrey works out spreads from the chat in DUPR's forecast tool. The first ship
  (roster, lineups, spreads, all organizer-entered) targets ~Tue 2026-11-24; organizers
  type the lineups in and Godfrey types the 24 spreads in. A captain lineup screen moves
  to after 2026-11-28.
- **D5 (Q6): Round 1 is a Dreambreaker round robin.** Every Team plays every other Team
  once: 6 singles Dreambreakers, run 2 at a time on the 2 courts (3 waves).
- **D6 (Q14, part 1): Dreambreaker score.** Rally to 21, win by 1, freeze at 20 (at 20 a
  side can only win the last point on its own serve). A valid final is 21 to 0..20.
- **D7 (Q14, parts 2-3): Rotation is guidance; only the final score is entered.** The court
  card shows each Team's DUPR-ordered Rotation (each Team cycles its own list), and it can
  be changed on the day. Nobody enters rally by rally.
- **D8 (Q15): Seeding.** Wins; then head-to-head if exactly two Teams tie; then point
  difference across the three Dreambreakers; then total points; then the Organizer's call.
  Standings name the rule that decided each place (same shape as Team Tally's).
- **D9 (Q16): Dreambreakers have no Spread and no soju shots.** Straight-up score, seeding
  only. Matches past DDDs.
- **D10 (Q17): Game and Spread maths.** Doubles Games are side-out to 11, win by 2. Measure
  the lower-rated Pair's points against the Spread, always (even 13-11). The Pair that
  loses against the Spread puts the gap, rounded up, on its **Team's** shot count
  (corrected 2026-11-21: counted against the Team, not each player). Spreads end in .5.
- **D11 (Q18): A 2-2 Matchup is decided by total Spread margin** (as past DDDs did, not a
  Dreambreaker). Per Game a Team's margin is the unrounded gap to the Spread, positive when
  its Pair was the Spread winner. Sum over the four Games; larger total wins.
- **D12 (Q19, PROVISIONAL): Spread margins tied → total raw points → Organizer's call.**
  Adrian will confirm with the group. Build it so an Organizer can always override the
  winner of a 2-2 Matchup and record why.
- **D13 (Q20, part 1): People.** Lilliana is the main organizer. Certain people (Godfrey,
  for one) can also set up events and rosters. Adrian gets god mode (a Superadmin, like
  Team Tally's: can do anything on any event). Setting up events implies signing in.
- **D14 (Q20, part 2): One DDD Organizer list for every event.** DDDs happen several times
  a year. Anyone on the list can create and edit any DDD; Organizers add others by invite
  link (sign in with Google, then on the list). Not per-event ownership.
- **D15 (Q20, part 3): One shared Score Link per DDD**, plus a read-only Public Link.
  Anyone with the Score Link can enter any score; Organizers can fix any score. "It's not
  the most serious thing in the world."
- **D16 (Q21): Playoff.** Round 2 winners play for 1st/2nd, Round 2 losers for 3rd/4th,
  one Matchup per court, same 4-Game format with Spreads from Godfrey's 24.

## Open questions (asked in this order)

1. ~~New app or a Format in Team Tally?~~ Settled: D1.
2. ~~What must be ready for 2026-11-28?~~ Settled: D2.
3. Roster input format: paste spreadsheet rows? Gender column? ← **waiting on the
   spreadsheet**
4. Rating scales for DUAR/DUSR ← **waiting on the spreadsheet**
5. ~~Spreads before the day vs. opponents unknown until Round 1.~~ Round 2 opponents come
   from Round 1 seeding, playoff opponents from Round 2, both on the day. How can Godfrey
   enter spreads beforehand? Recommended: one fixed lineup per team for the day, Godfrey
   enters spreads for all 6 possible team pairings x 4 games = 24 numbers, the app picks
   the right ones. Settled: D3.
6. ~~Round 1 Dreambreaker: which teams play which~~ Settled: D5.
14. ~~Dreambreaker scoring and rotation~~ Settled: D6, D7.
15. ~~Seeding: ranking and ties~~ Settled: D8.
16. ~~Does a Dreambreaker carry a Spread or soju shots?~~ Settled: D9.
17. ~~Doubles Game and Spread maths~~ Settled: D10.
18. ~~Matchup winner and a 2-2 tie~~ Settled: D11.
19. **A 2-2 Matchup whose Spread margins also tie** (e.g. +2.5 +1.5 -3.5 -0.5 = 0; Soju
   shot totals tie too in that case). Settled provisionally: D12.
20. **Roles and links: who can enter what, and how they get in (Godfrey especially).**
   Settled: D13, D14, D15.
21. **Final places from the playoff round** (Round 2 winners play for 1st/2nd, losers for
   3rd/4th?). Settled: D16.
22. **Punishments per Final place and how Soju shot counts show.** ← **asked, awaiting
   answer** (old item 12)
7. Round 2 / playoff: 2-2 tiebreak → now item 18.
8. Spread maths → settled D10.
9. Lineups: limits per player (can one player be in two pairs? must everyone play?),
   who sees them before the day.
13. ~~How do lineups reach the app by Sunday 2026-11-22?~~ Settled: D4. Recommended was:
   captains send lineups in the group chat; the captain lineup screen moves out of the
   Nov 28 scope; Godfrey works off the chat in DUPR's forecast tool; the first ship
   (roster + lineups + spreads, organizer-entered) lands ~Tue 2026-11-24 and Godfrey types
   the 24 spreads in.
10. Roles and links: Organizer, Organizer Link for co-organizers (Godfrey), one shared
   Score Link vs per-team, Public Link.
11. Courts: how many, one court per matchup?
12. Punishments by final place; soju leaderboard?
