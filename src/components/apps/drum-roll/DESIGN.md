---
name: Drum Roll
description: The wheel — a warm-white hall ground carrying one heavy object, where wedge widths are the odds.
colors:
  dr-ground: "oklch(0.957 0.007 85)"
  dr-ground-sink: "oklch(0.929 0.009 84)"
  dr-field-ground: "oklch(0.99 0.003 90)"
  dr-ink: "oklch(0.22 0.008 70)"
  dr-ink-dim: "oklch(0.45 0.012 70)"
  dr-ink-placeholder: "oklch(0.58 0.01 75)"
  dr-hairline: "oklch(0.872 0.008 82)"
  dr-line: "oklch(0.78 0.011 82)"
  dr-hub: "oklch(0.26 0.01 70)"
  dr-bevel: "oklch(0.52 0.012 70)"
  dr-peg: "oklch(0.63 0.012 75)"
  dr-accent: "#f26522"
  dr-accent-ink: "#ffffff"
  dr-accent-wash: "oklch(0.66 0.2 40 / 0.12)"
  dr-wedge-0: "oklch(0.988 0.004 92)"
  dr-wedge-1: "oklch(0.928 0.019 84)"
  dr-wedge-2: "oklch(0.858 0.029 76)"
typography:
  result:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 10vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.35rem, 5.2vw, 1.9rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  rowName:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
  field:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  key:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    letterSpacing: "0.02em"
  link:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  wedge:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "8.4px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  readout:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.9375rem"
    fontWeight: 600
    fontFeature: "tabular-nums"
rounded:
  control: "3px"
  focus: "2px"
  round: "50%"
spacing:
  stack: "0.75rem"
  stage-gap: "0.85rem"
  column-gap: "1.75rem"
  section-gap: "1.5rem"
  row-y: "0.6rem"
  page-x: "1rem"
  page-x-sm: "1.5rem"
  page-y: "2rem"
  measure-max: "42rem"
components:
  key:
    backgroundColor: "{colors.dr-accent}"
    textColor: "{colors.dr-accent-ink}"
    rounded: "{rounded.control}"
    padding: "0.8rem 2.4rem"
    height: "3.25rem"
    typography: "{typography.key}"
  key-disabled:
    backgroundColor: "{colors.dr-line}"
    textColor: "oklch(0.42 0.008 70)"
  key-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.dr-ink}"
    rounded: "{rounded.control}"
    padding: "0.45rem 1rem"
    height: "2.5rem"
  key-quiet-hover:
    backgroundColor: "{colors.dr-ground-sink}"
  field:
    backgroundColor: "{colors.dr-field-ground}"
    textColor: "{colors.dr-ink}"
    rounded: "{rounded.control}"
    padding: "0.7rem 0.8rem"
    typography: "{typography.field}"
  step:
    backgroundColor: "transparent"
    textColor: "{colors.dr-ink}"
    rounded: "{rounded.control}"
    size: "2.25rem"
  step-hover:
    backgroundColor: "{colors.dr-ground-sink}"
  link:
    backgroundColor: "transparent"
    textColor: "{colors.dr-ink-dim}"
    typography: "{typography.link}"
  link-hover:
    textColor: "{colors.dr-ink}"
  wedge:
    backgroundColor: "{colors.dr-wedge-0}"
    textColor: "{colors.dr-ink}"
    typography: "{typography.wedge}"
  wedge-won:
    backgroundColor: "{colors.dr-accent}"
    textColor: "{colors.dr-accent-ink}"
---

# Design System: Drum Roll

**Scope.** This file governs **Drum Roll** only — the raffle/draw tool at
`/tools/drum-roll`. Its world is scoped to the `.dr-surface` class applied by
`src/components/apps/drum-roll/drum-roll.tsx`, with its tokens and rules in the
`.dr-surface` block at the end of `src/app/globals.css`. The route is listed in
`DARK_EXCEPTIONS` in `src/components/layout/site-shell.tsx`, because this world
is committed light and must not receive Broadcast Dark's `.bx-dark` ground.

