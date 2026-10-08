---
name: Team Tally
description: The broadcast package. Every live number on a captained team night set as a sports-TV graphic, navy plates on a cool gym-white ground.
colors:
  ground: "oklch(0.966 0.006 255)"
  sheet: "#ffffff"
  ink: "oklch(0.2 0.035 262)"
  ink-dim: "oklch(0.46 0.03 258)"
  rule: "oklch(0.9 0.01 255)"
  rule-strong: "oklch(0.8 0.018 255)"
  plate: "#0f1b30"
  plate-raised: "#18284a"
  plate-bar: "#0a1324"
  plate-line: "#1d2c48"
  plate-ink: "#ffffff"
  plate-dim: "#9fb0c9"
  plate-faint: "#5d6f8d"
  side-red: "#e2322c"
  side-blue: "#1d5ae0"
  now: "#d8f03a"
  flag: "oklch(0.56 0.15 62)"
typography:
  display:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.5rem, 7vw, 4.25rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "0.002em"
  headline:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.02em"
  numeral:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, ui-sans-serif, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  team-name:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, ui-sans-serif, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.03em"
  action:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, ui-sans-serif, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
  meta:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, ui-sans-serif, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  plate-label:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, ui-sans-serif, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
  lead:
    fontFamily: "Sofia Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Sofia Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Sofia Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  side: "1px"
  pos-chip: "2px"
  control: "0.5rem"
  plate: "0.5rem"
  sheet: "0.75rem"
  pill: "999px"
spacing:
  wrap-x: "1rem"
  wrap-x-wide: "1.5rem"
  row-y: "0.4rem"
  row-x: "0.75rem"
  section: "1.25rem"
  section-wide: "1.75rem"
  head-top: "1.75rem"
  head-bottom: "2.25rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 1.25rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.plate-raised}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 1.25rem"
    height: "2.75rem"
  field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  context-chip:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.pill}"
    padding: "0 0.75rem"
    height: "1.75rem"
  app-bar:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    height: "3.25rem"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.section}"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.plate}"
  plate-bar:
    backgroundColor: "{colors.plate-bar}"
    textColor: "{colors.plate-dim}"
    typography: "{typography.plate-label}"
    padding: "0.45rem 0.75rem"
  score-bug-total:
    backgroundColor: "{colors.plate-raised}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.numeral}"
  tower-row-mine:
    backgroundColor: "{colors.plate-raised}"
    textColor: "{colors.plate-ink}"
    padding: "0.4rem 0.75rem"
  tower-pos-mine:
    backgroundColor: "{colors.now}"
    textColor: "{colors.plate}"
    rounded: "{rounded.pos-chip}"
  flight-band:
    backgroundColor: "{colors.plate-bar}"
    textColor: "{colors.plate-dim}"
    padding: "0.2rem 0.75rem"
---

# Design System: Team Tally

Scope: every route under `/tools/team-tally`, through the `.tt-surface` wrapper in `src/app/tools/team-tally/layout.tsx`. Tokens live in `src/app/tools/team-tally/team-tally.css` and reach no other route. `SiteShell` lists the route in its dark exceptions, so the marketing site's Broadcast Dark never paints it; the site's orange pill nav and black footer still frame it. Direction contract: `.impeccable/surfaces/src-app-tools-team-tally.md` (seed `fb8e9ead`).

## Overview

**Creative North Star: "The Broadcast Package"**

A team night is televised, even when nobody is filming it. Every live number is a sports-TV graphic, read the way a golf broadcast reads its leaderboard: a Matchup is a score bug with R1 R2 R3 TOT columns, the standings are a timing tower, and a Flight cut is a band drawn across it. The ground is cool gym white because the room is lit by bright overhead light and phones are read under it; the graphics are deep navy plates set on that ground, small, dense and exact, like a lower-third on a broadcast.

