# Match Mixer

A client-side pickleball round robin generator at `/tools/match-mixer`. Paste a list of names and get a balanced doubles rotation: every Round assigns partners and opponents across the available courts, nobody partners the same person twice, Byes spread evenly, and it prints. No account, no database, no network — the whole thing runs in the browser so it works on rec-centre wifi.

Since #543 that rotation is one **Format** of several rather than the only thing the tool knows. Rotating partners is still the default and still what the sentence above describes; fixed partners is the same board drawn for a night where people turn up already partnered; singles (#544) is the one where a side is a single Player and the word "doubles" in the sentence above stops being true. Read every claim below about partners, Byes and balance as a claim about rotating unless it says otherwise, because the Format is what decides which of them still hold.

A board can be handed round: a Share Link carries the Config in its query string and the reader's browser generates the same Schedule again from it (#492). That is still no server and still no account, but it is no longer true that nothing leaves the browser, and the page's own copy says so.

Since #482 the surface is **the board**: a magnetic planning board of the kind bolted up by a court door, and its visual world is documented with the rest of the app's design system. Printing still works and is deliberately a demotion of that world rather than a second design of it — the material comes off and the ruled grid underneath is what reaches the paper. Read "the desk reads it out" below as someone standing at that board with a phone, not holding a printout.

## Language

### The input

**Roster**:
The ordered list of people playing, entered as one name per line. Each entry carries a stable identity of its own, so a name can be corrected or a person removed without disturbing who played where. Order is entry order and means nothing — it is not a seeding or a ranking.

