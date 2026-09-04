---
name: Pickle Point Pal
description: The tournament referee's issued scorekeeping instrument — anodized-graphite chassis, bright reflective readout, one hi-vis signal.
colors:
  frame: "oklch(0.31 0.008 255)"
  frame-hi: "oklch(0.37 0.009 255)"
  frame-edge: "oklch(0.22 0.008 255)"
  frame-hairline: "oklch(0.43 0.008 255)"
  legend: "oklch(0.8 0.006 255)"
  legend-dim: "oklch(0.66 0.007 255)"
  ground: "oklch(0.935 0.005 92)"
  panel: "oklch(0.99 0.002 95)"
  panel-sink: "oklch(0.965 0.004 95)"
  panel-edge: "oklch(0.9 0.004 95)"
  hairline: "oklch(0.87 0.004 95)"
  ink: "oklch(0.19 0.006 260)"
  ink-dim: "oklch(0.42 0.01 255)"
  ghost: "oklch(0.905 0.004 95)"
  signal: "#f26522"
  signal-ink: "#ffffff"
  alert: "oklch(0.52 0.2 25)"
  caution: "oklch(0.66 0.15 70)"
typography:
  display:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0.01em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.16em"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  panel: "7px"
  key: "10px"
  frame: "16px"
  mark: "4px"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  panel-x: "1.5rem"
components:
  key:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "0.75rem 1rem"
    height: "48px"
  key-primary:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.key}"
    padding: "0.75rem 1rem"
    height: "56px"
  key-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.key}"
    height: "44px"
  key-danger:
    backgroundColor: "transparent"
    textColor: "{colors.alert}"
    rounded: "{rounded.key}"
    height: "44px"
  key-alert:
    backgroundColor: "{colors.alert}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.key}"
    height: "56px"
  panel-surface:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "1.25rem 1.5rem"
  well:
    backgroundColor: "{colors.panel-sink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "0.75rem"
  frame:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.legend}"
    rounded: "{rounded.frame}"
    padding: "0.625rem"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "0.75rem"
  segmented-option-selected:
    backgroundColor: "{colors.frame}"
    textColor: "{colors.signal-ink}"
    rounded: "6px"
    height: "48px"
---

# Design System: Pickle Point Pal

## Overview

**Creative North Star: "The Officiating Instrument"**

Pickle Point Pal is not an app dressed as a tool — it is the tournament referee's
issued equipment. An anodized-graphite instrument body (matte charcoal, machined
edges, never rendered chrome) cradles a bright near-white reflective readout
panel. The score is stated the way an umpire states it: fixed, plain, unmissable
from ten feet in direct sun. Every screen is one rigid machined-panel: a thin
etched status strip, the readout, a line-only court schematic, and physical keys
with screen-printed legends. Setup and the FAQ are the same instrument in its
"spec sheet / manual" register.

The world is defined by two refusals. It rejects the unstyled-white-utility
default the app used to be, and it rejects the dark-neon-broadcast-scoreboard
that is its predictable opposite. Depth is physical and literal — a machined
chassis ground, a recessed shelf, a panel seated with an inset shadow — never
decorative float. Color is rationed hard: graphite and panel-white neutrals
carry every structural surface, and exactly one hi-vis accent (brand orange
`#f26522`) means "serving / live / clock running" and nothing else. Three
officiating status hues are held in reserve for the marks a ref must tell apart
without reading them.

Glance-speed and sunlight legibility outrank refinement everywhere they conflict.
The surface is committed to light by scene, not by theme toggle: there is no dark
variant, because a ref reads this outdoors and the readout must stay a bright
panel with near-black ink whatever the host system or site theme is doing.

**Key Characteristics:**
- Anodized-graphite frame + bright recessed readout panel, on a machined chassis ground
- One hi-vis orange signal, single-meaning; never a control fill
- Score as a true SVG seven-segment display with always-visible ghost segments — not a font
- Saira Condensed silkscreen legends, uppercase and tracked, on every control
- Committed light, no dark mode; three-level physical depth
- Keys are physical: a slight raise, a hard bottom edge, key travel on press

