---
name: Match Mixer
description: The manufactured magnetic planning board by the court door — enamel, aluminium, cut vinyl, and names on white plates.
colors:
  enamel: "#eff3f3"
  enamel-shade: "#dde4e5"
  vinyl: "#1b2023"
  vinyl-quiet: "#545d62"
  plate: "#ffffff"
  plate-edge: "#b7c0c2"
  mark-red: "#c0392f"
  mark-green: "#1f6039"
  alu-hi: "#ced3d7"
  alu: "#b2b9bf"
  alu-lo: "#939aa1"
  rule: "rgb(27 32 35 / 0.16)"
  tray-stamp: "#2b3134"
typography:
  display:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.17em"
  title:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
    fontFeature: "tabular-nums"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "0.5625rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.2em"
  meta:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "0.14em"
    fontFeature: "tabular-nums"
  note:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.03em"
  action:
    fontFamily: "Archivo Narrow, Arial Narrow, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.2em"
rounded:
  flush: "0"
  stock: "2px"
  pen: "7px"
  magnet: "50%"
spacing:
  rail: "0.55rem"
  row: "0.42rem"
  numeral-gutter: "1rem"
  stack: "1.75rem"
  column: "2.25rem"
  head: "3rem"
  face-x: "clamp(1rem, 4vw, 2.5rem)"
  face-top: "clamp(1.1rem, 3.5vw, 2.25rem)"
components:
  club-plate:
    backgroundColor: "{colors.vinyl}"
    textColor: "{colors.enamel}"
    typography: "{typography.display}"
    rounded: "{rounded.flush}"
    padding: "0.4rem 0.85rem 0.46rem"
  name-plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.vinyl}"
    typography: "{typography.body}"
    rounded: "{rounded.stock}"
    padding: "0.26rem 0.5rem"
    width: "fit-content"
  rail-label:
    backgroundColor: "transparent"
    textColor: "{colors.vinyl-quiet}"
    typography: "{typography.label}"
    rounded: "{rounded.flush}"
    padding: "0 0 0.22rem"
  draw-magnet:
    backgroundColor: "{colors.mark-red}"
    textColor: "#ffffff"
    typography: "{typography.action}"
    rounded: "{rounded.stock}"
    padding: "0.62rem 0.75rem"
    width: "100%"
  draw-magnet-disabled:
    backgroundColor: "transparent"
    textColor: "#8d979a"
    typography: "{typography.action}"
    rounded: "{rounded.stock}"
    padding: "0.62rem 0.75rem"
  insert-card:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.vinyl}"
    typography: "{typography.body}"
    rounded: "{rounded.stock}"
    padding: "0.625rem"
  dial:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.vinyl}"
    typography: "{typography.body}"
    rounded: "{rounded.stock}"
    padding: "0.22rem 0.5rem"
    width: "100%"
  byes-mark:
    backgroundColor: "transparent"
    textColor: "{colors.mark-green}"
    typography: "{typography.note}"
    rounded: "{rounded.flush}"
    padding: "0.5rem 0 0"
  tray-stamp:
    backgroundColor: "transparent"
    textColor: "{colors.tray-stamp}"
    typography: "{typography.label}"
    rounded: "{rounded.flush}"
    padding: "0"
---

# Design System: Match Mixer

**Scope.** This file governs **Match Mixer** only — the single screen at
`/tools/match-mixer` and the components under
`src/components/apps/match-mixer/`. Its world is implemented as the
`.mm-sheet` block in `src/app/globals.css` (direction seed `08f41571`), plus
the Match Mixer overrides in that file's `@media print` block. The marketing
site's Broadcast Dark system (root `DESIGN.md`) does not govern this route —
`SiteShell` lists it in `DARK_EXCEPTIONS` — and nothing here should be carried
back onto the marketing site or onto Booking Buddy, On Deck or Pickle Point Pal.

## Overview

**Creative North Star: "The Board By The Court Door"**

Match Mixer is not a page that contains a schedule. It is a manufactured
object: a lit enamel planning board in an aluminium surround with a pen tray
bolted along the bottom, of the kind screwed to the wall beside a sports-hall
court. The board's permanent furniture — the club plate, the column rails, the
round numerals — is dark vinyl applied flush to the enamel, cut and stuck down
once. Tonight's names arrive on white magnet plates that sit a millimetre off
the surface and, because a hand put them there, never quite square. Marker is
colour and gesture only: a red ring round a repeat partnership, green for who
is sitting out.

