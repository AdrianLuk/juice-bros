# Match Mixer

A client-side pickleball round robin generator at `/tools/match-mixer`. Paste a list of names and get a balanced doubles rotation: every Round assigns partners and opponents across the available courts, nobody partners the same person twice, Byes spread evenly, and it prints. No account, no database, no network — the whole thing runs in the browser so it works on rec-centre wifi.

Since #543 that rotation is one **Format** of several rather than the only thing the tool knows. Rotating partners is still the default and still what the sentence above describes; fixed partners is the same board drawn for a night where people turn up already partnered; singles (#544) is the one where a side is a single Player and the word "doubles" in the sentence above stops being true. Read every claim below about partners, Byes and balance as a claim about rotating unless it says otherwise, because the Format is what decides which of them still hold.

A board can be handed round: a Share Link carries the Config in its query string and the reader's browser generates the same Schedule again from it (#492). That is still no server and still no account, but it is no longer true that nothing leaves the browser, and the page's own copy says so.

Since #482 the surface is **the board**: a magnetic planning board of the kind bolted up by a court door, and its visual world is documented with the rest of the app's design system. Printing still works and is deliberately a demotion of that world rather than a second design of it — the material comes off and the ruled grid underneath is what reaches the paper. Read "the desk reads it out" below as someone standing at that board with a phone, not holding a printout.

## Language

### The input

**Roster**:
The ordered list of people playing, entered as one name per line. Each entry carries a stable identity of its own, so a name can be corrected or a person removed without disturbing who played where. Order is entry order and means nothing — it is not a seeding or a ranking.

One Format contradicts that last sentence on purpose. In **fixed partners** the list is read two lines at a time and consecutive lines are a Pairing, so order is how the organizer says who is with whom. Order still carries no seeding and no ranking in any Format — what it carries in fixed partners is partnership, and nothing else. In **singles** it is back to meaning nothing: a Roster of `n` circles as `n` units and entry order is entry order.

A line may also end in a **Marker**, a single trailing `M` or `F` that **mixed doubles** reads. It rides on the roster line and never in a field of its own, which is what keeps the parse honest — there is no range to guess at and no question of whether a name ends in one — and what lets it travel: the Share Link carries lines rather than names, so a marked board opens marked. A line that is only a Marker is a name, because there is nothing before it to attach one to.