Like Match Mixer, Pickle Point Pal, Booking Buddy and On Deck, Drum Roll is a
separate visual world from the marketing site's Broadcast Dark. Nothing in the
root `DESIGN.md` governs this surface, and nothing here travels back out to it.

## Overview

**Creative North Star: "The Wheel"**

The wheel, built like equipment instead of a widget. A quiet warm hall white
carries one heavy object with real geometry: a machined hub, a turned rim with a
bevelled inner edge, pegs standing proud of the band, and a sprung flapper that
each peg pushes up and drops as it passes. Everything else on the page —
roster, prizes, controls — is flat type on the ground, separated by
hairlines, with no cards anywhere.

The wheel earns its place on one argument, and the argument is visual: wedge
widths are ticket counts, so five tickets is a wedge five times wider and the
odds are the picture rather than a number somebody has to be told. The world
refuses two predictable alternatives — the flat conic-gradient wheel with a
result modal, and the SaaS tool page that buries the odds behind a ticket count
— and it refuses the rainbow wheel specifically, because a colour per name is
why everybody else's labels are unreadable. The governing constraint is
legibility: one name read fast off a phone held up in a room.

Depth here is contact, not float. Shadows are short and dark-warm, sitting a
part against the ground; the wheel's own drop shadow and the winning wedge's
proud scale are the only places the surface lifts at all. Motion is one authored
moment — the spin — and nothing else animates for decoration.

**Key Characteristics:**
- Warm hall-white ground, ink and hairlines, no cards and no panels
- Wedges cycle three warm neutrals, never a colour per name
- Brand orange spends itself on exactly two things: the pointer and the wedge
  that wins
- Wedge angle equals ticket share; the odds are drawn, never stated
- Schibsted Grotesk carries every word a person reads; Geist Mono only where the
  surface reports data back
- 3px corners on every control — machined, not rounded
- One spin: 4.6s, five turns, exponential ease-out, resolved instantly under
  reduced motion

## Colors

A quiet warm neutral scale, hue-tinted from the ground's own warmth, carrying a
single saturated accent that appears only at the moment of a result.

### Primary
- **Brand Orange** (`#f26522`): the flapper's fill, the winning wedge, the focus
  ring, the caret, and the "won" line under a prize. Nothing else. On this
  ground it is the only saturated event that ever happens, which is what makes
  the landing legible from across a room.
- **Accent Wash**: the selection highlight, orange held at 12% so selected text
  stays ink-on-ground rather than inverting.

### Neutral
- **Hall White** (ground): the page and the document behind it, so a short page
  never shows a strip of site background.
- **Sink**: the pressed/hover ground under quiet keys and stepper buttons — one
  measured step down from the ground, never a border change.
- **Field White**: the one surface brighter than the ground, reserved for input
  and textarea interiors so a field reads as a hole rather than a card.
- **Ink** and **Dim Ink**: two text steps only. Dim Ink is tinted from the
  ground's warmth rather than being a flat gray, and holds roughly 7:1 on the
  ground, so secondary text is quiet without being weak.
- **Hairline** and **Line**: the two structural strokes. Hairline separates rows
  and sections; Line is the visible edge of a control (field border, quiet key
  ring, stepper outline) and the disabled key fill.
- **Hub Graphite**, **Bevel** and **Peg**: the wheel's own materials — the rim
  band and hub core, the turned inner edge that catches light, and the pegs the
  flapper ticks against.
- **Wedge tones (three)**: a near-white, a warm mid, and a deeper warm — cycled
  by index, with the cycle nudged at the seam so two matching wedges never sit
  side by side.

### Named Rules
**The One Saturated Event Rule.** Brand orange belongs to the pointer and the
landed wedge. A saturated colour anywhere else — a chip, a heading, a filled
secondary button — competes with the only moment the page exists for.

**The No Colour Per Name Rule.** Wedges cycle exactly three warm neutrals by
index. Naming-by-hue is the failure mode of every draw wheel on the internet: it
destroys the label contrast that the whole surface is built to protect.