The world splits its labour cleanly. Plates carry live numbers and nothing else. White sheets on the ground carry everything the Organizer reads, writes or taps: the event list, the setup form, the brief. Colour is rationed by meaning: red and blue are only a Matchup's two sides as the brief marks them, ball yellow only means "now". Everything else is navy ink on white.

Controls are standard web controls (text fields, buttons, links) restyled in the world, not replaced with bespoke widgets. The type is one family in two widths: Sofia Sans Extra Condensed in tracked caps for numerals, team names and plate labels; Sofia Sans for prose and every input. The world refuses the SaaS dashboard of cards and tables.

**Key Characteristics:**
- Navy graphics plates on a cool white ground; plates hold live numbers only.
- Red and blue are a Matchup's two sides, drawn as small solid blocks inside a plate.
- Ball yellow is the single "now" signal.
- Condensed tracked caps for every graphic; plain Sofia Sans for everything read or tapped.
- Tabular numerals everywhere, so columns of scores never jitter.
- Fixed columns; standings change only by rows re-sorting.

## Colors

A restrained navy-on-gym-white system with exactly three signal hues, each bound to one meaning.

### Primary
- **Broadcast Navy** (`plate`, #0f1b30): the graphics plate. Score bugs and the timing tower sit on it. It never holds prose, forms or decoration.
- **Plate Raised** (`plate-raised`, #18284a): the TOT cell of a score bug, your own Team's row in the tower, and the primary button's hover. One step lighter than the plate, so emphasis inside a graphic stays in the navy family.
- **Plate Bar** (`plate-bar`, #0a1324): the darkest navy, for header rows, the plate's label bar and Flight bands.
- **Plate Line** (`plate-line`, #1d2c48): the hairline between rows inside a plate.

### Secondary
- **Side Red** (`side-red`, #e2322c) and **Side Blue** (`side-blue`, #1d5ae0): the two sides of a Matchup, red first and blue second, exactly as the generated brief marks them. Drawn as narrow solid blocks: the score bug's stripe, the tower's chip, the setup form's Team legend, and the two blocks of the app-bar mark. Side Blue also serves as the focus ring and text caret on the white ground, where no Matchup is drawn.

### Tertiary
- **Ball Yellow** (`now`, #d8f03a): "now", and only now. The live Round's column (header ink plus an underline in the bug and tower), the LIVE dot in a plate bar, and your own row's position chip. It never fills a surface and never decorates.
- **Flag Amber** (`flag`, oklch(0.56 0.15 62)): a field the pasted brief could not read. Border and ring on the invalid field plus its note text. Amber so it can never be mistaken for a side.

### Neutral
- **Gym White** (`ground`, oklch(0.966 0.006 255)): the page ground, faintly cool. Also the context chip's fill.
- **Sheet White** (`sheet`, #ffffff): the app bar, content sheets and field fills.
- **Navy Ink** (`ink`, oklch(0.2 0.035 262)): primary text and the primary button's fill.
- **Dim Ink** (`ink-dim`, oklch(0.46 0.03 258)): secondary text, metadata, quiet links; tinted toward the navy, about 6.5:1 on the ground.
- **Rule** (`rule`, oklch(0.9 0.01 255)) and **Strong Rule** (`rule-strong`, oklch(0.8 0.018 255)): hairlines between list rows and section heads; strong rule for field borders, chip borders and link underlines.
- **Plate Ink** (`plate-ink`, #ffffff), **Plate Dim** (`plate-dim`, #9fb0c9), **Plate Faint** (`plate-faint`, #5d6f8d): text on a plate. Ink for numbers and names, dim for header labels and Flight bands, faint only for "nothing here yet" (an unscored Round's dash, a no-change move mark), never for a number someone needs to read.

### Named Rules
**The Plates Carry Numbers Rule.** A navy plate holds live numbers (scores, totals, positions) and the labels that index them. Prose, forms, explanations and buttons go on white sheets on the ground.

**The Two Sides Rule.** Red and blue mean a Matchup's two sides, as the brief marks them, and nothing else. No red error, no blue link, no red-versus-blue decoration outside a Matchup.

**The Now Rule.** Ball yellow marks what is happening now: the live Round, the live dot, your own position. If nothing is live, no yellow appears.

**The No Extra Hues Rule.** Tower move marks (up, down, no change) are drawn in plate ink, plate dim and plate faint with a chevron carrying direction. No green for up, no red for down: no hue may compete with the two sides.

## Typography

**Display Font:** Sofia Sans Extra Condensed (fallback Sofia Sans, ui-sans-serif), loaded as `--font-tt-cond`
**Body Font:** Sofia Sans (fallback ui-sans-serif, system-ui), loaded as `--font-tt`

**Character:** One family at two widths. The extra-condensed cut is the graphics face, set in tracked uppercase like broadcast lower-thirds; the regular cut is calm and readable for anything read at length or typed into. Not Archivo, which is Match Mixer's face.

### Hierarchy
- **Display** (800, clamp(2.5rem, 7vw, 4.25rem), 0.92, uppercase, balanced wrap): page titles only, one per page.
- **Headline** (800, 1.5rem, 1.05, uppercase, 0.02em): section heads on sheets ("The format it runs", "The brief"). Event names in the Organizer's list use the same voice at 1.375rem.
- **Numeral** (800, 1.375rem, line-height 1, tabular): score-bug cells; the bug's TOT steps up to 1.625rem, tower totals sit at 1.25rem, tower positions at 1.125rem, list dates at 2rem.
- **Team Name** (700, 1.0625rem, 0.03em, uppercase, ellipsis on overflow): team names in the tower and bug (1rem in the bug), tower round cells.
- **Action** (800, 1.0625rem, 0.06em, uppercase): button labels and the setup legend.
- **Meta** (700, 0.9375rem, 0.08em, uppercase, dim ink): the line under a title (date, Team count) and section-head asides.
- **Plate Label** (700, 0.75rem, 0.12em, uppercase, plate dim): header rows and plate bars; Flight bands track wider at 0.2em and weight 800.
- **Lead** (400, 1.125rem, 1.55, dim ink, max 58ch): the standfirst under a page title.
- **Body** (400, 1rem, 1.6, dim ink, max 62ch): explanatory prose. The brief itself sets at 0.9375rem, 1.6, pre-wrapped, in Sofia Sans.
- **Label** (600, 0.9375rem, ink): form labels and quiet links.

### Named Rules
**The Two Widths Rule.** Condensed caps for what is broadcast (numerals, team names, plate labels, titles, button labels); regular Sofia Sans for what is read or typed. A paragraph is never condensed; a score is never regular width.

**The Tabular Rule.** The whole surface sets `font-variant-numeric: tabular-nums`, so a score changing from 9 to 19 never shifts its column.

## Layout

Content sits in a centred wrap (max 72rem, 1rem side padding, 1.5rem from 640px). Every page opens the same way: the full-width app bar, then a head block of title, meta line, lead and actions (1.75rem top, 2.25rem bottom; 2.5rem and 2.75rem from 640px). Below it, white sheets hold sections: a section head with a bottom rule (0.85rem by 1.25rem, 1.75rem inline from 640px) and a body (1.25rem; 1.5rem by 1.75rem from 640px).

The graphics are fixed grids. The score bug is a stripe, a team-name column, three Round columns and a wider TOT column (0.4rem, 1fr, 3 x 2.25rem, 3.25rem). The tower row is position, side chip, name, three Rounds, total, move (1.75rem, 0.35rem, 1fr, 3 x 1.75rem, 2.5rem, 2rem), tightened under 480px rather than dropping a column. On the landing, prose sits left and the stacked bug and tower sit right on desktop; on phones they stack.

Lists in the Organizer's views are rows inside one sheet separated by hairlines (date block, name, action), not separate cards.

### Named Rules
**The Columns Never Move Rule.** R1, R2, R3 and TOT hold their positions at every width and in every state. Standings change only by rows re-sorting into new positions.

**The Flight Band Rule.** A Flight band opens every pair of rows in the tower (positions 1 and 2 are Flight A, 3 and 4 Flight B, and so on), drawn where a leaderboard draws the cut.

## Elevation & Depth

Mostly flat, with two quiet lifts that separate material, not states. White sheets sit on the gym-white ground with a hairline border and a soft two-layer shadow; navy plates carry a deeper, tighter drop so a graphic reads as laid over the page. Nothing lifts on hover.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px oklch(0.2 0.035 262 / 0.05), 0 8px 22px -14px oklch(0.2 0.035 262 / 0.22)`): every white content sheet.
- **Plate** (`box-shadow: 0 10px 28px -16px oklch(0.2 0.035 262 / 0.55)`): every navy graphics plate.
- **Field focus ring** (`box-shadow: 0 0 0 3px oklch(0.55 0.2 262 / 0.28)`): a field with keyboard focus, with its border turning to navy ink.
- **Live underline** (`box-shadow: inset 0 -3px 0 var(--tt-now)` in the bug, `-2px` in the tower): the live Round's cells.

### Named Rules
**The Material Not State Rule.** Shadows say what a thing is (sheet or plate), never what it is doing. Hover changes fill or underline, not elevation.

## Shapes

Small, firm corners. Plates and controls round at 0.5rem; sheets at 0.75rem. The side blocks (bug stripe, tower chip, legend block, mark blocks) are near-square at 1px, like the colour bars on a broadcast graphic, and your own position chip at 2px. The only full pill is the app bar's context chip. Borders are hairlines (1px rules, 1.5px on controls). Plates clip their contents, so header rows and the TOT column run to the plate's edge.

## Components

### App bar (TtAppBar)
A white band across the full width with a bottom rule (min height 3.25rem). Left: the mark, two side blocks (red then blue) and "TEAM TALLY" in condensed caps at 800, 0.08em, linking to the app root. A Matchup is the product's atom, so the mark is one. Right: the context chip naming what this screen is ("Organizer", "Free for organizers", later a Team's Score Link), a pill with a strong-rule border on the ground fill, in dim condensed caps. Sits under the site's pill nav.

### Page head (TtHead)
App bar, then title, meta line, lead and actions, always in that order. One primary button and at most one ghost button in the actions row.

### Buttons
- **Shape:** gently rounded (0.5rem), min height 2.75rem, 1.25rem side padding, 1.5px border.
- **Primary** (`tt-btn`): navy ink fill and border, white condensed caps. Hover lifts the fill to plate raised; press nudges down 1px; disabled at half opacity.
- **Ghost** (`tt-btn-ghost`): transparent with the navy border and ink label; hover adds a 6% navy wash.
- **Quiet link** (`tt-quietlink`): dim ink, 600, underlined in strong rule at 0.25em offset; hover turns text and underline to ink. Used for "Back to your Team Events" and secondary actions inside forms.
- **Focus:** a 2px Side Blue outline at 2px offset on every focusable element in the surface.

### Chips
The context chip in the app bar is the only chip. Pill, ground fill, strong-rule border, dim condensed caps at 0.875rem.

### Cards / Containers
- **Sheet:** white, 1px rule border, 0.75rem corners, sheet shadow. Section heads inside it carry a bottom rule; list rows inside it divide with rules.
- **Plate:** navy, 0.5rem corners, clipped, plate shadow. Optional plate bar on top (darkest navy, plate-label type) for a label and the LIVE dot.

### Inputs / Fields
- **Style:** white fill, 1.5px strong-rule border, 0.5rem corners, min height 2.75rem, Sofia Sans at 1rem. Labels above in 600 ink.
- **Hover:** border darkens a step.
- **Focus:** border turns navy ink plus a 3px soft blue ring.
- **Invalid:** border and ring in Flag Amber, with an amber note.

### Score bug (signature, ScoreBug)
A Matchup round by round. Header row on plate bar: the match label ("Match 1 · Courts 21 & 18"), R1, R2, R3, TOT. Then one row per side: the side stripe (red first, blue second), the team name, three Round cells and the TOT cell on plate raised at 1.625rem. A plate-line rule divides the sides. The live Round's header turns yellow and its cells take a 3px yellow underline. An unscored Round shows a faint dash. Scores never disappear.

### Timing tower (signature, TimingTower)
The standings. Optional plate bar label, a header row (Pos, Team, R1, R2, R3, Tot) with the live Round in yellow ink, then a Flight band before every pair of rows. Each row: position, side chip, team name, three Round cells (live one underlined 2px yellow, unscored ones faint), total, and the move mark (chevron plus places in plate ink for up, plate dim for down, a faint dash for no change). Your own Team's row fills plate raised and its position sits on a yellow chip in navy. Columns never move.

### Setup legend and side blocks
Wherever a Team is assigned to a side outside a plate (the setup form's per-Team fieldset), the legend pairs the side block with condensed caps "MATCH 1 · TEAM 1". Red for a Matchup's first Team, blue for its second.

### Themed browser surfaces
The surface sets the scrollbar thumb to strong rule on transparent, the caret to Side Blue, and text selection to a pale blue (oklch(0.88 0.08 262)) under navy ink. The document behind the surface (the strip the pill nav floats in, and overscroll) is painted gym white so no other ground shows at the edges.

### Game card and score entry (#623)
A Game is a white sheet: a dim condensed label ("Captains' game"), then two rows, red over blue as the bug orders them, each a side bar, who plays ("Ben Johns + Collin Johns") over the Team name, and that side's score box. Score boxes are standard number inputs, 3rem square, condensed 800 numerals, strong-rule border empty and navy ink border once filled; an impossible score turns them Flag Amber with the reason beneath. Below the rows, the **"Entered by" lower third**: a small navy plate tag in condensed caps with a 4px bar in the editor's side colour ("Entered by Team Ben Johns"), or plate dim for "Edited by the organizer". The live Round leads under a "Round 2 · Live" slug whose ball-yellow dot is ringed in navy so it holds on white; every other Round folds to one line ("Round 1 · 11–8 · 11–9") with a **FINAL stamp** (ink border, condensed caps, rotated -3deg) once both Games are in. The roster sheet uses plain fields; a slot whose Round has a score turns read-only on a dashed ground fill.

### Matchup done, the Dreambreaker and the Flight hand-off (#624)
- **FINAL on a whole Matchup:** a done Matchup's score bug gains a plate bar on top, the winner on the left in plate ink ("Winner · Golden Set", or "Flight A champion · Golden Set") and a FINAL stamp on the right (plate-ink border, condensed caps, rotated -3deg, the Round stamp's shape in the plate's colours). It sits above the grid, so the label, the four columns and every score stay exactly where they were. The live underline goes away; the Matchup's Games keep their scores in read-only boxes with no Save.
- **DB tag:** on a tie settled by a Dreambreaker, the winner's name in the bug carries a small "DB" tag (1px plate-dim border, plate dim, 0.6875rem caps). Dim on purpose: it explains the order, it is never a score.
- **Finishing a Matchup:** once all six Games are in, a white sheet under the Rounds ("Finish the Matchup", Team scores as meta). A tie shows the Dreambreaker fieldset first: one ghost button per Team with its side block, "Kitchen Kings won", filled navy when pressed. Then the full-width primary **Matchup done**. A refusal is a Flag Amber note; the confirm is in the page, never `confirm()`: an ink-bordered box (`tt-confirm`) with the consequence in plain words, a primary "Yes, it's done" and a quiet "Not yet". Done, the sheet holds the FINAL stamp, who marked it done, and for the Organizer a ghost **Reopen Matchup**.
- **Flight hand-off (signature, FlightHandoff):** the moment fifty people look for their new courts, so it carries the biggest type in the app. A navy plate whose plate-bar head sets the Flight letter (clamp(4.25rem, 19vw, 6.5rem)) left and the court pair (clamp(3rem, 13vw, 4.75rem)) right, each under a tracked plate-dim kicker. Below, one row per Team: seed, side chip, name, and its court as a 2rem numeral. On a Score Link the viewer's row takes plate raised and the court sits on the ball-yellow "you" chip, the same chip as your tower position. It leads the Score Link (under a "Your Flight · Now" slug) and the Public Link (every Flight, two or three across from 720px). A compact size (letter 2.75rem) lists every Flight beside the Score Link's scores and on the Organizer's Flight sections.
- **Tie notes in the tower:** when equal Team scores are split by a rule, the Team that came out ahead carries a one-line plate-dim caps note under its name ("Ahead on point differential", "Won their Matchup", "Ahead on Games won", "Level on every count: organizer's call"). Nothing for a tie inside one Flight, and nothing before a score.
- **The Organizer's Flights sheet:** beside the tower on desktop. Before Seeding, Matchups done so far, a callout (`tt-callout`, ground fill, strong-rule hairline, no side stripe) for a tie on every count across a Flight boundary with "Put X ahead", and **Seed now** behind the same in-page confirm. After, a callout when the opening standings have moved since Seeding, and two plain selects to swap Flights' court pairs until a Flight has a score.

### Owed by later tickets (not yet built)
These belong to the world and are recorded so #625 builds them inside it, not around it.
- **Re-sort motion (signature interaction):** when a score lands, tower rows slide to their new positions and the move mark updates. Under reduced motion it is a hard cut to the new order. The surface already zeroes transition and animation durations under `prefers-reduced-motion`. (#623 marks the moves; the slide is still owed.)
- **Results page:** Flight champions, then Final places, then the opening standings and every Matchup, built from the FINAL bug and the hand-off plate (#625).
- **TV layout:** the Public Link's big screen sets the tower full width in two columns (Flights A to C, then D to G) at large type; Matchup score bugs get their own screen; the TV hard-cuts between screens and never scrolls. More than 14 Teams cycle to another screen rather than shrinking.

### Named Rules
**The Restyle Not Replace Rule.** Standard controls (inputs, buttons, links, fieldsets) stay standard and take the world's styling. No custom pickers or faux controls.

**The Hard Cut Rule.** Broadcast graphics cut; they do not drift. Any motion added later is a re-sort or a screen change, and reduced motion always gets the cut.

## Do's and Don'ts

### Do:
- **Do** put every live score, total and position on a navy plate (#0f1b30), and everything else on white sheets on the gym-white ground.
- **Do** mark a Matchup's sides with Side Red (#e2322c) first and Side Blue (#1d5ae0) second, as solid near-square blocks.
- **Do** reserve ball yellow (#d8f03a) for the live Round, the LIVE dot and your own position chip.
- **Do** set numerals, team names and plate labels in Sofia Sans Extra Condensed caps with tabular figures, and prose and inputs in Sofia Sans.
- **Do** keep R1, R2, R3 and TOT fixed and draw a Flight band before every pair of tower rows.
- **Do** build #625 from ScoreBug (with its FINAL bar), TimingTower, FlightHandoff, TtAppBar and the tt controls rather than new graphics.

### Don't:
- **Don't** put prose, forms or buttons on a navy plate.
- **Don't** use red or blue for anything but a Matchup's two sides (no red errors; invalid fields use Flag Amber).
- **Don't** colour move marks green or red; direction is the chevron, in plate ink or plate dim.
- **Don't** use yellow as a highlight, fill or decoration when nothing is live.
- **Don't** reorder, hide or animate columns; only rows re-sort.
- **Don't** set prose in the condensed cut or scores in the regular cut.
- **Don't** use Archivo here; it is Match Mixer's face.
- **Don't** let the TV scroll; cut between screens.
