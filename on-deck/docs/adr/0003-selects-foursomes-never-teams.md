# On Deck selects Foursomes, never teams

The app picks the four Players for a Court and stops there. It does not split them into 2v2, does not balance teams by Skill Level, and does not record who partnered with whom. The four sort it out on the court, as they already do.

## Considered options

**Assigning balanced teams** was seriously considered and rejected. It is tempting: pairing strongest with weakest keeps games close, and it would let Variety operate at the sharper partner level ("you played *with* Mike last game, so this round you're against him") rather than the blunter foursome level.

It loses on three counts. It leans hard on self-reported Skill Level, which is noisy enough that "balanced" would often be wrong. It makes the app prescriptive at an event whose stated purpose is community over competition, when the design goal Vanessa set out twice was to *give players control*. And it is not what she asked for - her spec is about who you are "matched with", never about who you partner with.

## Consequences

Variety is a foursome-level preference, not a partnership-level one, and the data model never needs a partner concept. No Game outcome is recorded either - no score, no winner - because nothing in the product consumes one. A future club wanting king-of-the-court would need both, and that is a different product mode, not a small addition.