The world refuses two things by name. It refuses the SaaS form-and-table tool
page — there are no cards, no radius language, no page margin, no panel
headings, and the object fills the frame edge to edge. And it refuses the
black-on-white printed sheet that governed this route until 2026-09-09, which
banned colour, depth and motion by rule so a mono laser printer would survive
it. Print is now a fallback, not the governing constraint: the audience is a
rec organizer holding a phone in a gym. The printout still works, and it works
by **demotion** — the material comes off and the ruled grid that was always
underneath reaches the paper.

Density is high and unapologetic. The reading task is telling Anna Leigh
Waters from Anna Bright across a folding table at a glance, so the type is
plain, the numerals are tabular, and no letterform anywhere imitates a hand.

**Key Characteristics:**
- One object, full frame — aluminium surround, enamel face, pen tray, no page
  around it and no max-width.
- Two type voices: cut vinyl applied to the board, and print on a plate.
- Two saturated marks only — marker red and marker green. Brand orange unspent.
- Depth is material, not UI: furniture is flush; plates are magnet-lifted.
- Square by default; 2px only where the material is card stock.
- The wipe is the signature interaction, and it is pure CSS.

## Colors

One cool enamel field, one dark vinyl for everything applied to it, white for
the plates, and a brushed aluminium ramp for the surround — plus exactly two
saturated marker colours.

### Primary
- **Marker Red** (`{colors.mark-red}`): the marker in the tray. Fills the draw
  magnet (white on it measures 5.4:1), strokes the repeat ring round a repeated
  pair, rules the superseded flag, and edges the duplicate-name notice. It is
  the only fill on the board that means "press this".
- **Marker Green** (`{colors.mark-green}`): the board's other saturated mark.
  Sets who is sitting out this round, and the passing clause of the scorer's
  verdict. Measured 5.90:1 against the bottom of the enamel — where the last
  round of a long board actually sits.

### Neutral
- **Enamel** (`{colors.enamel}` into `{colors.enamel-shade}`): the board face,
  lit from above with a white top edge and a dark bottom one so it reads as a
  surface with a sheen rather than a rectangle of grey.
- **Vinyl** (`{colors.vinyl}`): everything applied to the board — the club
  plate fill, the 2px column rails, the round numerals, plate ink, the focus
  outline, the selection background.
- **Quiet Vinyl** (`{colors.vinyl-quiet}`): the secondary applied register —
  rail labels, the "vs" mark, the particulars line, notes.
- **Plate White** (`{colors.plate}`) with **Plate Edge** (`{colors.plate-edge}`):
  the printed card stock every name and every input is on.
- **Aluminium** (`{colors.alu-hi}` / `{colors.alu}` / `{colors.alu-lo}`): the
  surround and the tray. `body:has(.mm-sheet)` repeats the low tone literally
  so an elastic overscroll shows metal, never white.
- **Rule** (`{colors.rule}`): the hairline between rows. Held as a variable
  because all three held-back states and the print sheet move it.

### Named Rules
**The Two Marks Rule.** Red and green are the only saturated colours on the
board, and each carries exactly one meaning: red is the marker's mark on a
problem or the action, green is who is out. A third saturated colour dilutes
both. Everything else is enamel, vinyl, plate white or aluminium.

**The Unspent Orange Rule.** Brand orange (`#f26522`) does not appear in this
world. It is held for the "round in progress" state a later milestone will
compute, exactly as the retired sheet world held it. Do not spend it on a
button, a highlight, or a brand flourish before that state exists.

**The Applied-Ink Rule.** Ink is either applied to the board (vinyl, dark, in
the narrow voice) or printed on a plate (Archivo on white). There is no third
surface for text to live on; a floating paragraph of body prose on the enamel
is where the page shows through the object.

## Typography

**Display / Furniture Font:** Archivo Narrow (`--font-mm-vinyl`, with
`Arial Narrow`, `sans-serif`)
**Plate Font:** Archivo (`--font-mm-plate`, with `system-ui`, `sans-serif`)