**The Two Ink Steps Rule.** Ink and Dim Ink. There is no third, fainter tone;
if something needs to recede further it is not on this page.

**The Brand Orange Is Fixed Rule.** `#f26522` is never darkened or retinted to
improve a contrast ratio — a standing brand commitment in PRODUCT.md. Here it is
moot for reading anyway: orange never carries body text. It is a wedge fill
under 700-weight white, a solid key fill, and a 2px focus ring.

## Typography

**Display / Body Font:** Schibsted Grotesk (`--font-dr`, with
`ui-sans-serif, system-ui, sans-serif`)
**Data Font:** Geist Mono (`--font-geist-mono`, with `ui-monospace, monospace`)

**Character:** One news-lineage grotesque does everything a person reads, chosen
on legibility alone: a large aperture and even colour that survive being set at
8.4px on a wedge and at 3.4rem as a result. The scale is tight and the weights
are heavy — 600 through 800 across every role that matters — because this page
is read at distance and in a hurry, not skimmed.

### Hierarchy
- **Result** (800, `clamp(2rem, 10vw, 3.4rem)`, 1.02): the drawn name, in brand
  orange, wrapping anywhere rather than overflowing. The largest thing on the
  page after the wheel itself.
- **Headline** (700, `clamp(1.35rem, 5.2vw, 1.9rem)`, 1.12, balanced wrap): the
  "Drawing for [prize]" line above the wheel, with its lede words set at 400 in
  Dim Ink inside the same line.
- **Title** (800, 1.5rem, tight tracking): the page's own name in the header
  row. It is a label for the tool, not a hero.
- **Section** (700, 1.0625rem): "Who is in?", "Prizes". Section headings sit one
  step above body, never a display step — a section is a shelf, not an event.
- **Row name** (600, 1rem): an entrant or prize in a list.
- **Body / note** (400, 0.9375rem, 1.5–1.6): all prose and readout lines, in Dim
  Ink, with bolded figures returning to full Ink and tabular numerals.
- **Label** (600, 0.8125rem, Dim Ink): field labels and row sub-lines.
- **Key** (700, 1.0625rem, +0.02em): the letterforms on a control.
- **Wedge name** (600, 8.4px in a 208-unit viewBox, -0.01em): set at the rim and
  running inward, flipped past six o'clock so both halves read left to right.
- **Readout** (Geist Mono, tabular): ticket counts only.

### Named Rules
**The Mono Reports Data Rule.** Geist Mono appears only where the surface is
reporting a value back that someone will read aloud and check afterwards — the
ticket counts, the manual-paste field. It is never a costume for a label
or a heading.

**The Every Ticket Is Labelled Rule.** A wedge degrades its label rather than
dropping it: full name, then first name plus surname initial, then first name
truncated, then two initials, and only under 3.2° does it go blank. A bucket
where somebody's ticket is unlabelled is a bucket the room cannot audit.

## Layout

One centred column, `max-w-2xl` (42rem), `px-4` rising to `sm:px-6`, `py-8`,
with a 1.75rem gap between major blocks and 0.75rem inside them. The column is
a single vertical stack with no grid and no sidebars.

The first viewport is the wheel: sized `min(92vw, 54vh, 40rem)`, deliberately
constrained in both axes because height matters as much as width — the 54vh term
keeps the spin key above the fold on a 900px-tall laptop, including the extra
line the raffle state adds. The empty-state ghost wheel is the same geometry at
`min(70vw, 34vh, 17rem)`, 45% opacity and desaturated.

Sections are separated by a single top hairline and 1.5rem of padding above the
heading. Rows are hairline-bottomed and 0.6rem tall in padding; lists carry no
outer border, so a list reads as ruled paper rather than a table.

Below 30rem the row layout turns vertical (name over controls, left-aligned) and
section heads switch from space-between to a left-packed wrap. This is not
cosmetic: the site's fixed mobile menu button is parked in the bottom-right
gutter, so nothing this route owns is allowed to sit there.

