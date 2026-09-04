# Precomputed Tables are whist tournaments, keyed by roster size and court count

The implementation brief stores Tables as `{ "n": 8, "rounds": [...] }`, keyed on roster size alone. That is unsound: the classic n=8 Table is seven Rounds of two Games and silently assumes two courts, so handing it to a club with one court yields a Schedule that seats eight Players when only four can play. Tables are therefore keyed on `(n, courts)` and exist only where `courts === n / 4`.

Every stored Table is a whist tournament — n−1 Rounds in which each Player partners every other exactly once, opposes every other exactly twice, and nobody sits out. This makes the n=16 Table fifteen Rounds long, far more than any club plays, and that is deliberate: **any leading run of a whist tournament's Rounds still has zero partner repeats, at most two opponent repeats and no Byes**, so it scores zero under the Scorer. Tables are stored whole and served as prefixes, and truncation is the normal case rather than a compromise.

## Consequences

Everything else falls through to the randomised greedy generator: fewer courts than `n / 4`, a Roster size not divisible by four, or more Rounds than the Table holds. Where a Table exists but the requested Round count exceeds it, the generator continues from the Table's prefix and its accumulated partner and opponent counts rather than starting cold — the same "carry on from current counts" mechanism that regenerating around a late arrival will need.

Because a Schedule may come from either source, no claim about balance may be derived from the Config. The summary line and the Partner Matrix both read the Scorer's output on the Schedule that was actually produced.

Every Table is validated by the Scorer in tests before it is trusted. Published round robin schedules contain errors often enough that a Table is not evidence of its own correctness.