**Character:** Two voices for two materials. Archivo Narrow is lettering *cut*
for signage — always tracked, always caps, never a sentence. Archivo is what a
label printer puts on a plate: plain, mid-weight, sentence case, meant to be
read at speed. Tabular numerals throughout, because the columns have to line
up.

### Hierarchy
- **Display / Club plate** (Archivo Narrow 700, 1.5rem → 1.875rem at `sm`,
  line-height 1, tracking 0.17em, uppercase): the board's name, knocked out of
  a vinyl plate. One per screen.
- **Title / Round numeral** (Archivo Narrow 700, 1rem, tracking 0.02em): the
  row heading down the left of the field. Applied to the board, not printed on
  a plate. Below `sm` it grows the word "Round " from a `::before`, because the
  column rail it belonged to is gone.
- **Body / Name plate** (Archivo 500, 0.875rem, line-height 1.3): the names.
  The only sentence-case, non-tracked voice in the world.
- **Label / Rail** (Archivo Narrow 700, 0.5625rem, tracking 0.2em, uppercase):
  column rails, section legends, the tray stamp. Sits on a 2px vinyl rule when
  it heads a column.
- **Meta** (Archivo Narrow 600, 0.6875rem, tracking 0.14em, uppercase, tabular):
  the night's particulars beside the plate, and the scorer's verdict beneath it.
- **Note** (Archivo Narrow 400, 0.75rem, tracking 0.03em, line-height 1.5,
  max 46ch): explanatory lines under a control, and the duplicate-name notice.
- **Action** (Archivo Narrow 700, 0.8125rem, tracking 0.2em, uppercase): the
  draw magnet's label and the quiet underlined edit.

### Named Rules
**The Two Voices Rule.** Archivo Narrow is what is *applied to* the board and
is always tracked caps. Archivo is what is *printed on* a plate and is never
tracked and never caps. A new element picks its face by asking which material
it is made of, not by asking how important it is.

**The No-Hand Rule.** No handwriting, script or "marker" letterform anywhere.
A webfont stamps the identical glyph every time, so script reads as type
imitating a person — and the job of this screen is distinguishing two similar
names at a glance. The marker exists here as colour and gesture only.

**The Tabular Rule.** Every numeral that can be compared down a column —
round numbers, court counts, the verdict's tallies — is `tabular-nums`.

## Layout

The board owns the frame. `.mm-sheet` has no max-width and no gutter: a 6px
aluminium reveal on three sides, the enamel face flexing to fill, and the tray
closing the bottom. Its `min-height` is `calc(100svh - 70px)` — `svh` so a
phone's collapsing chrome never leaves a strip of metal under the tray, and the
70px is the measured offset the site shell puts `.mm-sheet` at under the
floating pill nav, so the tray lands exactly at the fold rather than just below
it. That number is measured, not a guess; re-measure it if the shell changes.

The enamel face is inset by `clamp(1.1rem, 3.5vw, 2.25rem)` top,
`clamp(1rem, 4vw, 2.5rem)` sides, `clamp(1.5rem, 4vw, 2.75rem)` bottom, and the
tray repeats the horizontal clamp so the two align.

**Head band.** Stacked on a phone; at `min-width: 64rem` it becomes
`minmax(0,1fr) auto` with a 3rem gap, running the board's full width. Club
plate and the night's particulars share one baseline row on the left; the
laminated notice card sits at the end of the second track and is
`justify-self: end` only once that second track exists.

**Two columns.** `.mm-cols` is one column stacked, and `15.5rem minmax(0,1fr)`
with a 2.25rem gap at `64rem`. The left column is every edit; the right is the
ruled field. That split is also what lets the print sheet take the whole
controls column off the page in one rule.

**The field.** Rounds run down, courts run across, Off last. It lives in its
own `overflow-x: auto` scroller so a wide board never scrolls the page
sideways. Below `640px` (`screen and (max-width: 639px)` — `screen and` is
load-bearing, because paper is narrower than that on some sizes) the same table
restyles into one round at a time: header row hidden, each cell growing its
court name from `data-court`. It is **restyled, never re-rendered** — one copy
of the schedule in the DOM at every viewport is what lets the print stylesheet
stay pure CSS.