One Format contradicts that last sentence on purpose. In **fixed partners** the list is read two lines at a time and consecutive lines are a Pairing, so order is how the organizer says who is with whom. It is the only way they can say it: a marker on the line is RR-4.3's mechanism, and drawing the pairs by Seed would make the one thing that Format exists for unsayable. Order still carries no seeding and no ranking in any Format — what it carries in fixed partners is partnership, and nothing else. In **singles** it is back to meaning nothing: a Roster of `n` circles as `n` units and entry order is entry order.
_Avoid_: Lineup, list, Queue (On Deck's word, and a very different idea)

**Player**:
One entry in the Roster: a name, and nothing else. Match Mixer holds no skill level, no history and no account for a Player, who exists only for the length of one Config. Two Players may share a name — they stay distinct, and the tool points it out rather than refusing the paste.
_Avoid_: Participant, attendee. The word means different things in Booking Buddy and On Deck — see `CONTEXT-MAP.md`.

**Config**:
Everything the organizer has chosen: the Roster, the Format, the court count, the Round count and the Seed. It is the only thing edited and the only thing remembered between visits. A Schedule is never edited — the Config is edited, and the Schedule follows.
_Avoid_: Settings, options, form state

**Format**:
How a Round is put together, and therefore which generator builds it: **rotating partners** (the default), **fixed partners** or **singles**. It is a Config value like any other, so it survives a reload, rides in a Share Link, and flags the board stale when it changes — which it must, because it is the one input that changes the whole board without changing a single name or number.

The Format is also the only thing that decides how many seats a court has: four in both doubling Formats, two in singles. So the court ceiling follows the Format rather than the Roster alone — `floor(n / 4)` in doubles, `floor(n / 2)` in singles — and the courts field's maximum moves when the row is switched, not only when names are pasted.

A Format is a generator and not a cost term ([ADR 0003](docs/adr/0003-a-format-is-a-generator-not-a-cost-term.md)). Rotating searches for a seating that avoids partner repeats; the other two have none to avoid and are the same circle method over different units — `n / 2` Pairings in fixed partners, `n` Players in singles — so there is nothing to search in either, and they share one construction (`lib/engine/circle.ts`). A Config in any Format but rotating never reaches `findTable`.

The Scorer takes the Format too, because what counts as a failure is the Format's own question: partner repeats in rotating, rematches between Pairings in fixed, rematches between Players in singles. Not every Format will be a generator — RR-4.3's mixed doubles is a hard constraint inside rotating's search, which is a different thing and is argued in the same ADR.

A Roster a Format cannot seat is refused with a message rather than quietly trimmed: an odd list in fixed partners leaves somebody with nobody to partner, and that is not a Bye. Only that Format refuses anything — an odd list in singles is an ordinary night where one name sits each Round.
_Avoid_: Mode, game type, variant, toggle (three of the four RR-4 features are not Formats — see the ADR). "Doubles" as a Format name: two of the three are doubles.

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
Two Sides on one court within one Round. A Game belongs to exactly one Round and one court. In doubles that is four Players, two partners against two partners; in singles it is two, one against one.
_Avoid_: Match (Pickle Point Pal's word for a scored contest between two sides), Foursome (On Deck's word)

**Side**:
One of the two parties to a Game: a Team in either doubles Format, a lone Player in singles. It is the unit a name plate carries and the unit the `vs` sits between.

Before #544 a side was two Roster indices everywhere in the engine, which is why singles could not be expressed rather than merely being unimplemented — it was in the Scorer's partner matrix, in the Itinerary's `partner`, in the plate's stroke between two names, and in court arithmetic counting four seats. Widening it was most of what that milestone was, and the widening is deliberately a one-or-two tuple rather than "a Player or a Team", so every reader walks a side the same way whichever Format drew it.
_Avoid_: Team where a side might be one Player (a Team is exactly two, and stays the word for the doubles pair and for what fixed partners declares), half, net side

**Bye**:
A Player sitting out a Round because there are more Players than seats. A Bye is arithmetic, not a status: everyone left over once the courts are full takes one, and spreading them evenly is the second thing the Scorer cares about. How many seats there are to fill is the Format's question — `courts × 4` in doubles, `courts × 2` in singles.

In **fixed partners** a Bye belongs to a Pairing rather than to a Player. Four teams on one court means two whole teams sit, and both members of a sitting team sit — so the count the organizer reads is pairs, and Bye fairness is measured across Pairings. The Scorer needs no separate arithmetic for it: because the two always sit together, the spread over Players is already the spread over Pairings. In **singles** the unit that sits is a Player again, so there was never anything to convert.
_Avoid_: Sit-out as a noun, rest, bench

### Handing it round

**Share Link**:
A URL carrying a whole Config in one query parameter — the Generator Version, the court count, the Round count, the Seed, a checksum over the names, the Format, and then the names. The Format is last because a field is always appended and never inserted: a link minted before Formats existed carries five fields, reads as rotating, and goes on drawing the board it named. The Format rides as one character (`r`, `f`, `s`), so a new Format costs a link nothing — which is what #544 was able to demonstrate. Whoever opens it generates the same Schedule again in their own browser, so a link is transport and never storage: nothing is uploaded, nothing is looked up, and the link keeps working after the organizer closes the tab. Player ids are not carried; the engine works in positions and ids are made again on arrival exactly as they are for a pasted list.
_Avoid_: Invite Link (Booking Buddy's word, and an account-bound one), permalink, share code, export

**Generator Version**:
The marker in a Share Link saying which generator minted it. A Seed only reproduces a board if the thing consuming it has not moved, so this is bumped whenever a change alters what an existing Config generates: a new or amended Table, a change to the search, a change to the Scorer's weights. **Whoever makes that kind of change bumps `GENERATOR_VERSION` in `share-link.ts` as part of it** — the rule is also written at the top of `tables.ts`, `generator.ts` and `scorer.ts`, wherever the change actually lands. A link minted under an older version still opens and still draws with the current generator; the board just carries a plain notice that it may differ from the one that was shared (#494). Bumping the version never invalidates a link — old links keep opening, they just pick up the notice.
_Avoid_: Schema version (`config-storage`'s, and a different number about a different thing), API version

**Borrowed board**:
A board on screen that arrived by Share Link and belongs to somebody else. It is displayed and not written to this browser's storage, because most people who open a link are players rather than organizers and some of them keep their own club Roster in the same browser. The first edit of any kind claims it, and from then on it saves like any other visit. The same edit strips the Share Link's parameter from the address bar (#493) — a history replace, not a navigation — because the moment a claim happens the address bar's link stops describing the board on screen and would otherwise go on offering a stale one to whoever copies it.
_Avoid_: Read-only, guest mode, preview. Nothing is locked — the board is fully editable, it just is not yours until you touch it.

### The proof

**Table**:
A published, precomputed Schedule stored in the app for a Roster size the maths solves perfectly. Every Table is a whist tournament — each Player partners every other exactly once, opposes every other exactly twice, and nobody sits out — so any leading run of its Rounds is still perfectly balanced and can be served as-is.

Tables are **rotating doubles only**, and that is a statement about what a whist tournament is rather than a gap waiting to be filled. A Config in any other Format goes to that Format's own generator and never reaches `findTable`. Singles is where that is most visibly right: a whist Table for n=8 seats four to a court, and a singles night on the same eight names has four courts of two.
_Avoid_: Preset, template, fixture list

**Scorer**:
The measurement of a Schedule. It is this context's definition of "fair" — it validates the Tables in tests, it picks the winner among the generator's attempts, and it produces the summary line under the Schedule. Nothing claims a Schedule is balanced except the Scorer.

What it measures depends on the Format, so its reading is a union and a caller has to say which board it is looking at before taking a verdict off it. In **rotating** it is partner repeats first, Bye imbalance second, opponent repeats third. In **fixed partners** every partner repeat is deliberate, so the question becomes whether every Pairing has faced every other and whether the team Byes come round evenly — a fixed board scored as a rotating one reports a perfectly correct Schedule as a catastrophe. In **singles** there are no partners at all and the partner matrix stays empty, so the whole verdict is what the opponent matrix says: has anybody played the same person twice, and do the Byes rotate. A `cost` of zero means the same thing in every Format.

Singles and fixed partners count the same noun over different units — meetings between Players, meetings between Pairings — which is why they are two shapes rather than one. A reader that could not tell them apart would report a figure against the wrong denominator.
_Avoid_: Cost function (fine as the function's name; the Scorer is the concept), validator. Unrelated to entering game scores, which is a separate future concern.

**Pairing**:
Two Players who have partnered at least once, counted as a pair and not as an occasion: a Pairing that happened twice is one Pairing and one repeat. In **fixed partners** a Pairing is not something a Schedule accumulates but something the Roster declares — two consecutive lines — and it is the unit that takes a Bye and that meets other Pairings. **Singles** has no Pairings whatsoever.

**Coverage** is how much of the supply a Schedule has used, reported in the summary line as "18 of 66 possible pairings". What is in supply follows the Format: partnerships in rotating, matchups between Pairings in fixed partners, and matchups between Players in singles — `n(n − 1) / 2` of them, one spent per court per Round rather than two. It answers whether another Round is worth playing, which is the one question the Schedule grid cannot be read for.
_Avoid_: Partner Matrix (removed 2026-09-09, see below), heatmap, pairing chart. Not a synonym for Team, which is a Pairing in one particular Game.

**Repeat mark**:
The marker ring drawn in the Schedule grid round the thing that happened twice. It is the Scorer's failure signal made visible in the Round it happened in, so what it encircles follows the Format's question rather than the element: in **rotating** it rings a Team, the pair that partnered more than once; in **fixed partners** it rings the whole Game, because the pair is the constant and the matchup is what can repeat; in **singles** it rings the whole Game too, because in singles the Game *is* the pairing. On screen it is a drawn stroke — the one hand-made mark on an otherwise manufactured board (#482); on paper it falls back to a ruled box, because an ellipse positioned against a name plate has nothing to sit on once the plate is gone.

Leaving a rematch to the summary line alone is deliberately not an option, in any Format. It would reintroduce exactly what got the Partner Matrix cut (#477): a figure naming a failure without locating it.
_Avoid_: Warning, error, conflict

### Reading your own night

**Itinerary**:
One Player's evening pulled out of the Schedule: for every Round, either the court, the partner and the opponents, or a Bye. In **singles** the partner is `null` and there is one opponent — an answer to the question rather than an absence of one, which is why it is a nullable field and not a second shape. It is a second reading of the same Schedule and never a second Schedule — a pure function in the engine, asked for by Roster index, which is what keeps two Players called Mike apart. The line above the board is derived from it rather than assembled in the component, for the same reason the summary line's figures come off the Scorer.
_Avoid_: Card, personal schedule, my games. Not a Mixer, which is a plan being run rather than a plan being read.

**Find-me**:
Tapping a name to see that Player's Itinerary. The board holds everything not in their evening back, their own name is marked, and the Itinerary says the same thing in words above the grid — the words are the answer and the dimming is decoration on top of them, so it works with no pointer and no sight of the board. Tapping the marked name again puts the whole board back. Available on any board, including one the organizer drew themselves. Finding yourself is a reading and not an edit, so it does not claim a Borrowed board.
_Avoid_: Filter, highlight, focus mode, my view

**Selection**:
Which Roster index find-me is showing, kept in this browser. Always stored against a **board identity** — the Roster, the courts, the Rounds and the Seed together — because an index only means anything against one particular board: index 3 on a board you were sent is a stranger's evening. A stored Selection whose identity does not match the board on screen reads as no Selection, silently, which is also what makes "the organizer sent a second link" behave.
_Avoid_: Active player, current user (there are no accounts here), pinned name

Selection has a key and a module of its own in the persistence layer (`selection-storage.ts`) rather than a field on the saved Config, so `config-storage.ts` is no longer the only thing in Match Mixer touching `localStorage`. A **Borrowed board** is deliberately never written to the saved Config — reading somebody else's link must not wipe the Roster you keep for your own club night — and that is precisely the visit whose Selection most needs to come back after a pocket.

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

See [docs/adr/0001-config-and-schedule-are-not-event-sourced.md](docs/adr/0001-config-and-schedule-are-not-event-sourced.md), [docs/adr/0002-precomputed-tables-are-whist-prefixes.md](docs/adr/0002-precomputed-tables-are-whist-prefixes.md) and [docs/adr/0003-a-format-is-a-generator-not-a-cost-term.md](docs/adr/0003-a-format-is-a-generator-not-a-cost-term.md).
