# Team Tally

A scoring app for captained team events at `/tools/team-tally`. An Organizer builds the night, Team Tally writes the brief they paste into the group chat, captains report scores from their phones, and the night sorts itself into Flights and ends on a results page. It replaces a whiteboard and a spreadsheet kept by hand.

It was designed (2026-10-08) around one organizer's Tuesday night at Backyard: 12 to 14 teams of four, each team playing one opening Matchup and then one Flight Matchup. That format is the only one it knows. Other team formats (MLP-style gender doubles, for one) are a reason to add a second Format later, not something to generalise for now.

Team Tally shares the site's sign-in with Booking Buddy and On Deck and nothing else. It has no Club, no Queue and no event log.

## Language

### The night

**Team Event**:
One night of captained team play, owned by the Organizer who built it. It runs in two stages, the opening round and the Flights, and then ends on its results page, which stays up.
_Avoid_: Session (On Deck's word for an open-play night), tournament, league night

**Organizer**:
The signed-in person who builds and owns a Team Event. They can edit anything at any point, but the night is designed to run without them: captains report, finish and seed it.
_Avoid_: admin, host

**Brief**:
The message the Organizer pastes into the group chat before the night. Team Tally writes it from the Team Event: the Matchups with their court pairs, each team's roster and home court, the round and game format, the Flights, one Score Link per team and the Public Link. A brief from before Team Tally existed can be pasted back in to prefill setup.

### Teams and players

**Team**:
Four players who play together for one Team Event only. Teams are made up fresh each night; a nickname such as "Golden Set" can move to a different captain the next week, and nothing links one night's team to another's.

**Captain**:
The first player on a Team's line. The captain plays every Round, partnering a different teammate each time, always against the opposing captain.

**Player slot**:
A, B or C: the order in which the captain partners their three teammates. The Organizer sets it from what they know of the players; either captain can rename or reorder their own team's slots on the night, for any Round with no score yet. Players are names only, never accounts, and a slot holding a substitute is the same slot.

**Home court**:
The court a Team meets on, one of its Matchup's court pair. It decides nothing about who plays where.

### Play

**Matchup**:
Two Teams playing three Rounds on a pair of adjacent courts. The term is Matchup in code, tests and docs. On screens a Matchup is labelled by its brief number ("Match 1 · Courts 16 & 19"), as the Brief prints it ("MATCH 1"), so players can find it from the brief they were sent. "Match" stays a display label and never names an identifier.
_Avoid_: Match, outside that label (Pickle Point Pal's word for a scored contest between two sides)

**Court pair**:
The two adjacent courts a Matchup plays on. Which of the two is the captains' court does not matter and is not recorded.

**Round**:
Two Games played at the same time: a captains' game and a teammates' game. A Matchup has three. Round 1 is the captains with their Player A, Round 2 with B, Round 3 with C.

**Captains' game** and **teammates' game**:
The two Games in a Round. In the captains' game each captain partners that Round's slot; the other two players on each side play the teammates' game.

**Game**:
One scored game: first to 11, win by 2, or a 15-minute cap. It records two scores and which Team (or the Organizer) last edited it. A score saves unless a side past 11 leads by more than 2, which no game can end on.
_Avoid_: Match

**Team score**:
A Team's total points across the six Games of a Matchup. It is what ranks Teams, not Games won.

**Dreambreaker**:
The rotating singles tiebreak a tied Matchup plays. Team Tally records only who won it; its points never count toward a Team score.

**Matchup done**:
Either captain's tap that says a Matchup is over. It needs all six scores, and a Dreambreaker winner if the Matchup is tied, and it locks the Matchup's scores until the Organizer reopens it.

### Flights and results

**Seeding**:
Ranking every Team on its opening Team score to place it in a Flight. A tie is broken by the Matchup winner when the two Teams played each other, then point differential, then Games won, then the Organizer; the standings say which rule decided. Seeding happens by itself when the last opening Matchup is done, or when the Organizer taps Seed now. When it happens by itself, a tie on every count across a Flight line is placed in setup order with nobody choosing; the Organizer can still put the lower Team ahead, which swaps the two Teams between the two Flights, until either Flight has a score.

**Flight**:
A performance division of two Teams, ranked by Seeding: the top two are Flight A, the next two Flight B, and so on. There are as many Flights as opening Matchups. Each Flight plays one Matchup on one of the night's opening court pairs, and its winner is that Flight's champion. Nothing to do with aircraft.
_Avoid_: bracket, pool (Match Mixer's word)

**Final places**:
Every Team's finishing position: Flight A's champion first, its runner-up second, Flight B's champion third, and down. The summary at the top of the results page leads with the champions, then the final places.

### Links

**Score Link**:
A Team's link, carrying a random token, printed under that Team in the Brief. Whoever holds it can enter scores for that Team's Matchups, edit the Team's slots and tap Matchup done. It needs no account and turns read-only when the Team Event ends.

**Public Link**:
The read-only link to standings, Matchups, Flights and the results. It lays itself out for whatever screen opens it: a big-screen layout for a venue TV or a laptop, a scrolling one for a phone.
