# Grill: Dink Dine & Drink (DDD) app

Live record of a `/grilling` + `/domain-modeling` session (the `/grill-with-docs` pair),
started 2026-11-20. Any session can pick this up: read this file, then ask the next
open question. Questions go **one at a time**. Settled terms move into the app's
`CONTEXT.md` once its name and folder are settled (Q1).

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
6. Round 1 Dreambreaker: which teams play which, how 4 seeds come out, scoring (rally to
   21?), pairing when rosters differ in size. Does it have a spread?
7. Round 2 / playoff: 2-2 tiebreak in a 4-game matchup.
8. Spread: who drinks, rounding, win-by-2 games, does every game get a spread.
9. Lineups: limits per player (can one player be in two pairs? must everyone play?),
   who sees them before the day.
13. **How do lineups reach the app by Sunday 2026-11-22, a day from now?** Recommended:
   captains send lineups in the group chat; the captain lineup screen moves out of the
   Nov 28 scope; Godfrey works off the chat in DUPR's forecast tool; the first ship
   (roster + lineups + spreads, organizer-entered) lands ~Tue 2026-11-24 and Godfrey types
   the 24 spreads in. ← **asked, awaiting answer**
10. Roles and links: Organizer, Organizer Link for co-organizers (Godfrey), one shared
   Score Link vs per-team, Public Link.
11. Courts: how many, one court per matchup?
12. Punishments by final place; soju leaderboard?