### Named Rules
**The Wheel Owns The Fold Rule.** The wheel, the drawing line, the bucket readout
and the spin key fit one viewport together. Anything that would push the key
below the fold gets a smaller wheel, not a scroll.

## Elevation & Depth

Depth is contact, not float. There are no cards, no panels, and no resting
surfaces raised off the ground — a separated block is separated by a hairline.
The only lifted things are physical parts of the wheel and the keys you press.

### Shadow Vocabulary
- **Wheel drop** (`drop-shadow(0 16px 26px oklch(0.24 0.02 70 / 0.26))`): the
  whole face sitting on the ground as one object.
- **Hub** (`inset 0 0 0 2px oklch(0.6 0.01 70 / 0.5), 0 2px 5px oklch(0.2 0.01 70 / 0.5)`):
  a machined boss with a lit edge, over a radial graphite gradient.
- **Flapper** (`drop-shadow(0 2px 3px oklch(0.24 0.02 70 / 0.4))`): the sprung
  part reading as above the wheel it rides.
- **Landing** (`drop-shadow(0 3px 7px oklch(0.42 0.14 40 / 0.45))`): warm, on
  the winning wedge only, which is also drawn 3 units proud of the rim.
- **Key rest** (`inset 0 -2px 3px oklch(0.44 0.15 40 / 0.55), 0 2px 4px oklch(0.24 0.02 70 / 0.24)`):
  an inner bottom bevel plus a short contact shadow — a moulded key, not a
  floating rectangle.
- **Key hover / press**: the contact shadow deepens to
  `0 4px 9px oklch(0.24 0.02 70 / 0.3)` on hover; on press the key translates
  2px down and collapses to a single inset line. Disabled keys carry no shadow
  at all.

### Named Rules
**The Contact-Not-Float Rule.** Every shadow in this world is short, warm-dark
and tied to an object that is physically resting on or above the ground. There
is no ambient glow, no coloured halo, and no elevation used to signal hierarchy.

## Shapes

Corners are machined, not soft: every control — key, quiet key, field, stepper —
is 3px, and the focus ring's own radius is 2px. Nothing in this world uses a
pill, a large radius, or a card outline.

The wheel is the only circular geometry and it is fully round: a stroked rim
band (11 units) with a thin turned bevel inside it, wedges drawn from the centre
with a 0.6-unit hub-coloured separating stroke, radial pegs standing proud of
the rim, and a 13%-diameter hub disc centred over all of it. The pointer is a
tapered flapper with a curved shoulder, mounted on a drawn bracket and pivoted
near its tip.

Strokes carry the structure everywhere else: a 1px hairline under rows and above
sections, a 1px Line border on fields and steppers, and an inset 1px ring
standing in for a border on quiet keys.

## Components

### Buttons
- **Shape:** machined corners (3px) on every variant.
- **Spin key (`.dr-key`):** solid brand orange with white letterforms, 3.25rem
  minimum height and generous horizontal padding (`0.8rem 2.4rem`), moulded by
  an inner bottom bevel. This is the only filled control in the world.
- **Hover / Press:** the contact shadow grows on hover; pressing translates the
  key 2px down and flattens it — 90ms both ways, so it feels struck rather than
  faded.
- **Disabled:** filled with Line, ink dropped to a mid-warm gray, no shadow.
- **Quiet key (`.dr-key--quiet`):** transparent with a 1px inset ring, 2.5rem
  tall, 600 weight; hover fills with Sink. Every secondary action is this.
- **Link button (`.dr-link`):** inherits the surrounding type at 0.875rem in Dim
  Ink, underlined at 1px with a 3px offset, going to full Ink on hover. Used for
  destructive and incidental row actions.
- **Stepper (`.dr-step`):** a 2.25rem square with a Line border for ±1 ticket;
  hover fills with Sink, disabled drops to 35% opacity.

### Inputs / Fields
- **Style:** `.dr-field` is a Field White interior with a 1px Line border and
  3px corners, 1rem type, full width; textareas are sized by explicit height
  (`h-28` through `h-40`). Placeholders sit in a warm mid-gray.
