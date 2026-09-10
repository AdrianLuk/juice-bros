# Match Mixer

A client-side pickleball round robin generator at `/tools/match-mixer`. Paste a list of names and get a balanced doubles rotation: every Round assigns partners and opponents across the available courts, nobody partners the same person twice, Byes spread evenly, and it prints. No account, no database, no network — the whole thing runs in the browser so it works on rec-centre wifi.

A board can be handed round: a Share Link carries the Config in its query string and the reader's browser generates the same Schedule again from it (#492). That is still no server and still no account, but it is no longer true that nothing leaves the browser, and the page's own copy says so.

Since #482 the surface is **the board**: a magnetic planning board of the kind bolted up by a court door, and its visual world is documented with the rest of the app's design system. Printing still works and is deliberately a demotion of that world rather than a second design of it — the material comes off and the ruled grid underneath is what reaches the paper. Read "the desk reads it out" below as someone standing at that board with a phone, not holding a printout.

## Language

### The input

**Roster**:
The ordered list of people playing, entered as one name per line. Each entry carries a stable identity of its own, so a name can be corrected or a person removed without disturbing who played where. Order is entry order and means nothing — it is not a seeding or a ranking.
_Avoid_: Lineup, list, Queue (On Deck's word, and a very different idea)

**Player**:
One entry in the Roster: a name, and nothing else. Match Mixer holds no skill level, no history and no account for a Player, who exists only for the length of one Config. Two Players may share a name — they stay distinct, and the tool points it out rather than refusing the paste.
_Avoid_: Participant, attendee. The word means different things in Booking Buddy and On Deck — see `CONTEXT-MAP.md`.

**Config**:
Everything the organizer has chosen: the Roster, the court count, the Round count and the Seed. It is the only thing edited and the only thing remembered between visits. A Schedule is never edited — the Config is edited, and the Schedule follows.
_Avoid_: Settings, options, form state

**Seed**:
The number that makes generation reproducible. The same Config with the same Seed always yields the same Schedule, so a Schedule never has to be stored — it can be rebuilt from what produced it. "Regenerate" means nothing more than writing a new Seed.
_Avoid_: Shuffle, randomiser

**Court**:
A column of the grid — one of the places a Game can happen within a Round. Here a court is a count, not a place: it has no name, no venue and no existence outside the Config.
_Avoid_: Court as On Deck uses it (a physical, named court belonging to a Club).

### The output

**Schedule**:
The full set of Rounds produced from a Config. Always derived, never authored and never stored — when the Config changes the Schedule is rebuilt, not patched.
_Avoid_: Draw, bracket (nothing here is elimination), plan

**Round**:
One slice of the Schedule: every court plays a Game simultaneously and whoever is left over takes a Bye. Rounds are the rows of the grid and the unit the desk reads out.
_Avoid_: Rotation, session

**Game**:
Four Players on one court within one Round — two partners against two partners. A Game belongs to exactly one Round and one court.
_Avoid_: Match (Pickle Point Pal's word for a scored contest between two sides), Foursome (On Deck's word)

**Bye**:
A Player sitting out a Round because there are more Players than seats. A Bye is arithmetic, not a status: everyone left over once `courts × 4` seats are filled takes one, and spreading them evenly is the second thing the Scorer cares about.
_Avoid_: Sit-out as a noun, rest, bench

### Handing it round

**Share Link**:
A URL carrying a whole Config in one query parameter — the Generator Version, the court count, the Round count, the Seed, a checksum over the names, and then the names. Whoever opens it generates the same Schedule again in their own browser, so a link is transport and never storage: nothing is uploaded, nothing is looked up, and the link keeps working after the organizer closes the tab. Player ids are not carried; the engine works in positions and ids are made again on arrival exactly as they are for a pasted list.
_Avoid_: Invite Link (Booking Buddy's word, and an account-bound one), permalink, share code, export

**Generator Version**:
The marker in a Share Link saying which generator minted it. A Seed only reproduces a board if the thing consuming it has not moved, so this is bumped whenever a change alters what an existing Config generates: a new or amended Table, a change to the search, a change to the Scorer's weights. The decoder reports whether it matched; what to say about a mismatch is #494.
_Avoid_: Schema version (`config-storage`'s, and a different number about a different thing), API version

**Borrowed board**:
A board on screen that arrived by Share Link and belongs to somebody else. It is displayed and not written to this browser's storage, because most people who open a link are players rather than organizers and some of them keep their own club Roster in the same browser. The first edit of any kind claims it, and from then on it saves like any other visit.
_Avoid_: Read-only, guest mode, preview. Nothing is locked — the board is fully editable, it just is not yours until you touch it.

### The proof

**Table**:
A published, precomputed Schedule stored in the app for a Roster size the maths solves perfectly. Every Table is a whist tournament — each Player partners every other exactly once, opposes every other exactly twice, and nobody sits out — so any leading run of its Rounds is still perfectly balanced and can be served as-is.
_Avoid_: Preset, template, fixture list

**Scorer**:
The measurement of a Schedule: partner repeats first, Bye imbalance second, opponent repeats third. It is this context's definition of "fair" — it validates the Tables in tests, it picks the winner among the generator's attempts, and it produces the summary line under the Schedule. Nothing claims a Schedule is balanced except the Scorer.
_Avoid_: Cost function (fine as the function's name; the Scorer is the concept), validator. Unrelated to entering game scores, which is a separate future concern.

**Pairing**:
Two Players who have partnered at least once, counted as a pair and not as an occasion: a Pairing that happened twice is one Pairing and one repeat. **Coverage** is how many of the Roster's Pairings a Schedule has used, reported in the summary line as "18 of 66 possible pairings". It answers whether another Round is worth playing, which is the one question the Schedule grid cannot be read for.
_Avoid_: Partner Matrix (removed 2026-09-09, see below), heatmap, pairing chart. Not a synonym for Team, which is a Pairing in one particular Game.

**Repeat mark**:
The marker ring drawn round a Team in the Schedule grid when that pair partnered more than once. It is the Scorer's failure signal made visible in the Round it happened in. On screen it is a drawn stroke — the one hand-made mark on an otherwise manufactured board (#482); on paper it falls back to a ruled box, because an ellipse positioned against a name plate has nothing to sit on once the plate is gone.
_Avoid_: Warning, error, conflict

### Reading your own night

**Itinerary**:
One Player's evening pulled out of the Schedule: for every Round, either the court, the partner and the opponents, or a Bye. It is a second reading of the same Schedule and never a second Schedule — a pure function in the engine, asked for by Roster index, which is what keeps two Players called Mike apart. The line above the board is derived from it rather than assembled in the component, for the same reason the summary line's figures come off the Scorer.
_Avoid_: Card, personal schedule, my games. Not a Mixer, which is a plan being run rather than a plan being read.

**Find-me**:
Tapping a name to see that Player's Itinerary. The board holds everything not in their evening back, their own name is marked, and the Itinerary says the same thing in words above the grid — the words are the answer and the dimming is decoration on top of them, so it works with no pointer and no sight of the board. Tapping the marked name again puts the whole board back. Available on any board, including one the organizer drew themselves.
_Avoid_: Filter, highlight, focus mode, my view

**Selection**:
Which Roster index find-me is showing, kept in this browser. Always stored against a **board identity** — the Roster, the courts, the Rounds and the Seed together — because an index only means anything against one particular board: index 3 on a board you were sent is a stranger's evening. A stored Selection whose identity does not match the board on screen reads as no Selection, silently, which is also what makes "the organizer sent a second link" behave.
_Avoid_: Active player, current user (there are no accounts here), pinned name

Selection has a key and a module of its own in the persistence layer (`selection-storage.ts`) rather than a field on the saved Config, so `config-storage.ts` is no longer the only thing in Match Mixer touching `localStorage`. A board arrived at by link is deliberately never written to the saved Config — reading somebody else's link must not wipe the Roster you keep for your own club night — and that is precisely the visit whose Selection most needs to come back after a pocket.

### Not built yet

**Mixer**:
A Schedule plus everything that has since happened to it — Rounds locked, scores entered, people arriving and leaving. A Config and its Schedule describe a plan; a Mixer is a plan being run.
_Avoid_: Session (On Deck's word for one night at a club), event, tournament

**Lock**:
Marking a Round as played so it stops being rebuilt when the Roster changes. Locking is what makes a Mixer more than a Schedule: later Rounds may be regenerated around someone who arrived or left, and locked Rounds never move.
_Avoid_: Commit, freeze, finalise

### Retired

**Partner Matrix** (removed 2026-09-09, #477):
An `n × n` grid at the foot of the Schedule counting how many times each pair partnered. It was cut because it named a failure it could not locate — a cell reading 2 said a pair repeated but not which Rounds they were in, so acting on it meant searching the Schedule grid by hand. Its verdict was already in the summary line, and the coverage figure was the only thing in it that was not. What replaced it: **Coverage** in the summary line, and the **Repeat mark** in the grid. Do not reintroduce it under another name.

Its source is kept dormant at `src/components/apps/match-mixer/partner-matrix.tsx`, with the CSS it needs written up in [docs/retired-partner-matrix.css.md](docs/retired-partner-matrix.css.md). Nothing imports the component, and the CSS is Markdown rather than a stylesheet because as a `.css` file Tailwind compiled it into every page unasked (#480). They are in the tree rather than left to `git` because PR #478 was squash-merged and both branches deleted, which leaves the commits holding them prunable. Keeping them is a hedge against losing the work, not a plan to render it: reviving the surface as-is reopens everything above, so if it comes back it should come back answering "which Rounds", which is the thing it could never do.

See [docs/adr/0001-config-and-schedule-are-not-event-sourced.md](docs/adr/0001-config-and-schedule-are-not-event-sourced.md) and [docs/adr/0002-precomputed-tables-are-whist-prefixes.md](docs/adr/0002-precomputed-tables-are-whist-prefixes.md).
