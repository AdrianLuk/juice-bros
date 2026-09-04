---
version: 1
slug: "src-app-tools-pickle-point-pal"
primary_target: "src/app/tools/pickle-point-pal"
related_targets: ["src/components/apps/pickle-point-pal"]
---

# Surface: Pickle Point Pal

Route `/tools/pickle-point-pal`. Primary target `src/app/tools/pickle-point-pal`;
logic + screens in `src/components/apps/pickle-point-pal`.

## Scope & mode

Operate (the tool) with a short Persuade tail (the marketing/FAQ block below it).
In scope: the whole route — setup → coin toss → live match → timeout → game-over →
summary → resume prompt, **and** `PicklePointPalAbout` (pitch + FAQ). Visual redesign
only: every scoring rule, the append-only event log + undo/redo, the mirrored court,
`ref-landscape` "standing at the net" layout, PWA plumbing, and all copy semantics
stay exactly as built.

## Audience & job

A rec-level player refereeing a pickup/rec/tournament match — phone or small tablet
in one hand, outdoors, direct sun, wind, disputes. Job: call the score aloud between
rallies from a glance, run the timeout clock, and defend every call afterward.
Constraints: sunlight legibility and glance-speed outrank everything; surface stays
locked light (PRODUCT.md brand commitment); brand orange `#f26522` stays undarkened;
must hold in portrait **and** `ref-landscape`.

## Direction contract

THESIS: Pickle Point Pal is officiating equipment, not an app — the tournament ref's
issued instrument. It refuses the unstyled-white-utility default it currently is, and
refuses the dark-neon-broadcast-scoreboard that is its predictable opposite. The score
is stated the way an umpire states it: fixed, plain, unmissable from ten feet in the sun.

OWN-WORLD: An anodized-graphite instrument body (matte charcoal frame + machined
details, never rendered chrome) cradling a bright near-white **reflective readout
panel** — the positive-LCD translation of the seven-segment world, so the surface
stays light per the locked-light commitment. Numerals live in fixed segmented cells
with visible ghost segments (absence drawn as deliberately as a lit digit). One
hi-vis accent only: brand orange `#f26522`, meaning "serving / live / clock running"
and nothing else. Screen-printed uppercase mono legends label every control like
equipment silkscreen. One rigid machined-panel grid governs every screen; setup and
the FAQ are the "spec sheet / manual" register of the same instrument. Type:
condensed industrial grotesk for legends + team plates, workhorse grotesk for prose,
mono for legends/data; the score readout is its own segmented display, not a font.

STORY: The ref picks it up, reads whose serve it is and the exact score call in
spoken order without hunting, taps one of two clearly-legended team keys per rally,
and can pull a defensible printed-looking log of every call. They trust it is real
kit that will not embarrass them mid-dispute.

FIRST VIEWPORT (live Match Screen, portrait): a thin etched status strip (game X/Y,
games won, format legend) across the charcoal frame. Below it the readout panel fills
the upper half: kicker "SCORE CALL", then the score as large fixed-cell segmented
numerals — serving · receiving · server# in spoken order, cap height dominating the
panel — with the orange serve bar pinned to the serving team's edge; under it one
plain line naming server, court, receiver. Inset into the frame below: the court as a
line-only engraved schematic, mirrored to the ref's side. Bottom third: the two rally
keys as full-width membrane buttons, side by side on the sides their teams' courts are
drawn on, each with the team name + a silkscreen legend (POINT / SIDE OUT / 2ND
SERVE); the serving key carries the orange hairline + orange legend. Undo/redo,
timeouts, technical calls sit one deliberate scroll below as recessed secondary
controls. In `ref-landscape` the same parts reflow to left-key · [panel + court] ·
right-key with the keys pinned to the device edges. Primary action = the two team keys.

FORM: "The Officiating Instrument" — chair-umpire / racket-sport officiating equipment
fused with the seven-segment display grammar for the readout. Grounded candidate 3 of
7 by resonance. Seed key 7107de82. Code-led (no image generation available); the
approved HTML mockup of this match screen (artifact 66991d4b) is the critique
reference. Raises folded in: seven-segment readout with designed ghost cells + instant
per-segment swap (from Seven-Segment, competitive); a distinct official warning-class
mark per non-score state — each timeout kind, technical warning, technical foul, side
switch (from Info-Noise, declined); the serve indicator as the loudest non-numeric
element, a locked hi-vis bar that snaps sides on a side-out (from Rhythm-Machine,
declined); type intensity escalating with urgency in fixed position — game point, and
a timeout clock under ten seconds (from Variety Telop, declined); one rigid
machined-panel grid across every screen (from ASCII render, declined).

Signature interaction: the segment swap — every score change resolves as an instant
per-segment ignite/extinguish on the readout (a real scoreboard slamming from 98 to
100), a hair of per-segment stagger; `prefers-reduced-motion` gets the instant swap
with no stagger. Paired with the hi-vis serve bar snapping to the other edge on a
side-out.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Memorable moment

The score readout: fixed segmented cells with ghost segments always faintly present,
the number changing by segments igniting, never sliding or counting.

## Unresolved

- Numeral face for the segmented readout: true CSS 7-segment geometry vs a segmented
  display font — decide at build from legibility at `ScoreCall`'s clamp sizes.
- PWA icon gap (no 192/512 PNG) is pre-existing and out of scope unless a rasterizer
  appears.
- FAQ/`PicklePointPalAbout` register: "manual/spec-sheet" treatment, depth TBD at build.