**A Marker is read only while mixed doubles is on**, and this is load-bearing rather than an optimisation. A club that tells two Sarahs apart by last initial types exactly what a Marker looks like, so reading one off every line unconditionally would delete the initial — and only for those two letters, leaving `Mike T` intact beside a `Sarah M` that had silently become a second `Sarah`, with the duplicate notice firing on names the organizer had already told apart. So ticking the box re-reads the roster box, and unticking it reads the same lines back as names. Everything that parses a Roster answers the same question first: the box, the Share Link, and nothing else — a saved Roster stores its Markers structurally and is not re-parsed at all.
A Roster holds 4 to 32 Players per **Pool**, and at most `min(32 × pools, 64)` on one board. Both reasons for the old flat ceiling of 32 were reasons about one rotation (the grid fitting a sheet, the search staying quick), and since RR-6 a rotation is a Pool. So a list of forty is not refused outright at one Pool: the screen says it is more than one rotation holds and points at the Pool count.
_Avoid_: Lineup, list, Queue (On Deck's word, and a very different idea)

**Player**:
One entry in the Roster: a name, and optionally a **Marker** — a trailing `M` or `F` on the line, which **mixed doubles** reads and nothing else does. Two Players may share a name, and a shared name with two different Markers is still a shared name: they stay distinct to the engine, and the duplicate notice still points them out, because the board prints no Markers and cannot tell them apart.

This entry used to read "a name, and nothing else". The sentence was amended in RR-4.3 (#545) rather than quietly widened, because what it was guarding is still the rule and the Marker is the one exception to it: Match Mixer holds no skill level, no history, no rating, no contact detail and no account for a Player, who exists only for the length of one Config. The Marker earned its place by being the one attribute a rotation cannot launder — a lopsided skill pairing comes out in the wash over eight Rounds, and a mixed-doubles night is either mixed or it is not. Nothing else about a person may follow it in on that argument without the same one.
_Avoid_: Participant, attendee. The word means different things in Booking Buddy and On Deck — see `CONTEXT-MAP.md`. **Gender** is not the word for the Marker: what the tool reads is two letters on a line, and what it promises is one of each to a side.

**Config**:
Everything the organizer has chosen: the Roster, the Format, whether it is **mixed doubles**, the **Pool** count, the court count, the Round count and the Seed. It is the only thing edited and the only thing remembered between visits. A Schedule is never edited — the Config is edited, and the Schedule follows.
_Avoid_: Settings, options, form state

**Format**:
How a Round is put together, and therefore which generator builds it: **rotating partners** (the default), **fixed partners** or **singles**. It is a Config value like any other, so it survives a reload, rides in a Share Link, and flags the board stale when it changes — which it must, because it is the one input that changes the whole board without changing a single name or number.

The Format is also the only thing that decides how many seats a court has: four in both doubling Formats, two in singles. So the court ceiling follows the Format rather than the Roster alone — `floor(n / 4)` in doubles, `floor(n / 2)` in singles — and the courts field's maximum moves when the row is switched, not only when names are pasted.

A Format is a generator and not a cost term ([ADR 0003](docs/adr/0003-a-format-is-a-generator-not-a-cost-term.md)). Rotating searches for a seating that avoids partner repeats; the other two have none to avoid and are the same circle method over different units — `n / 2` Pairings in fixed partners, `n` Players in singles — so there is nothing to search in either, and they share one construction (`lib/engine/circle.ts`). A Config in any Format but rotating never reaches `findTable`.

The Scorer takes the Format too, because what counts as a failure is the Format's own question: partner repeats in rotating, rematches between Pairings in fixed, rematches between Players in singles. Not everything in the Format row is a Format — **mixed doubles** is a hard constraint inside rotating's search, which is a different thing and is argued in the same ADR.

A Roster a Format cannot seat is refused with a message rather than quietly trimmed: an odd list in fixed partners leaves somebody with nobody to partner, and that is not a Bye. Only that Format refuses anything — an odd list in singles is an ordinary night where one name sits each Round.
_Avoid_: Mode, game type, variant, toggle (three of the four RR-4 features are not Formats — see the ADR). "Doubles" as a Format name: two of the three are doubles.

**Mixed doubles**:
A constraint on **rotating partners**, not a Format of its own: every Team comes out one `M` and one `F`, read off the **Markers** on the roster lines. A checkbox under the Format row, present only while rotating is selected and dropped when it is not, because no other Format has anything for a Marker to decide.

It is a hard constraint inside the generator's seating rather than a weight the search may trade away ([ADR 0003](docs/adr/0003-a-format-is-a-generator-not-a-cost-term.md)). A Round with two `M` on a side is not a worse mixed board — it is not a mixed board — so it is never constructed: the seating draws from two pools, the Byes come off two queues, and the swap pass will not trade a player for one of the other Marker. A mixed board never comes off a **Table** either, because a Table is a whist construction over bare positions and knows nothing about which of them is an `M`.

Two things it changes that are easy to miss. The partnership supply is `M × F` rather than `n(n − 1) / 2`, which both the consequence line and **Coverage** read, and which shortens the rotation's natural length. And an even share of the Byes is asked once per Marker rather than across the whole Roster: ten `M` and six `F` on three courts sits four `M` down every Round and no `F` ever, which is not a broken rotation but the only one those counts allow.

Two refusals, both with arithmetic in them. A Roster only half marked produces Teams that may or may not be mixed, so it is refused and the message says how many lines are short. A Roster whose counts cannot put `2c` of each on `c` courts is refused too, and the message names the shortfall and both ways out — fewer courts, or more of the short side.

The court count follows the Markers as a **default and never as a ceiling**. How many courts there are is a fact about the evening rather than a number to optimize: they are booked, and clamping the field to what the Markers allow would quietly take one away and call it a fix. So the dial opens on what a mixed night can fill — otherwise ticking the box on a drawable Roster would grey the button out before anybody had chosen anything — and still accepts the three courts the organizer actually has, answering with the arithmetic for why this list cannot fill them.

The board prints no Markers. On a mixed board every side is one of each by construction, so a letter after all twenty-four names would repeat a fact the guarantee already carries; what says the night was mixed is the board's own particulars, which is also the only thing on the printed sheet that can.
_Avoid_: Mixed (on its own — the word has to carry "doubles" or it sounds like a Format), gender balance, co-ed, M/F split

**Seed**:
The number that makes generation reproducible. The same Config with the same Seed always yields the same Schedule, so a Schedule never has to be stored — it can be rebuilt from what produced it. "Regenerate" means nothing more than writing a new Seed.
_Avoid_: Shuffle, randomiser

**Court**:
A column of the grid — one of the places a Game can happen within a Round. Here a court is a count, not a place: it has no name, no venue and no existence outside the Config.
On a board dealt into **Pools** its number counts across the whole night rather than being a column index, so two Pools can never both send somebody to court 1. Each Pool's generator numbers its courts from zero, and the pool layer moves every Game onto its real court. On the board a column is a court for the whole evening, grouped into one band per Pool, and a court no Pool has the players to fill stands empty and the consequence line says which.
_Avoid_: Court as On Deck uses it (a physical, named court belonging to a Club).

### The output

**Schedule**:
The full set of Rounds produced from a Config. Always derived, never authored and never stored — when the Config changes the Schedule is rebuilt, not patched.
_Avoid_: Draw, bracket (nothing here is elimination), plan

**Round**:
One slice of the Schedule: every court plays a Game simultaneously and whoever is left over takes a Bye. Rounds are the rows of the grid and the unit the desk reads out.
The Round count is one number for every **Pool**: a Round is a time slot across every court, and the room calls "next round" once. Its default is the shortest Pool's natural length, capped at the usual eight, and the consequence line names the Pool that set it.
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

Mixed doubles is the seventh field and the **Pool** count the eighth, both appended only when they say something: a one-Pool link on an unmixed board is byte-for-byte the link minted before either existed, and a pooled unmixed link leaves the seventh empty to reach the eighth. The link carries the count and never the deal, so the reader's browser deals the same Pools again off the same Seed. Neither bumped the Generator Version, because a Config with no Pool count is one Pool and draws the board it always did; `unchanged-boards.test.ts` pins that with boards minted by the engine before Pools.
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
Its unit is the **Pool**. On a pooled board each Pool's summary line is its own, read off its own Schedule against its own denominators, and nothing combines them: there is no verdict for the night, because averaging a complete five-player rotation with a third of a twelve-player one gives a number with no referent.
_Avoid_: Cost function (fine as the function's name; the Scorer is the concept), validator. Unrelated to entering game scores, which is a separate future concern.

**Pairing**:
Two Players who have partnered at least once, counted as a pair and not as an occasion: a Pairing that happened twice is one Pairing and one repeat. In **fixed partners** a Pairing is not something a Schedule accumulates but something the Roster declares — two consecutive lines — and it is the unit that takes a Bye and that meets other Pairings. **Singles** has no Pairings whatsoever.

**Coverage** is how much of the supply a Schedule has used, reported in the summary line as "18 of 66 possible pairings". What is in supply follows the Format: partnerships in rotating, matchups between Pairings in fixed partners, and matchups between Players in singles — `n(n − 1) / 2` of them, one spent per court per Round rather than two. Under **mixed doubles** rotating's total is `M × F` instead of the whole triangle, because a same-Marker pair is not a partnership that night can ever draw and counting it would leave a fully covered board reporting itself short of one it never could reach. It answers whether another Round is worth playing, which is the one question the Schedule grid cannot be read for.
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

### Splitting the night

**Pool** (RR-6, #392; the count shipped in RR-6.1, #552):
A part of the Roster playing its own complete round robin, on courts of its own, at the same time as the others. A Pool has its own Players, its own courts, its own Schedule and its own reading from the Scorer, and it has nothing to do with any other Pool beyond sharing a Round count and a board. A Bye in Pool A has no bearing on Pool B's balance. It is not a stage of a tournament: nothing is seeded into a Pool and nothing comes out of one into a playoff.

Pools are made by one layer above `generateSchedule` and nowhere else (`lib/engine/pools.ts`, [ADR 0004](docs/adr/0004-pools-partition-above-a-pool-blind-engine.md)). It deals the Roster, allocates courts, calls `generateSchedule` once per Pool with that Pool's own **sub-roster**, and moves each Game onto its real court. The generator, the Tables, the Scorer and the Itinerary never hear the word, and the grid only loops over a list of bands. A Pool of eight on two courts in rotating is an n=8 board and comes off the n=8 Table.

The **Pool count** on the Config deals the Roster at random off the Seed, as evenly as the numbers allow, and a redraw deals again. The deal deals the Format's own unit, the same noun-over-different-units shape the Scorer already has: Players in rotating and singles, Pairings in fixed partners so no pair is torn in two, and `M` and `F` as separate queues under mixed doubles, so a Roster that is mixable as Pools is never refused because of the deal. The deal is random in who and never in how many, which is what lets the consequence line describe every Pool before anything is drawn. Pool A draws with the raw Seed and the others with Seeds derived from it, so two Pools of the same size are not the same grid with different names on it. At one Pool there is no deal at all, not a deal of one.

A Pool's courts are allocated once for the night and never move: one each, then each spare court to whichever Pool sits the most people out per Round, capped at what that Pool can fill. Fewer courts than Pools is refused, because a Pool with no court is not a Pool. More courts than the Pools can fill is not, on mixed doubles' precedent that the court count is a fact about the evening. Any Pool's refusal refuses the whole board, and the message names the Pool.

On the board a pooled night is one field with a band of columns per Pool, headed by a vinyl strip with the Pool's name knocked out of it, and each Pool's summary line stacked where the one summary line has always sat. On a phone each Round shows every court, grouped under its Pool's strip.

Not built yet: **Pool headers** in the Roster (a line beginning `---`, optionally labelled, which win over the count when present) and **Keep this split**, which writes the current deal into the roster box as headers ([ADR 0005](docs/adr/0005-the-roster-declares-the-pools.md), RR-6.2 #553). When headers land, the **Roster** entry gains order's second deliberate meaning: where a line sits relative to a header. And find-me on a pooled board (RR-6.3 #554): today it holds the other Pools' bands back as outside the evening, but its words do not yet name the Pool, and **Selection**'s board identity carries the Pool count only because the draw key does.
_Avoid_: Group (too loose to mean anything), flight, division, heat, bracket (nothing here is elimination), court group

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

See [docs/adr/0001-config-and-schedule-are-not-event-sourced.md](docs/adr/0001-config-and-schedule-are-not-event-sourced.md), [docs/adr/0002-precomputed-tables-are-whist-prefixes.md](docs/adr/0002-precomputed-tables-are-whist-prefixes.md), [docs/adr/0003-a-format-is-a-generator-not-a-cost-term.md](docs/adr/0003-a-format-is-a-generator-not-a-cost-term.md), [docs/adr/0004-pools-partition-above-a-pool-blind-engine.md](docs/adr/0004-pools-partition-above-a-pool-blind-engine.md) and [docs/adr/0005-the-roster-declares-the-pools.md](docs/adr/0005-the-roster-declares-the-pools.md).