### Named Rules
**The Object-Not-A-Page Rule.** No page margin, no max-width, no centred
container, no background showing around the board. If a surface on this route
needs a container, it is a piece of the object (a plate, a card, a rail), not a
box on a page.

## Elevation & Depth

Depth here is material, not UI elevation. There are exactly two states a thing
can be in: **applied flush to the enamel**, or **magnet-lifted off it**.
Applied furniture — the club plate, rails, numerals, legends — casts no shadow
at all; a shadow under the club plate would make it a sticker instead of vinyl.
Card stock — name plates, the roster insert, the dials, the laminated notice —
is lifted a millimetre, which means the shadow is thrown *down and away* rather
than hugging the outline. The enamel itself carries an inset white top edge and
a dark bottom one plus a top-lit radial sheen, and two faint diagonal
wipe-ghost bands: the only evidence the board has a history, and what stops the
ground reading as flat fill.

### Shadow Vocabulary
- **Plate lift** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.9), 0 1px 0 rgb(24 32 36 / 0.16), 0 3px 5px -1px rgb(24 32 36 / 0.18), 0 7px 12px -6px rgb(24 32 36 / 0.34)`):
  every name plate and the laminated notice. A light top edge, a hard contact
  line, then a soft cast with almost no negative spread. At 14px an
  outline-plus-hairline instead reads as a bordered table cell, which is the
  one thing a plate must not be.
- **Insert lift** (`0 1px 0 rgb(0 0 0 / 0.1), 0 4px 9px -5px rgb(0 0 0 / 0.4)`):
  the roster card and the dials — the same idea, shallower.
- **Magnet rest** (`0 2px 0 rgb(0 0 0 / 0.26), 0 8px 15px -8px rgb(0 0 0 / 0.55)`):
  the draw magnet at rest. Hover raises the hard line to 3px and deepens the
  cast; active flattens it to `0 0 0` plus `0 4px 8px -6px` — the magnet going
  flat against the enamel.
- **Enamel sheen** (`inset 0 1px 0 rgb(255 255 255 / 0.85), inset 0 -1px 0 rgb(0 0 0 / 0.07)`):
  the face only.
- **Tray channel** (`inset 0 1px 0 rgb(255 255 255 / 0.75), inset 0 6px 9px -7px rgb(20 26 30 / 0.75), 0 -3px 7px -3px rgb(20 26 30 / 0.3)`):
  a bright lip, a dark turn into the channel, and a shadow cast up onto the
  enamel the tray is bolted to.

### Named Rules
**The Flush-Or-Lifted Rule.** Anything made of vinyl is flush and casts
nothing. Anything made of card stock is lifted, with a hard contact line plus a
soft cast thrown down and away. There is no third depth, and no ambient glow.

**The Held-Back-Never-Hidden Rule.** Dimmed states (the superseded board, the
example board) are dimmed by *moving the ink and flattening the plates against
the enamel* — re-declaring `--mm-vinyl`, `--mm-plate-edge`, `--mm-rule`,
`--mm-mark-green` on the container — never by `opacity` and never by a grey
overlay. Opacity thins the hairlines into nothing and reads as "loading"; the
superseded board is still the schedule being played off the wall right now and
has to stay readable.

## Shapes

Square is the default. `0` radius on everything applied to the board — the club
plate, rails, the ruled field, the placeholder's dashed blank is the one
exception at 2px. `2px` is the material radius, and it means one thing: this is
card stock (name plates, the roster insert, the dials, the draw magnet, the
laminated notice). Nothing on this board is `4px` or larger, and nothing is
pill-shaped except the two objects in the tray, which are a pen (7px) and a
magnet (a circle) and are literal.

Lines come in exactly two weights: a **2px solid vinyl rail** across the top of
a column or section, and a **1px `--mm-rule` hairline** between rows. A dashed
1px rule means "specimen" (the example board's top edge) or "blank" (the empty
placeholder).

The plates are rotated a fraction off square — `-0.26deg` / `0.22deg`
alternating by position, and `0.19deg` / `-0.24deg` on even rows, so the
pattern never repeats down a column. The draw magnet sits at `0.35deg`, the
laminated notice at `-0.3deg`. Nobody consciously sees a quarter of a degree;
everybody feels a column of perfectly square ones.

### Named Rules
**The Cut-To-Fit Rule.** A name plate is `width: fit-content` (capped at
`max-width: 100%`), cut to the length of what is printed on it — never to the
width of the column. A full-width plate stops reading as an object on the board
and starts reading as the cell's own fill, and two courts of short names
stretch into two banners.

**The Off-Square Rule.** Every plate carries a rotation under half a degree,
alternated so no two adjacent plates share one. A new plate type without a
rotation reads as printed-on rather than placed.

## Components

### Club plate
Vinyl applied to the enamel with the type knocked out of it. Dark fill, enamel
type, flush, square, no shadow. It is the `h1`. Its display sizing currently
comes from Tailwind utilities on the element (`text-2xl sm:text-3xl`) rather
than the CSS block; treat the frontmatter `display` token as the normative
value.

### Rail label
A tracked-caps legend with a 2px vinyl rule under it (`.mm-rail`), the way a
real board is ruled across the top of each column. Used for section headings,
the `thead` cells of the field, and the roster label. Quiet vinyl, 0.5625rem,
0.2em tracking.

### Name plate
White card stock, 1px plate-edge border, 2px radius, plate lift shadow, cut to
fit, rotated. Holds one side of a game as `Name / Name`. When the pair has
partnered more than once it also carries the repeat ring and an `sr-only`
"(repeat partners)".

### Repeat ring (signature)
An inline `<svg class="mm-ring">` absolutely positioned at `inset: -6px -9px`
over the plate, stroking a hand-shaped ellipse in marker red at
`stroke-width: 2.4`, `preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`,
round caps and joins, with the path overshooting its own start the way a hand
does coming back round. **This is a drawn stroke and must never become a CSS
border.** Every other line on the board is applied vinyl; a tidy rectangle here
would read as more furniture and stop registering as a mark. The stretch is
what lets one ring fit any plate width; `non-scaling-stroke` is what keeps the
sides from going thin while it stretches. It is `aria-hidden`, with the meaning
carried in text for screen readers.

### Draw magnet (primary action)
The only red fill on the surface, so the only thing that reads as "press this".
Full width, 2px radius, tracked caps, rotated `0.35deg`, magnet-rest shadow.
Hover lifts 1px and deepens; active drops 2px and flattens. Disabled removes
the fill entirely and leaves a 1px inset outline and grey label — the card is
off the board, leaving the blank it sits in. When the board is out of date it
takes a double ring (`0 0 0 2px` enamel, `0 0 0 4px` vinyl) so "update" is
carried at a glance as well as in words.

### Quiet edit
A tracked-caps underlined text button on the rail (`.mm-quiet`), 1px underline
thickening to 2px on hover. Deliberately not a bordered control: a second
framed button beside the roster would ask to be read as a second way to draw
the schedule.

### Insert card / dials
The roster textarea is a slotted white insert card (1px plate edge, 2px radius,
insert lift, Archivo body at 0.875rem/1.75). Courts and rounds are two dials in
a 2-up grid on the same stock, 1.25rem tabular numerals. Placeholder text is
`#9aa4a6`.

