# On Deck Foursomes are committed, not recomputed

On Deck stages the next two Foursomes ahead of any Court freeing. Each Foursome is **committed** at the instant it is selected and carried forward in `reduceSession`'s accumulator (`state.onDeck`). It is never recomputed from the current Queue on a read.

A later event may only:

- **top up** an incomplete Foursome — one formed while the Queue was too short — by appending the next-longest-waiting unspoken-for Players in wait order, leaving its existing members in place; or
- **drop** a Player who has since left the Queue (walked onto a Court).

A Player joining, queueing, pausing, or being added by a Volunteer never reshuffles a Foursome already announced.

## Why

The whole point of On Deck is that the eight named Players can gather — walk to the court, put their water bottles down — instead of being hunted down when a Court frees. That only works if the names on the board stay put. A board that reshuffled every time someone new tapped "join the queue" would send Players back and forth and defeat itself. Wait Time fairness is already protected by the anchor (ADR 0004): whoever is at the front is in the next Foursome, and once they are committed the board owes them stability more than it owes a marginally better Skill fit to the average.

This overrides the earlier "recomputed continuously" language in `CONTEXT.md` (issue #245, per the #238 architecture).

## Consequences

- `state.onDeck` is part of the fold's state, mutated only by `refreshOnDeck` after a Queue-changing event. Because the fold is a pure function of `(config, events)`, replay and undo (drop the last event, re-fold) still reproduce On Deck exactly.
- A Foursome can be committed with a sub-optimal Skill mix if only four Players were waiting when it formed. That is the accepted cost of commitment; it does not get re-mixed as better-fitting Players arrive.
- When a Court frees, `state.onDeck[0]` (complete, still fully in the Queue) walks straight on with no Match Me call. Match Me runs only to form the *fresh* Foursome that refills the second slot.
- Fresh Foursomes are still selected with the full ADR 0004 algorithm — anchor, window, Skill, Variety — over the Players not already committed to On Deck or seated on a Court.
