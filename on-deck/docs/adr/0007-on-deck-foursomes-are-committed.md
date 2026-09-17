# On Deck Foursomes are committed, not recomputed

On Deck stages the next two Foursomes ahead of any Court freeing. Each Foursome is **committed** at the instant it is selected and carried forward in `reduceSession`'s accumulator (`state.onDeck`). It is never recomputed from the current Queue on a read.

**Commitment begins when the night does** — from the moment the first Foursome walks onto a Court (`nightHasStarted`). Before that, On Deck is re-formed from the whole Queue on every change. See the amendment at the foot of this record for why.

A later event may only:

- **top up** an incomplete Foursome — one formed while the Queue was too short — by appending the next-longest-waiting unspoken-for Players in wait order, leaving its existing members in place; or
- **drop** a Player who has since left the Queue (walked onto a Court).

A Player joining, queueing, pausing, or being added by a Volunteer never reshuffles a Foursome already announced.

## Why

The whole point of On Deck is that the eight named Players can gather — walk to the court, put their water bottles down — instead of being hunted down when a Court frees. That only works if the names on the board stay put. A board that reshuffled every time someone new tapped "join the queue" would send Players back and forth and defeat itself. Wait Time fairness is already protected by the anchor (ADR 0004): whoever is at the front is in the next Foursome, and once they are committed the board owes them stability more than it owes a marginally better Skill fit to the average.

This overrides the earlier "recomputed continuously" language in `CONTEXT.md` (issue #245, per the #238 architecture).

## Consequences

- `state.onDeck` is part of the fold's state, mutated only by `refreshOnDeck` after a Queue-changing event. Because the fold is a pure function of `(config, events)`, replay and undo (drop the last event, re-fold) still reproduce On Deck exactly.
- ~~**Early-session Foursomes are close to arrival order.**~~ *(Amended 2026-09-17 — see below. The paragraph is kept as written because the amendment is a reply to it.)* Players join one at a time (each `PLAYER_QUEUED` is one Player), and `refreshOnDeck` commits a Foursome as soon as four uncommitted Players are waiting. So the first Foursome is "the first four to tap Join" and the second is "the next four by Wait Time" — Match Me's window has nothing to range over until five or more uncommitted Players are waiting at once, which first happens when a `COURT_FINISHED` re-queues four together. This is the accepted cost of commitment: a board that waited for a fuller window before naming anyone would leave the first eight Players with nothing to gather around, which is the whole thing On Deck exists to fix. Skill and Variety matching assert themselves from the first mid-session refill onward, and Wait Time fairness (the anchor) holds from the very first Foursome.
- When a Court frees, `state.onDeck[0]` (complete, still fully in the Queue) walks straight on with no Match Me call. Match Me runs only to form the *fresh* Foursome that refills the second slot.
- Fresh Foursomes are still selected with the full ADR 0004 algorithm — anchor, window, Skill, Variety — over the Players not already committed to On Deck or seated on a Court.

## Amendment, 2026-09-17 (issue #533)

Commitment now starts when the first Foursome walks onto a Court. Until then, On Deck is re-formed from the whole Queue on every change, and the first Games of a night are Match Me's picks over everyone waiting.

**What changed our mind.** The consequence above was written assuming Courts go out as soon as four people have arrived, so the cost was "the first eight Players". The browser demo (#519) was the first thing to fold a whole night end to end, and it showed the ordinary case instead: at a club where the doors open before play does, twenty-four Players can be queued before the Organizer taps Send next four. On five Courts that is the first twenty of forty Players — roughly the opening quarter of the evening — seated in arrival order, with a three-level Skill spread on every one of the opening Courts. That is not the cost this record accepted; it is an order of magnitude more of it, and it lands on the part of the night an Organizer is most likely to be judging the matching by.

**Why the original objection does not hold here.** The reason given for committing early is that the eight named Players can gather instead of being hunted down. Two things about the pre-start window:

- No Court can free, because no Court is occupied. There is nothing to gather *ahead of*. The Players named before the night starts are not being given a head start; they are being given a prediction.
- The premise is weaker than it reads even mid-Session. Players do not reliably know a Court has freed — that depends on a Display or Kiosk being in the room, or on the opt-in turn notification (#260), and the organizer this product is now built for (OD-6, #512) has neither a spare tablet nor a volunteer. Stability is worth less than this record assumed. It is still worth something once a Foursome could genuinely be called at any moment, which is why the rule is narrowed rather than dropped.

**What is unchanged.** From the first seating onward, everything above holds exactly as written: committed, never reshuffled, top-up and drop only. Wait Time fairness was never what was being traded — the anchor (ADR 0004) holds in both windows, so the longest-waiting Player is in the next Foursome either way, and nobody can be displaced from the front of the line by a re-form.

**Consequence.** The pre-start On Deck cards change as the room fills. That is honest — nothing has started — but it means a Player who glances at the board at 18:50 may not be on it at 18:55. Only Players behind the anchor can move. The turn notification is suppressed until the night starts for the same reason: "head to the courts" is wrong advice while every Court is empty, and buzzing each revision of a prediction would be noise.