### Laminated notice
`.mm-lede` — a poly-pocket notice card, max 40ch, white stock, plate lift,
rotated `-0.3deg`, quiet vinyl at 0.8125rem/1.6. Board furniture, not a
standfirst floating on the enamel.

### Byes mark
Who is off this round, set in marker green in the narrow voice at 0.75rem —
sized to be read off the board at the same distance as who is on, not as a
footnote. Verified 5.90:1.

### Superseded board (signature state)
`.mm-draw[data-stale]` — the wipe has started but the board has not been
redrawn. A marker-red rail (`.mm-flag`, 2px top / 1px bottom, tracked caps
red) states it in words; the field below moves its ink one step, drops the
plates to a flat `#f7fafa` with no shadow, and lightens the rule; and a
one-directional gradient residue of the unfinished sweep lies across it. The
red rail is what says superseded — not illegibility. This state is load-bearing
and must not be replaced with a spinner, a grey-out, or an empty field.

### Tray
`.mm-tray` — the anodised channel along the bottom: two pens (black, red), two
magnets, and the club's stamp pushed to the end. It carries no control and says
nothing the screen needs; it is the edge that tells you which way up the object
is. Below `30rem` the spare pen and spare magnet (`[data-tray-extra]`) are
dropped, because a tray that size would hold one of each. The stamp is opaque
`#2b3134` (verified 6.14:1) rather than a half-alpha vinyl: a maker's mark that
cannot be read is a smudge.