## Colors

A near-monochrome instrument palette — graphite frame, warm panel-whites, near-black ink — with one loud orange and a tightly rationed officiating status set.

### Primary
- **Hi-Vis Signal Orange** (`#f26522`, locked and undarkened per PRODUCT.md): the single accent. Marks the serving team's panel edge (the locked serve bar), the armed rally key's top hairline and legend, the timeout mark, and the timeout clock under fifteen seconds. Nothing else. It is never a button fill.

### Secondary
- **Anodized Graphite** (`oklch(0.31 0.008 255)`, with highlight `0.37` and edge `0.22`): the instrument body — `.pp-frame` chassis, the primary confirm key, selected segmented-control options. A cool near-neutral blue-charcoal, gradient-lit top-to-bottom to read as machined metal.
- **Frame Legend Grey** (`oklch(0.8 0.006 255)`, dim `0.66`): silkscreen text printed onto the dark frame.

### Tertiary — Officiating status (rationed)
- **Alert Red** (`oklch(0.52 0.2 25)`): medical timeout, technical foul. Outlined danger triggers; solid fill only on the deliberate confirm inside a sheet.
- **Caution Amber** (`oklch(0.66 0.15 70)`, darkened ~22% toward black when set as text): technical warning only.

### Neutral
- **Chassis Ground** (`oklch(0.935 0.005 92)`): the warm off-white machined surface every full-viewport screen sits on (`.pp-surface`).
- **Readout Panel** (`oklch(0.99 0.002 95)`, sink `0.965`, edge `0.9`): the bright reflective panel; near-white with a faint warm tint.
- **Panel Sink** (`oklch(0.965 0.004 95)`): recessed wells and control shelves on the panel-white surface.
- **Hairline** (`oklch(0.87 0.004 95)`): dividers and quiet borders on light surfaces.
- **Ink** (`oklch(0.19 0.006 260)`): primary text and lit segments.
- **Ink Dim** (`oklch(0.42 0.01 255)`): secondary text on the panel — tinted from the panel's warmth, ~7:1 on panel-white, clears AA past a sunlit glance. Never a flat gray.
- **Ghost** (`oklch(0.905 0.004 95)`): unlit seven-segment segments — a phantom of the full "8".

### Named Rules
**The One Signal Rule.** Orange (`#f26522`) has exactly one meaning: serving / live / clock running. It appears on ≤10% of any screen and is never a fill on a control the ref taps. A resource meter, a count, a selected toggle — all graphite, never orange.

**The Rationed-Status Rule.** Alert red and caution amber only ever attach to an official mark (fixed colour + drawn glyph + printed label). They never tint a structural surface, a border-by-default, or body text.

## Typography

**Display / Legend Font:** Saira Condensed (`--font-arena`, fallback Arial Narrow) — a condensed industrial grotesque, the screen-printed signage voice.
**Body Font:** Geist (`--font-sans`) — workhorse grotesque for prose and FAQ.
**Data Font:** Geist Mono (`--font-mono`) — tabular data: the scoresheet, timestamps, counts, format spec chips.
**Score readout:** not a font — true seven-segment SVG geometry (`SegReadout` / `SegDigit`), sized entirely by container `font-size` at `height: 1em`.

**Character:** Equipment silkscreen. Condensed uppercase legends sit beside every control the way a label is printed on a piece of kit; mono handles anything that must line up in a column; Geist stays quiet and neutral for the paragraphs nobody reads mid-match.

### Hierarchy
- **Plate** (`.pp-plate`, Saira Condensed 700, uppercase, `letter-spacing 0.01em`, `line-height 0.95`, sizes `text-base`–`text-2xl`): team name plates on the rally keys, headline status words, screen titles, primary-key labels.
- **Legend** (`.pp-legend`, Saira Condensed 600, `0.6875rem`, `letter-spacing 0.16em`, uppercase, `line-height 1.1`): control legends, status strips, field labels. `.pp-legend--onframe` switches the colour to frame-legend-grey for text on the dark chassis.
- **Body** (Geist 400, `~1rem`, `line-height ~1.6`): FAQ answers, sheet explanatory copy, setup hints.
- **Data** (`.pp-data`, Geist Mono, `tabular-nums`, `letter-spacing 0.01em`): games-won counts, format spec line, match-log timestamps.
- **Readout** (seven-segment SVG, `clamp(2.75rem, 15vw, 6rem)` on the live Score Call, `clamp(2.25rem, 13vh, 4.5rem)` in ref-landscape): the spoken score — serving · receiving · server# — and the M:SS timeout clock.