- **Focus:** the surface-wide focus treatment — a 2px brand orange outline at
  2px offset. There is no separate focus fill or border shift.
- **Label:** `.dr-label`, 0.8125rem/600 in Dim Ink, sitting above the field.

### Rows
- **Style:** `.dr-row` is a flex row with a bottom hairline and no background,
  holding a 600-weight name on the left and controls on the right. A sub-line
  (`.dr-row-sub`) sits under the name in Dim Ink at 0.8125rem, turning brand
  orange and 600 when it reports a winner.
- **Mobile:** below 30rem the row stacks and left-aligns, giving a long name the
  full width and keeping controls out of the fixed menu button's gutter.

### Signature Component: the wheel
The wheel is an SVG on a `-104 -104 208 208` viewBox: wedges laid out clockwise
from twelve o'clock and sized by ticket share, three cycling warm tones, labels
placed at the rim running inward and half-turned past six o'clock so no name is
ever upside down, pegs at every wedge boundary, rim and bevel drawn last over
the wedge edges, and a DOM-positioned hub and flapper over the top.

Rotation is written directly to `.dr-wheel-face`'s style by the spin loop, so
React never renders a frame. The spin is 4.6s over five turns plus the distance
to the target, on an exponential ease-out (`1 - (1 - t)^4`) that gives a long
honest tail where a wedge boundary can still change the answer. The flapper
rides up to 17° as a peg approaches within 7° and drops the instant it passes.
The winning wedge animates proud over 460ms and stays at 1.022 scale.

Under `prefers-reduced-motion: reduce` the wheel resolves straight to the landed
state, transitions collapse to 1ms, and the landing keeps its final scale with
no animation.

### Named Rules
**The Wheel Decides Nothing Rule.** The winner is chosen and written to the log
before the wheel is told anything; the spin is presentation of a result that
already exists. No randomness lives in the wheel. The seed that produced it is
recorded but never displayed — it is what makes a draw reproducible and Undo
exact, not something a person is expected to read.

## Do's and Don'ts

### Do:
- **Do** size wedges by ticket share and let the widths carry the odds. If a
  number has to be stated to explain the chances, the drawing has failed.
- **Do** keep brand orange to the flapper, the landed wedge, the focus ring and
  the caret.
- **Do** separate blocks with a hairline and space. Rules and rhythm group this
  page; boxes never do.
- **Do** degrade a wedge label down the ladder (full name → first + initial →
  truncated first → initials) before dropping it.
- **Do** set anything the surface reports back — ticket counts — in
  Geist Mono with tabular numerals.
- **Do** drive the spin through direct style writes on the wheel face, and give
  reduced-motion users the landed state immediately.
- **Do** keep the wheel, the drawing line, the readout and the spin key inside
  one viewport by shrinking the wheel, including on a short laptop.
- **Do** keep this route in `DARK_EXCEPTIONS` — the world is committed light and
  must never inherit `.bx-dark`.

### Don't:
- **Don't** give a wedge a colour per name. Three cycling warm neutrals, always.
- **Don't** put the result in a modal or an overlay. The landing happens on the
  wheel, in place, with the name printed under it.
- **Don't** introduce a card, panel, or raised container. Nothing rests above the
  ground here except the wheel's own parts and a pressed key.
- **Don't** add a second filled control. One orange key per screen; every other
  action is quiet or a link.
- **Don't** darken or retint `#f26522` to chase a contrast number — a standing
  PRODUCT.md brand commitment, and it carries no body text on this surface.
- **Don't** add a third ink tone below Dim Ink, or a hairline between every pair
  of rows and sections at once.
- **Don't** use a pill or a large corner radius. Controls are 3px.
- **Don't** put anything interactive in the bottom-right gutter below 30rem; the
  site's fixed mobile menu button is parked there.
- **Don't** animate anything for decoration. The spin, the flapper, the landing
  and the key press are the complete motion vocabulary.
- **Don't** carry `.dr-*` tokens or classes onto Broadcast Dark, Match Mixer,
  Pickle Point Pal, Booking Buddy or On Deck, or theirs onto this route.
