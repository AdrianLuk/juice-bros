# 0003 — A Format is a generator, not a cost term

Date: 2026-09-19
Status: Accepted
Context: Match Mixer (RR-4.1, #543)

## The decision

Each **Format** is its own generator, chosen before anything is searched for.
Fixed partners does not reach the rotating generator with a weight attached to
it; it goes to a construction of its own, and `generateSchedule` routes on the
Format as its first act.

The **Scorer** takes the Format too, and answers a different question in each.
`ScorerResult` is a union, so a reader has to say which board it is looking at
before it can read a verdict off it.

## Why not a cost term

A cost term is the obvious shape. The rotating generator already searches a
weighted landscape, and "keep these two together" reads like one more weight —
one that happens to be infinite.

It is the wrong shape for two reasons, and they are different reasons.

**There is nothing left to search for.** The rotating generator's entire
purpose is to minimise partner repeats: it builds a Round greedily by cheapest
partner, improves it by swapping seats while that helps, throws the attempt
away and tries again from a different random order, and picks the winner by
cost. In fixed partners the pairs are given and rotate as units. Once the pairs
are fixed the only remaining question is which pair meets which, and that
question has a closed-form answer — the circle method over `n / 2` teams,
where every team meets every other exactly once. Handing a solved problem to a
randomized search is slower, non-deterministic in its quality, and worse at the
thing the construction does exactly.

**The search would be looking for what it was built to avoid.** Every partner
repeat on a fixed-partner board is deliberate. `partnerCost` prices them at
`PARTNER_REPEAT_WEIGHT` each and they compound, so a correct fixed-partner
Round is the most expensive Round the cost function can describe. Making the
search produce one means either inverting the sign of its dominant term for
this Format, or setting a term so large it swamps the others — at which point
the search is no longer choosing between candidates, it is enumerating the one
family of candidates that satisfies a hard constraint, badly and at random.

A hard constraint is not a heavy weight. It is a different problem.

## What follows from it

**No Format but rotating reaches `findTable`.** Every stored Table is a whist
tournament, and ADR 0002's guarantee — that any leading run of one is still
perfectly balanced — is a claim about rotating doubles that says nothing at all
about any other Format. An n=12 Table handed to a fixed-partner night is not a
worse board, it is a board in the wrong Format. The routing is what makes that
unreachable rather than merely unlikely.

**The Scorer had to move with it.** This is the part that was not obvious when
the decision was written down as "separate generators". Nothing in the app may
claim a Schedule is balanced except the Scorer, so a Format whose generator the
Scorer does not know about can only be described by something else deciding
what balance means — the grid, the summary line, a special case. Scored as a
rotating board, a correct fixed-partner Schedule reports every pair on it as a
repeat and costs in the thousands. The verdict would have been not merely
useless but confidently wrong, in the one sentence on the board that an
organizer reads as a verdict.

So `ScorerResult` became a union: rotating counts partner repeats and
partnership coverage, fixed counts rematches between Pairings and matchup
coverage. What they share — the raw counts, the price, the Bye verdict — is
shared, and the Bye verdict needed no variant at all, because both members of a
sitting Pairing sit and the spread over Players is already the spread over
Pairings.

**The Repeat mark follows the failure, not the element.** Rotating rings the
side that partnered twice. Fixed rings the whole Game, because the pair is the
constant and the matchup is the thing that can repeat. The mark is the Scorer's
failure signal made visible, so when the Scorer's question changes, what the
mark encircles changes with it.

## What this does not decide

**It does not make every Format a generator by default.** RR-4.3's mixed
doubles (#545) is a hard constraint *inside* the rotating generator's seating,
and rightly so: the pairs are still rotating, still searched for, still
minimising partner repeats. What it adds is a restriction on which seatings are
legal, which is a real constraint in a real search. Skill balance, had it
survived, would have been a genuine cost term — a lopsided skill pairing comes
out in the wash over eight rounds, which is exactly what a weight is for and
what a hard constraint is not.

The test is not "does this change the board". It is whether there is still a
space of candidates worth searching once the rule is applied. Fixed partners
has one candidate family and a construction that lands on it; mixed doubles has
a search with fewer legal moves.

**It does not settle `GENERATOR_VERSION`.** The rule the code states is that a
bump is owed when a change alters what an *existing* Config generates. Adding a
Format does not, by itself, move rotating. RR-4.1 pinned both rotating paths in
`schedule.test.ts` and did not bump, because neither pin had to change. A later
Format inherits the same obligation and the same way of discharging it: change
the pins or do not bump.

## Consequences

- `lib/engine/fixed.ts` carries the same "bump `GENERATOR_VERSION`" notice as
  `generator.ts`, `tables.ts` and `scorer.ts`. A change to a construction is a
  change to what a Seed reproduces, whichever construction it is.
- A Format that cannot seat a Roster refuses rather than dropping somebody:
  `formatObjection` is asked by the screen before drawing and by
  `generateSchedule` again at the entry point.
- The Share Link carries the Format as a field appended to the number line, so
  a link minted before Formats existed reads as rotating and keeps working. A
  Format code the build does not know is refused rather than substituted, on
  the same reasoning as the payload's checksum: a board nobody drew is worse
  than no board.
