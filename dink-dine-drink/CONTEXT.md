# Dink Dine & Drink

An app for the Juice Bros friends' DDD events (several a year) (working route `/tools/dink-dine-drink`): four
drafted Teams, a singles round to seed them, then MLP-style team Matchups where every Game
is played against a DUPR Spread and missing it costs soju. It replaces the spreadsheet the
event has run on. Separate from Team Tally (see `CONTEXT-MAP.md`), though built the same
way.

Being settled in a grilling session; the live record is `docs/grills/dink-dine-drink.md`.

## Language

### People

**Organizer**:
Someone on the DDD Organizer list. Any Organizer can create a DDD and edit every DDD:
its roster, Lineups, Spreads, courts, scores and punishments. Lilliana is the main
Organizer; Godfrey, who audits the Spreads, is another. Organizers sign in, and join the
list through an invite link from an Organizer already on it.

**Superadmin**:
Adrian's account, which can do anything on any DDD, including what Organizers cannot.

### The event

**DDD**:
One Dink Dine & Drink event: a name, a date, a play venue (the courts) and a dine & drink
venue (where everyone eats and drinks after). Several happen a year.

### Teams and players

**Team**:
One of the four drafted sides at a DDD (always four, for now), about six players, led by a Captain.

**Captain**:
The player who leads a Team and submits its Lineup.

**Lineup**:
A Team's four doubles Pairs for the whole day: men's doubles, women's doubles and two
mixed doubles. It is named once before the event and the same Pairs play every doubles
Matchup that day. Every player is in one or two Pairs; a Team short on men or women fills
the gaps with the same players playing twice. A Lineup that breaks this is flagged, not
refused. Lineups are public as soon as they are entered.

### Play

**Dreambreaker**:
The opening singles round. Every Team plays every other Team once (six Dreambreakers), two
at a time, since each Team can only be in one at once. Its results set the Seeding. Rally scoring to 21, win by 1,
with a freeze at 20: a side on 20 can only win the last point on its own serve. Every
finished Dreambreaker ends 21 to something from 0 to 20. Only the final score is
recorded.

**Rotation**:
The order a Team's players step in during a Dreambreaker, one change every 3 points. It
starts as the Team's players by DUPR, highest first, and each Team cycles its own list, so
a five-player Team's first player returns while a six-player Team sends its sixth. It is
guidance shown on the court, not a rule: it can be changed on the day.
_Avoid_: tiebreak (Team Tally's Dreambreaker is a tiebreak; this one is a round)

**Seeding**:
Ranking the four Teams 1 to 4 on their Dreambreaker results, which decides the doubles
Matchups (1 vs 4, 2 vs 3). Most Dreambreakers won ranks first. A tie is broken by, in
order: the head-to-head Dreambreaker when exactly two Teams are tied, point difference
across all three Dreambreakers, total points scored, then the Organizer's call. The
standings say which rule decided each place.

A Dreambreaker has no Spread and costs no soju: it is scored straight up and only seeds.

**Round 2**:
The first doubles round: Seed 1 plays Seed 4 and Seed 2 plays Seed 3, one Matchup on each
court.

**Playoff**:
The last round: the two Round 2 winners play for first and second, the two Round 2 losers
for third and fourth. Same four-Game Matchups with Spreads.

**Final places**:
Every Team's finishing position, first to fourth, set by the Playoff.

**Punishment**:
What a Team drinks for its Final place, set by the Organizers and editable at any time,
before or after the DDD. Defaults are bottles by place: 1 for first, 2 for second, 3 for
third, 4 for fourth. Separate from Soju shots, which come from the Games.

**Pair**:
Two players from one Team who play a doubles Game together, as named in the Lineup.

**Game**:
One doubles game between two Pairs in a Matchup: side-out scoring to 11, win by 2.

**Spread**:
The points the lower-rated Pair is forecast to score against the higher-rated Pair in a
Game, entered by Godfrey from DUPR's forecast before the event (e.g. 5.5 in a game to 11).
Every possible pairing of two Teams has its four Spreads set ahead of time. A Spread always
ends in .5, so no Game lands exactly on it.

**Spread winner**:
The Pair that wins a Game once the Spread is applied. The lower-rated Pair is the Spread
winner when its points beat the Spread, whatever the final score: a 3.5 Pair losing 11-6
against a Spread of 5.5 is the Spread winner. It is always the lower-rated Pair's points
that are measured, including in games that run past 11.
_Avoid_: winner, alone (say Spread winner, or "won the game outright" for the raw score)

**Matchup**:
Two Teams playing their four Lineup Games against each other: men's doubles, women's
doubles and two mixed doubles. The Team with more Spread winners wins it. A 2-2 split is
decided by Spread margin. A Matchup has two courts and plays its four Games in two Waves
of two.

**Wave**:
Two Games of one Matchup played at the same time, one on each of its courts. Two Games
that share a player can never be in the same Wave; if a Lineup cannot be split that way,
the leftover Game plays on its own.
_Avoid_: Match, outside a display label (Pickle Point Pal's word)

**Spread margin**:
How far a Team's Pair beat or missed the Spread in a Game, before rounding: the
lower-rated Pair's points minus the Spread for that Pair's Team, and the same number
negated for the other Team. Summed over a Matchup's four Games, the larger total wins a
2-2 Matchup.
If the totals also tie, total raw points across the four Games decide it, and if those
tie, the Organizer's call. (Provisional: Adrian is confirming with the group.)

**Soju shots**:
What a Game costs the Team whose Pair loses against the Spread: the gap between the
lower-rated Pair's points and the Spread, rounded up, counted against that Team, not its
players. 11-3 against 5.5 is a gap of 2.5, so 3 shots go on that Team's count. Every Game
puts at least one shot on someone's count.

### Links

**Score Link**:
One link per DDD, posted in the group chat. Whoever holds it can enter or correct any
score; each score remembers who last edited it. No account needed.

**Public Link**:
The read-only link to standings, Games, Soju shot counts and punishments, for phones and a
venue TV.