### Named Rules
**The Legend Floor Rule.** A silkscreen legend is never set below `0.6875rem` (11px). It has to survive a sunlit glance from arm's length.

**The Readout Is Not A Font Rule.** The score is drawn segment by segment as SVG polygons. It never slides, counts up, or is set in a display typeface — a score change resolves as an instant per-segment ignite/extinguish with a hair of stagger (12ms × segment index).

**The Spoken-Order Rule.** The readout always reads in the order an umpire says it aloud: serving score, receiving score, server number. Never home/away, never sorted.

## Layout

One rigid machined-panel grid governs every screen. The live Match Screen is a single `.pp-frame` chassis holding, in order: the etched status strip, the readout panel, the engraved court schematic, and the two full-width rally keys — sized (`min-h-[calc(100svh-11rem)]`) so its bottom edge lands near the bottom of the viewport. Everything a ref only reaches for between rallies (undo/redo, timeouts, technical calls, log, swap sides, end match) sits in a recessed shelf **one deliberate scroll below the fold** — never within a thumb-slip of the rally keys.

Constrained-width content is centered (`mx-auto`): `max-w-xl` for the match column, `max-w-md` for setup, `max-w-2xl` for the FAQ.

**Portrait** is the installed-app default (manifest is portrait-locked). **`ref-landscape`** is a custom Tailwind variant — a phone/tablet held sideways courtside: the match column drops its max-width and reflows to `left key · [readout + court] · right key` on a `minmax(6rem,1fr) minmax(0,2.6fr) minmax(6rem,1fr)` grid, rally keys pinned to the device edges via `order`, the DOM staying A-then-B. Setup splits its rules and names into two side-by-side scrolling columns and hides explanatory paragraphs (height is what's scarce sideways).

**Spacing rhythm:** Tailwind default scale; chassis internal gaps `0.5–1rem` (`gap-2`/`gap-3`/`gap-4`), readout panel padding `1.25rem 1.5rem`, key padding `0.75rem 1rem`, well/shelf padding `0.75rem`.

## Elevation & Depth

Depth is physical and literal, never a floating-card metaphor. Three light levels, in order of how deep they sit:

1. **Chassis ground** (`.pp-surface`) — the flat machined surface the screens sit on.
2. **Recessed well** (`.pp-well`) — a control shelf or list container sunk into the panel: flat fill, hairline border, no shadow.
3. **Readout panel** (`.pp-panel`) — bright, seated into the frame with an **inset** shadow (`inset 0 1px 3px …, inset 0 -1px 0 rgba(white,0.9)`), never lifted above it.

The frame itself (`.pp-frame`) casts one real contact shadow (`0 1px 2px …, 0 14px 28px -18px …`) — it is trim holding content, sitting on the ground. Keys carry a physical key-profile shadow: a top inset highlight, a hard `0 2px 0` bottom edge that reads as key height, and a soft cast. On `:active` the key translates `translateY(2px)` and the bottom edge collapses to `0 0 0` — literal key travel.

### Shadow Vocabulary
- **Frame contact** (`0 1px 2px oklch(0.2 0.01 260/0.16), 0 14px 28px -18px oklch(0.2 0.02 260/0.34)`): seats the chassis on the ground.
- **Panel inset** (`inset 0 1px 3px oklch(0.2 0.01 260/0.07), inset 0 -1px 0 oklch(1 0 0/0.9)`): recesses the readout into the frame.
- **Key rest** (`inset 0 1px 0 oklch(1 0 0/0.9), 0 2px 0 var(--pp-panel-edge), 0 5px 12px -8px oklch(0.2 0.02 260/0.4)`): the milled-key profile.
- **Key armed** (`inset 0 4px 0 var(--pp-signal), inset 0 5px 0 oklch(1 0 0/0.4), 0 2px 0 …, 0 5px 12px -8px oklch(0.66 0.2 40/0.32)`): the serve signal as a screen-printed orange bar across the key's top edge.

### Named Rules
**The Seated-Not-Lifted Rule.** The readout panel is recessed into its frame with an inset shadow. Nothing in this system lifts toward the viewer on a drop shadow; state is shown by key travel (press) and by the orange signal, not by elevation change.

## Shapes

Machined-panel geometry: small, consistent radii, everything rectilinear. Corners step by role — `7px` (`--pp-radius`) for panels, wells, inputs and sheet options; `10px` (`--pp-radius-key`) for keys and segmented-control strips; `16px` (`--pp-radius-frame`) for the outer chassis; `4px` for official marks. Borders are `1px` and structural — panel-edge or hairline on light surfaces, frame-edge on the chassis. The court diagram is a line-only engraved schematic (no fills). Official marks are pill-adjacent rounded rectangles outlined in `currentColor`. The serve bar is a hard-edged full-bleed vertical strip on the panel's edge — either fully present on the serving side or fully on the other; it never fades.

## Components

### Buttons (Keys)
- **Character:** every control is a physical milled key with a screen-printed legend stacked under/over its label.
- **Shape:** `10px` radius (`--pp-radius-key`); `min-height 48px` (44px for quiet/danger), 44px+ touch floor throughout.
- **Default** (`.pp-key`): white-to-sink vertical gradient face, ink text, key-rest shadow. `:active` → `translateY(2px)`, bottom edge collapses. `:disabled` → sink fill, ink-dim, `opacity 0.55`.
- **Primary** (`.pp-key--primary`): solid matte graphite (`--pp-frame`), white plate label. The one forward action per screen (draw, confirm game, start match, resume, end timeout). Graphite because orange is never a control fill.
- **Armed** (`.pp-key--armed`): the serving team's rally key — orange top hairline + orange legend + orange-tinted border, reading as one continuous "the serve is on this side" with the panel serve bar. Not a fill.
- **Quiet** (`.pp-key--quiet`): transparent, hairline border, ink-dim, no raise — undo, back, discard, swap sides.
- **Danger** (`.pp-key--danger`): transparent, red-mixed border, alert-red text — end match; spottable without shouting. Red fill is reserved for the confirm inside the sheet.
- **Alert** (`.pp-key--alert`): solid alert-red face, white plate — the deliberate destructive confirm only.
- **Focus:** `2px solid var(--pp-signal)` outline, `2px` offset; switches to white on the dark frame.

### Rally Keys (Signature)
The two primary targets — one per team, tall (`min-h-24`), full-width, side by side on the side each team's court is drawn on. Player names as `.pp-plate` lines, then a small `wins rally` legend and the outcome word (`POINT` / `SIDE OUT` / `2ND SERVE`) — orange when that team is serving. Disabled during an active timeout and after game point. Nothing destructive sits within a thumb's slip.

### Seven-Segment Readout (Signature)
`SegReadout` / `SegDigit` / `SegClock`. 100×180 cell, ~12px stroke, 45° bevels. Lit segments `var(--pp-ink)`, unlit `var(--pp-ghost)` — always drawn, never omitted, but no leading phantom *cell* (a padded ghost digit misreads as a real one). Score change: `fill 70ms linear` per polygon, staggered 12ms × index. The timeout clock reuses the exact grammar, larger, turning orange (`.pp-seg-warn`) under fifteen seconds and ink-dim when paused.

### Serve Bar (Signature)
`.pp-servebar` — a `w-2.5` orange vertical strip pinned to the serving team's inner panel edge, `linear-gradient(#ff7c3c → #f26522)` with a `0 0 0 1px` orange edge ring. The loudest non-numeric element. It snaps to the other edge on a side-out; it never fades.

### Official Marks
`.pp-mark` — an inline pill: fixed colour + drawn glyph + Saira Condensed uppercase label at `0.6875rem`. Variants: `--timeout` (orange), `--alert` (red), `--caution` (amber), `--structural` (ink-dim). Every non-score state (each timeout kind, technical warning, technical foul, side switch) gets one.

### Cards / Containers
- **Readout panel** (`.pp-panel`): panel-white gradient, `7px`, panel-edge border, inset shadow. Optional `.pp-panel-settle` entrance (see Motion).
- **Well** (`.pp-well`): panel-sink fill, hairline border, `7px`, no shadow — control shelves, list containers, setup field groups.
- **Frame** (`.pp-frame`): graphite gradient, `16px`, frame-edge border, contact shadow — the chassis and the modal sheet shell.

### Inputs / Fields
- **Text input** (setup names): white fill, `1px` hairline border, `7px` radius, `px-3 py-3`, ink-dim placeholder. Focus: border shifts to `var(--pp-signal)`, native outline removed.
- **Segmented control** (`RadioRow`): a `10px` white strip, `1px` padding, 2–3 columns of `min-h-12` keys; the selected key is graphite-filled with white text and an inset top highlight; unselected keys are ink-dim, hover → panel-sink.

### Sheets / Dialogs
Centered modal over `oklch(0.22 0.01 260/0.55)` scrim. Panel is a `.pp-frame` shell capped to `100dvh-2rem` with its own scrolling `.pp-panel` body; graphite header with a `.pp-legend--onframe` "Close". Focus moves in on open, Tab is trapped, Escape closes, focus returns to the opener. Every destructive action is confirmed inside a sheet.

### Court Diagram
Line-only engraved schematic of four positions, current server highlighted, mirrored to whichever side of the net the ref is standing on (`leftTeam` + `useRefFlipped`). The differentiating feature — the on-screen layout matches what the ref sees looking down.

## Do's and Don'ts

### Do:
- **Do** keep orange to its one meaning (serving / live / clock running) and to ≤10% of any screen.
- **Do** put every forward action on a single graphite `.pp-key--primary` per screen.
- **Do** draw absence deliberately — unlit ghost segments, empty allowance pips — as carefully as the lit state.
- **Do** give every non-score state an official mark: fixed colour + glyph + printed `.pp-legend`/`.pp-plate` label.
- **Do** keep the readout in spoken order (serving, receiving, server#) and let container `font-size` drive its size.
- **Do** seat panels into frames with inset shadows; show interaction with key travel (`translateY(2px)`), not lift.
- **Do** hold the whole surface to light — use `.pp-surface` and its tokens, never `bg-white`/`dark:` per file.
- **Do** keep destructive and between-rally controls one deliberate scroll below the rally keys.
- **Do** floor Saira legends at `0.6875rem` and keep them uppercase and tracked (`0.16em`).

### Don't:
- **Don't** use orange as a button fill, a selected-toggle fill, a resource meter, or body text.
- **Don't** animate a score change as a slide, tween, or count-up — it is a per-segment swap.
- **Don't** render a leading phantom digit cell to pad the readout.
- **Don't** introduce a dark variant or a theme toggle; there is no dark mode here.
- **Don't** float surfaces on drop shadows or add a fourth depth level beyond ground / well / panel.
- **Don't** spend alert red or caution amber on anything but an official mark.
- **Don't** set the score in a segmented-display typeface instead of the SVG geometry.
- **Don't** place undo, timeout, or end-match controls adjacent to the rally keys.

<!--
Not canonized: (1) the lucide-react glyph icons inside the action shelf and
official marks (Undo2, TriangleAlert, Wrench, MoreHorizontal, etc.) — the craft
floor bans glyph-icon sets as a system; the build uses them utilitarianly in the
between-rally shelf only, so they stay a carried convenience, not a documented
icon system for new surfaces. (2) The decorative opacity-45 "Pickle Point Pal /
Referee scoring" maker's-plate filler text in the phone thumb gap — a one-off
composition device, not a reusable rule. (3) White-on-orange text below WCAG AA
is a locked PRODUCT.md brand decision, recorded there, not a value invented here.
-->