### Motion — the wipe (signature interaction)
Redrawing is not a table re-render: the field is swept clear left to right and
the plates are set back on it row by row.

- The `.mm-draw` container is **keyed on the seed**, so the CSS animations
  replay on every redraw. No JavaScript drives a frame.
- The sweep is a single translated overlay in the enamel's own colour, so it
  reads as *wiping* rather than as a highlight passing over. It is two
  elements: `.mm-wipe` is the non-moving window with `overflow: hidden`, and
  its `::after` is what travels (`mm-sweep`, `-115%` → `115%`, 620ms,
  `cubic-bezier(0.4, 0, 0.2, 1)`). A single translated element parks a full
  width to the right and widens the page by a thousand pixels.
- Rows settle behind it (`mm-settle`, 340ms,
  `cubic-bezier(0.22, 0.9, 0.36, 1)`), staggered by a `--row` custom property:
  `calc(160ms + min(var(--row, 0) * 62ms, 520ms))`. The overshoot is 1.5px in
  the keyframe with a plain decelerate curve — an overshooting curve on top of
  an overshooting keyframe gives a rubber bounce no magnet has.
- **The cascade is capped at 520ms.** Uncapped, the last row of a sixteen-round
  board lands past 1.4s on every redraw, and the schedule is the point.
- `prefers-reduced-motion: reduce` cuts to the settled board: the sweep is
  `display: none`, the row animation is `none`, and the magnet keeps its
  rotation with no transition.

### Named Rules
**The Wipe-Is-CSS Rule.** The signature motion is a keyed remount plus CSS
animation. Nothing in the component may drive a frame of it, and no motion on
this board may run longer than the 520ms cascade cap.

## Do's and Don'ts

### Do:
- **Do** let the board fill the frame — `min-height: calc(100svh - 70px)`,
  aluminium surround, tray at the bottom, no page around it.
- **Do** pick a type voice by material: tracked-caps Archivo Narrow for
  anything applied to the board, plain Archivo for anything printed on a plate.
- **Do** cut name plates to their contents (`width: fit-content`) and rotate
  each a fraction under half a degree, alternated by position.
- **Do** keep marker red and marker green as the only saturated colours, one
  meaning each.
- **Do** draw the repeat mark as an SVG stroke with `non-scaling-stroke` and
  `preserveAspectRatio="none"`.
- **Do** dim held-back states by re-declaring the ink and flattening the
  plates on the container, so children inherit it without knowing what stale
  means.
- **Do** keep one copy of the schedule in the DOM at every viewport and change
  layout by CSS only — it is what keeps the print sheet pure CSS.
- **Do** demote the world on paper: material off, ruled grid on, the repeat
  ring replaced by a ruled box, the controls column gone, `thead` repeated as a
  `table-header-group` and rounds `break-inside: avoid`.
- **Do** keep the print block **unlayered**. Almost every override there fights
  a Tailwind utility, and the utilities layer beats the components layer at any
  specificity.
- **Do** re-measure the 70px shell offset if the site shell or pill nav changes.

### Don't:
- **Don't** spend brand orange here. It is reserved for the future
  "round in progress" state.
- **Don't** replace the repeat ring with a CSS border, outline or box on
  screen. The ruled box is the *print* form of that mark only.
- **Don't** give applied vinyl (club plate, rails, numerals) a shadow — that
  turns it into a sticker.
- **Don't** stretch a name plate to the column width, and don't leave a plate
  perfectly square.
- **Don't** use `opacity` or a grey overlay to hold a state back; it thins the
  hairlines and reads as loading.
- **Don't** introduce a handwriting, script or brush face anywhere, including
  for the marker marks.
- **Don't** use a radius above 2px on a board element, or a pill/circle shape
  on anything that is not literally a pen or a magnet.
- **Don't** add a max-width, page gutter, centred container, or generic card
  around any part of this route.
- **Don't** let a motion flourish outrun the 520ms cascade cap, and don't drive
  the wipe from JavaScript.
