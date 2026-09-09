# Match Mixer

A client-side pickleball round robin generator at `/tools/match-mixer`. Paste a list of names and get a balanced doubles rotation: every Round assigns partners and opponents across the available courts, nobody partners the same person twice, Byes spread evenly, and it prints. No account, no database, no network — the whole thing runs in the browser so it works on rec-centre wifi.

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
The box drawn round a Team in the Schedule grid when that pair partnered more than once. It is the Scorer's failure signal made visible in the Round it happened in.
_Avoid_: Warning, error, conflict

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
