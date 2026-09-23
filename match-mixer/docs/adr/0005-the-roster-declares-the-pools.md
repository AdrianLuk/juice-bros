# 0005 — The Roster declares the Pools; the Pool count only draws them

Date: 2026-09-23
Status: Accepted
Context: Match Mixer (RR-6, #392). Specced in a `/grill-with-docs` pass; not yet
built. Supersedes the "assignment is random, off the existing Seed" line in the
original #392 spec and in `docs/next-steps-2026-09.md`.

## The decision

There are two ways to say who is in which **Pool**, and one rule for when they
disagree.

1. **Pool headers in the Roster.** A line beginning `---` starts a Pool. It may
   carry a label (`--- 4.0`), which becomes the Pool's name; a bare `---` falls
   back to its letter by position. A leading header is optional, so a list with
   one `---` in the middle is Pool A and Pool B.
2. **A Pool count on the Config.** With no headers in the Roster, the count
   deals the Roster at random off the Seed, as evenly as the numbers allow, and
   "regenerate" deals again.

**If the Roster has headers, they are the Pools**, and the count goes quiet. The
rule the screen should be able to say in a sentence: if you drew the lines they
are yours, and if you didn't, the tool draws them.

**Keep this split** bridges the two. It writes the current random deal into the
roster box as bare `---` lines, after which the split belongs to the organizer
and they can move a name across a line. It is the only thing in the tool that
ever writes to the roster box, and only when pressed.

## Why not random only

The original spec made assignment random and opened its problem statement with
"a 4.0 group and a 3.0 group". A random deal cannot produce that night. It
produces two groups of mixed level, which is what the organizer was splitting to
avoid.

Random-only also struggles on the other half of the claim, "too many people for
one rotation". A roster that fits the cap already rotates in one Schedule, and
that Schedule is strictly better on every measure the Scorer owns: more
partnerships to spend, more coverage, fewer forced repeats. Splitting it at
random buys a shorter grid at the cost of balance. Pools earn their complexity
when the partition means something, and random is the one version where it
means nothing. The count stays because it is the discoverable half, and because
"give me two random eights, no, again" is a real thing to want.

## Why not headers only

Nobody finds `---` in a textarea on their own. A Pool count is a control that
announces the feature; a text convention is not. Headers alone also lose
"regenerate reshuffles the Pools", which was already promised in the issue and
is the natural reading of the redraw button. Keep this split is what lets the
control teach the convention: it puts the lines in the organizer's own box.

## Why not the count writing the headers every time

The tidier shape is one state: turning the count rewrites the roster box, and the
count on screen is derived by counting headers. It was rejected because a control
silently rewriting typed text is the one edit this tool has never made, undo in a
controlled textarea is not dependable, pasting a fresh list would wipe the lines
and drop the count to one without a word, and a redraw could no longer reshuffle
names it had already written down. Keep this split does the same rewrite as a
named action instead of as a side effect.

## Why not a marker on each line

Mixed doubles reads a trailing `M` or `F`, so a trailing pool letter (`Sam A`) is
the obvious precedent. It is rejected on that precedent's own terms. The Player
entry in `CONTEXT.md` says nothing else may follow the Marker in without the
same argument, and the argument does not transfer: a pool is where a line sits
in the list for one night, not something the tool holds about a person. It would
also widen the last-initial collision the Marker already manages from two
letters to twenty-six.

## Why `---` and not a blank line

`parseRoster` drops blank lines. A list pasted out of a group chat routinely
carries stray ones, so a blank-line divider would silently split rosters that
already exist, in saved Configs and in Share Links, into Pools nobody asked for.
`---` currently reads as a Player named `---`, which is also a change of meaning,
but a visible one on a name nobody has.

## Why the label lives on the divider

The original spec deferred naming ("Pool A/B/C, not editable in v1; a rename
field is a cheap follow-up"). Once the Roster declares the Pools, the organizer
is already typing the line a name belongs on, and the parse is already reading
it. A rename field would be a new control for something that already has a
place. Naming also carries the meaning the split was made for: a board that
calls the 4.0s "Pool A" makes whoever holds the phone remember which is which.

## Consequences

**Roster order gains its second deliberate meaning.** Fixed partners made
consecutive lines a Pairing. Headers make where a line sits relative to a `---`
its Pool. Order still carries no seeding and no ranking in any Format.

**Headers are read before anything else on the line.** A line starting `---` is
never a name and never carries a Marker, so `--- F` is a Pool called "F". Headers
are gone before `duplicateNames` counts anything. Labels are trimmed and capped
at around 24 characters, because they land on a rail label and on paper.

**Fixed partners refuses a header on an odd boundary.** A Pool with an odd count
in fixed partners has a Player with nobody to partner, the same refusal an odd
Roster gets today, now naming the Pool.

**Each mechanism travels as what it is.** Headers ride inside the Share Link's
roster block, under the checksum, and arrive labelled. The count rides on the
number line as the eighth field, appended after mixed doubles, absent reading as
one Pool. A link does not materialise a random deal into headers: that would
turn a dealt board into a declared one in the reader's hands, quieting a count
they could otherwise turn and changing what their redraw does. The link carries
the Config, and a dealt split is Config.
