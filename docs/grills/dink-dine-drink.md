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

_(none settled yet)_

## Open questions (asked in this order)

1. **New app or a Format in Team Tally?** Recommended: a new, separate app reusing Team
   Tally's pieces. ← **asked, awaiting answer**
2. What must be ready for 2026-11-28? Recommended: roster import, lineups, spreads,
   scoring, live standings, punishments; draft-night screen after.
3. Roster input: paste spreadsheet rows (Name, Gender, Team, Captain, DUPR, DUAR, DUSR)?
   Is gender in the sheet?
4. Rating scales for DUAR/DUSR; is DUPR the only rating that drives game day?
5. Round 1 Dreambreaker: which teams play which, how 4 seeds come out, scoring (rally to
   21?), pairing when rosters differ in size.
6. Round 2 / playoff: 2-2 tiebreak in a 4-game matchup.
7. Spread: who drinks, rounding, win-by-2 games, does every game get a spread.
8. Lineups: limits per player, blind submission, who sees them.
9. Roles and links: Organizer, Organizer Link for co-organizers (Godfrey), one shared
   Score Link vs per-team, Public Link.
10. Courts: how many, one court per matchup?
11. Punishments by final place; soju leaderboard?
