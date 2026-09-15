---
version: 1
slug: "src-app-on-deck-home"
primary_target: "src/app/on-deck/home"
related_targets: ["src/components/on-deck/create-club-form.tsx","src/app/on-deck/home/settings","on-deck/DESIGN.md"]
---

# On Deck Organizer home (`/on-deck/home`)

Scope: the signed-in Organizer's own screens — `/on-deck/home` (both states) and
`/on-deck/home/settings`. Mode: Operate — one person completing a task on a phone.

Audience/job: the Organizer who owns the Club, opening this in a car park before a
social or on a weeknight. On most visits the job is Start tonight; on the first visit it
is get a Club at all (#515). Never read across a room, always read at arm's length.

This joins the Arena Board world documented in `on-deck/DESIGN.md`, which currently lists
these pages as out of scope on the default shadcn light theme. That line is corrected when
this ships: the Organizer's own screens were the last On Deck surface wearing a theme
nothing else uses. It runs `.od-arena` directly rather than a quoted local scope — unlike
the marketing landing, this *is* the app, and sharing the live board's tokens is the point.

## Direction contract

THESIS: One lit panel carries the Organizer's single next action and nothing competes with
it; everything else drops to a numbered rail. Refuses the dashboard of equal same-weight
cards this screen ships today.

OWN-WORLD: The Arena Board at arm's length, not gym distance. Near-black `--arena-bg`
running behind the header, bolted `.od-panel` with its lit top edge, Saira Condensed board
voice for the Club's name and every key, Geist Mono `.od-readout` for spec lines and
counts, milled `.od-key`. Orange stays rationed to LIVE — here that is a Session actually
running. `.od-next` cool marks the action waiting for you.

STORY: The Organizer sees one thing to do and the key that does it, reaches the sign, past
nights and settings without them fighting for the same attention, and leaves having tapped
once.

FIRST VIEWPORT: Arena ground behind the header. A mono account line, the Club's name in
board type. Then one panel filling the upper screen, carrying the current job with its key
at the foot: no Club, two numbered fields and CREATE THE CLUB; Club idle, tonight's spec
readout and START; Session open, the panel goes `.od-live` orange and reads OPEN THE FLOOR.
Beneath it one numbered `.od-rail` of everything else as rows, never cards.

FORM: "One Thing Lit" — index 4 of 7 grounded structural candidates ordered by resonance,
dealt lead, seed key `7323f5fb`, scope surface / mode operate.

SIGNATURE INTERACTION: the lit panel is one object across all three states. It changes its
state class and its key, never its position, so the Organizer's thumb lands in the same
place every week and the colour says which week it is. Raise donated by the declined
challenger `signals-instruments-darkroom-safelight-bay` (test strip before the irreversible
commit): the Club's name renders in board type as it is typed, because creation is
one-per-account with no delete.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

- Whether the first-night kit (#521) lands inside the lit panel or as the rail's first row
  is that ticket's call, not this one's.
