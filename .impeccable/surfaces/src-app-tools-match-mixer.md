---
version: 1
slug: "src-app-tools-match-mixer"
primary_target: "src/app/tools/match-mixer"
related_targets: ["src/components/apps/match-mixer","match-mixer/CONTEXT.md"]
---

## Scope and mode

Match Mixer's only screen, at `/tools/match-mixer`. Visitor mode **Operate**: the organizer
has a job to finish before the next round starts.

Match Mixer is its own visual world, outside the marketing site's Broadcast Dark scope, the
same way Booking Buddy, On Deck and Pickle Point Pal are. `SiteShell` already lists it in
`DARK_EXCEPTIONS`.

## Audience and job

A rec-level organizer standing at a folding table in a sports hall, phone in hand, with eight
to twenty people waiting. The job: paste tonight's names, set courts and rounds, read out who
is on which court, and redraw when someone arrives or leaves.

## Constraints

- **Screen first** (decided 2026-09-09). The paper premise is retired as the governing rule:
  colour, depth and motion are all in play. The existing print stylesheet stays and keeps
  printing the same clean grid — it no longer dictates the screen.
- Behaviour is untouched: generator, scorer, Config/Schedule/Seed model, localStorage
  persistence, duplicate-name handling, roster parsing, and nothing leaving the browser.
- No handwriting anywhere. Rejected by Adrian on legibility: a webfont stamps the identical
  glyph each time, and the task is telling Anna Leigh Waters from Anna Bright at a glance.

## Direction contract

**THESIS:** The manufactured magnetic planning board by the court door. Refuses both the SaaS
form-and-table tool page and the printed sheet it replaces.

**OWN-WORLD:** A lit enamel face carrying two faint wipe-ghost bands, inside an aluminium
surround with a pen tray. Board furniture is flush dark vinyl set in tracked Archivo Narrow
caps: club plate, column rails, round numerals. Names ride white magnet plates in Archivo,
each rotated a fraction off-square. Marker is colour and gesture only — a red repeat ring
drawn as a stroke, green for sitting out. No cards, no radius language, no page around the
board.

**STORY:** The organizer reads the fairness verdict, finds a name in one glance, and presses
one red magnet to redraw.

**FIRST VIEWPORT:** The board fills the frame edge to edge, no page margin. Club plate
top-left, the night's particulars beside it, the scorer's verdict beneath. Left column: the
Tonight rail, the roster insert card, courts and rounds dials, then the red "Wipe & redraw"
magnet. Right: the ruled field, rounds down, courts across, Off last. Signature interaction —
the wipe and reset: the field sweeps clear left to right and plates drop back row by row,
each settling with a magnet's bounce; reduced motion cuts to the settled board.

**FORM:** The Board, candidate 1 of 7 on the grounded list — the user's pick over the roll's
assignment (candidate 6, the amateur meet programme) and over the standing exit. Seed key
`08f41571`, mode operate, code-led. The roll ran degraded: no catalog challengers, no
quality-bar boards.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment

The wipe. Redrawing is not a table re-render — it is the field being swept clear and re-set,
which is the gesture the physical object already owns.

## Unresolved

- Brand orange is unspent in this world. The old design reserved it for a future "round in
  progress" state; the board's equivalent is a magnet or rail highlight, undecided until that
  milestone exists.
- The Mixer / Lock milestone (rounds marked as played) will want a locked-plate treatment.
  Not designed yet.
