# 0004 — Pools partition above a pool-blind engine

Date: 2026-09-23
Status: Accepted
Context: Match Mixer (RR-6, #392). Specced in a `/grill-with-docs` pass; not yet
built.

## The decision

A **Pool** is a part of the Roster playing its own complete round robin on
courts of its own. Pools are made by one new layer that sits above
`generateSchedule` and nowhere else: it partitions the Roster, allocates courts,
calls `generateSchedule` once per Pool with that Pool's own **sub-roster**, and
collects the results as a list of Pools, each carrying its label, its sub-roster,
its courts, its Schedule and its Scorer reading.

Nothing below that layer ever hears the word. The generator, the Tables, the
Scorer, the Itinerary and the grid each receive a roster indexed from zero and a
Schedule over it, which is exactly what they receive today.

## Why not tag the games

The obvious shape is one Schedule for the night with a `pool` on every Game.
Every reader then learns to filter by it: the Scorer counts partnerships per
pool, the Itinerary looks only at its pool's Games, the grid groups columns, and
RR-2's Lock would one day learn it too.

It is the wrong shape because of what those readers compute. Coverage, Bye
spread and `pairingsPossible` are all ratios against a denominator, and a pooled
board has a different denominator per pool. A reader that forgets to filter does
not crash. It reports a true count against the wrong total, which is precisely
the failure `ScorerResult` was made a union to prevent (ADR 0003). Tagging would
put that trap in every reader; partitioning puts it in none.

It would also break the Tables. ADR 0002 keys a Table on `(n, courts)`. Under
tagging there is one roster of 16 and no Table applies to either of its pools.
Under partition, a Pool of 8 on 2 courts *is* an n=8 board and gets the real
Table, with every guarantee ADR 0002 makes about its prefixes.

And it is what makes pools orthogonal to the Format by construction rather than
by care. Each Pool goes down the same routing it would have gone down alone:
rotating, fixed partners, singles, mixed doubles, Table or search. Pools cost the
Formats nothing, and a Format added later costs pools nothing.

## What follows from it

**The partition deals the Format's own unit.** Players in rotating and singles.
Pairings in fixed partners, so no pair is torn in two. Under mixed doubles, `M`
and `F` as two separate queues, so each Pool's marker counts come out as even as
the numbers allow rather than the deal manufacturing a Pool that mixed doubles
then refuses. This is the Scorer's existing shape, the same noun counted over
different units.

**Courts are allocated once for the night and never move.** Each Pool gets one
court, then each remaining court goes to whichever Pool currently sits out the
most per Round, capped at what that Pool can fill. It is deterministic and needs
no Seed. Rotating a remainder court between Pools was rejected: a court is where
people walk, a Pool that moves down the gym mid-evening is the confusion this
tool exists to prevent, and it gives each Pool a column count that changes by
Round. Where a fixed allocation is uneven, the consequence line says so rather
than a rotation hiding it.

Fewer courts than Pools is refused, because a Pool with no court is not a Pool.
More courts than the Pools can fill is not refused, on mixed doubles' precedent
that the court count is a fact about the evening and a default, never a ceiling.
The board says which courts stand empty.

**The layer rewrites `Game.court` to the real court.** A Pool's generator numbers
its courts from zero. Left alone, two Pools would both send somebody to court 1.
With one Pool the offset is zero and the Schedule is unchanged.

**Pool A keeps the raw Seed.** Every other Pool draws from a Seed derived from it,
or two Pools of the same size would come out as the same grid with different
names on it. Pool index 0 must take the Seed unchanged, and with one Pool there
is no deal at all, not a deal of one: nothing may touch the random stream before
the generator does. Together those are what let RR-6 ship without bumping
`GENERATOR_VERSION`, because every Config that exists today is a one-Pool Config
and draws exactly the board it drew before.

**Size limits belong to a Pool.** At least 4 Players and at most 32 per Pool, and
at most `min(32 × pools, 64)` overall. Both reasons for the old 32 cap were
reasons about one rotation, the grid fitting a sheet and the search staying
quick, and a rotation is now a Pool.

**One refusal is the whole board's.** Each Pool runs its own Format and mixed
doubles objections against its own sub-roster. If any Pool is refused, the board
does not draw, and the message names the Pool. A board with Pools A and C drawn
and B in error is a partial state nothing else in the tool has, and RR-2's Lock
would have to understand it.

**The Round count is shared.** A Round is a time slot across every court, and
the room calls "next round" once. The default is the shortest Pool's natural
length, capped at the usual eight, which keeps the invariant that the default
board never asks for more Rounds than the partnership supply holds. The
consequence line names the Pool that set it.

**There is no verdict for the night.** Each Pool prints its own summary line off
its own Scorer, and nothing combines them. The Scorer's unit is the Pool, and
averaging a complete five-player rotation with a third of a twelve-player one
produces a number with no referent. The existing rule, that nothing claims a
Schedule is balanced except the Scorer, then gives the answer for free.

## What this does not decide

Who is in which Pool. That is ADR 0005: the Roster can declare the Pools, and a
Pool count can deal them. This ADR holds whichever way the partition was made.

## Consequences

RR-2 is built against this shape. Because every Pool plays the same Round count,
a Lock on Round 3 means Round 3 in every Pool, and the event log never needs a
Pool coordinate for it. That was the reason RR-6 was ordered ahead of RR-2.

The one place that knows about Pools is also the one place that maps a global
Roster index to a Pool and a position in it. A **Selection** stays a global
index and resolves through it, so find-me still means "line 3 of the list I
typed" after the Pools are redrawn.

Do not "simplify" this into pool-tagged Games so the grid can iterate one
Schedule. The grid rendering one table with a band per Pool is a view over a list
of Pools, and building it that way costs one loop; tagging costs a denominator
check in every reader forever.
