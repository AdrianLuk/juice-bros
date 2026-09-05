---
name: On Deck Arena Board
description: A fourth official's substitution board for pickleball socials — names ON, names OFF, read across a loud gym.
colors:
  arena-bg: "oklch(0.16 0.014 255)"
  arena-panel: "oklch(0.213 0.017 258)"
  arena-panel-raised: "oklch(0.253 0.019 258)"
  arena-panel-recessed: "oklch(0.13 0.013 255)"
  arena-line: "oklch(0.36 0.02 258)"
  arena-line-soft: "oklch(0.3 0.018 258 / 0.6)"
  arena-fg: "oklch(0.97 0.006 250)"
  arena-dim: "oklch(0.74 0.012 250)"
  arena-faint: "oklch(0.64 0.012 250)"
  arena-live: "#f26522"
  arena-live-ink: "#ffffff"
  arena-next: "oklch(0.86 0.09 218)"
  arena-next-line: "oklch(0.72 0.1 218 / 0.7)"
  arena-warn: "oklch(0.83 0.13 85)"
typography:
  display:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "0.005em"
  display-tight:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
  readout:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    letterSpacing: "0.12em"
    fontFeature: "tabular-nums"
rounded:
  panel: "14px"
  key: "11px"
  key-chip: "8px"
  field: "10px"
  chip: "9px"
spacing:
  panel-pad: "24px"
  court-pad: "20px"
  key-pad-x: "18px"
  rail-width: "2.25ch"
components:
  key:
    backgroundColor: "{colors.arena-panel-raised}"
    textColor: "{colors.arena-fg}"
    typography: "{typography.display}"
    rounded: "{rounded.key}"
    height: "48px"
    padding: "0 18px"
  key-go:
    backgroundColor: "{colors.arena-live}"
    textColor: "{colors.arena-live-ink}"
    rounded: "{rounded.key}"
    height: "48px"
  key-turnover:
    backgroundColor: "{colors.arena-live}"
    textColor: "{colors.arena-live-ink}"
    rounded: "{rounded.key}"
    height: "56px"
    width: "100%"
  key-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.arena-dim}"
    rounded: "{rounded.key}"
    height: "40px"
  field:
    backgroundColor: "{colors.arena-panel-recessed}"
    textColor: "{colors.arena-fg}"
    typography: "{typography.display}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "0 14px"
  panel:
    backgroundColor: "{colors.arena-panel}"
    rounded: "{rounded.panel}"
    padding: "24px"
  panel-next:
    backgroundColor: "{colors.arena-next}"
    rounded: "{rounded.panel}"
  panel-live:
    backgroundColor: "{colors.arena-live}"
    textColor: "{colors.arena-live-ink}"
    rounded: "{rounded.panel}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.arena-dim}"
    rounded: "{rounded.chip}"
    height: "40px"
    padding: "0 14px"
  chip-on:
    backgroundColor: "{colors.arena-next}"
    textColor: "{colors.arena-bg}"
    rounded: "{rounded.chip}"
---

# Design System: On Deck Arena Board

This system governs **`/on-deck/session/*` and `/on-deck/c/*`** — the `.od-arena` subtree
(the player Session view, the Organizer/Volunteer floor screen, the read-only Display, the
courtside Kiosk, the Volunteer link, and the club-QR "nothing running" screen). It is set by
`ArenaShell` (`src/components/on-deck/arena-shell.tsx`), which puts `.od-arena` on the wrapper;
`globals.css` keeps every `--arena-*` token and every `.od-*` rule scoped under that class.

The On Deck marketing landing at exactly `/on-deck` (`src/app/on-deck/page.tsx` and its
`sections/*`) also runs this world, quoting the same colors, type voices, panel/key/shadow
recipes, and Do's/Don'ts — but through its own locally-scoped classes (`.odl`, `.odlc`, plus the
pre-existing `.odv` / `.odm` widgets), never `.od-arena` or the `--arena-*` tokens directly, so a
landing-page change can never ripple into the live app. It composes those materials into a
persuasive page (a hero, a scrollable narrative, marketing CTAs) rather than the live board's
own single-panel Operate layout — see `.impeccable/surfaces/src-app-on-deck-page-tsx.md` for that
surface's own direction contract.

**Out of scope:** the Organizer home/settings pages. Those use the Juice Bros site's default
shadcn light theme and are not touched by this file. The rest of the Juice Bros site keeps its
own separate light marketing identity.

## Overview

**Creative North Star: "The Fourth Official's Substitution Board"**

On Deck's live-event screens are one lit panel a loud gym reads in a single glance: names ON,
names OFF, held where eight people can gather before a court frees instead of being hunted down.
It refuses the incumbent light shadcn card-stack and the dashboard-of-equal-cards default — this
is a substitution board, not a page of widgets. The ground is near-black and cool; panels sit
one step up off it, bolted down, with a hairline lit top edge and real offset-plus-blur depth so
each reads as an illuminated panel rather than an outlined box.

The board runs on two voices and a rationed accent. The board voice is Saira Condensed at
signage scale, uppercase, carrying every name, court number and status word. The readout voice
is Geist Mono, tabular and tracked, carrying positions, counts and wait times — the starter's
clipboard, never decoration. Colour is Committed: brand orange (#f26522, unaltered per the
PRODUCT.md commitment) appears only on LIVE — the foursome being called, the court just opened,
"you're up". A cool electric blue wash marks IMMINENT (on deck). Everything still waiting is
graphite and cool-white with no accent at all. A fixed tabular numbered rail runs down the left
of every queue.

Motion is near-absent by design. One authored moment: when a court turns over, the incoming
foursome flips down onto the court tile like a split-flap board, trailing a single orange glow
that fades. Everything else holds still.

**Key Characteristics:**
- Near-black cool arena ground; bolted panels one step up with a lit top edge and offset+blur depth
- Two type voices only: condensed signage (names, courts, status) and tabular mono (counts, waits)
- Orange is LIVE-only; cool blue is on-deck; waiting is graphite with zero accent
- A fixed tabular numbered rail down the left of every queue
- Physical milled keys with engraved labels; the turnover key is orange, full-width, 56px
- One authored motion moment (the split-flap court fill); reduced motion gets an instant swap

## Colors

A near-neutral cool-graphite field with one committed warm accent and one cool secondary; the
palette is almost entirely desaturated (chroma ~0.012–0.02) so the two accents carry all the
signal.

### Primary
- **Committed Orange** (`#f26522`): The LIVE state and nothing else. The foursome being called
  onto a court, the "OPEN" tag on a just-freed court, the player's own "YOU'RE UP, COURT 5"
  verdict, the turnover key, the "Join / Rejoin the queue" go-key, and the progress-to-court
  ladder fill. Kept exactly as the PRODUCT.md brand hex — never tinted, shaded, or shifted to
  OKLCH. It also renders as a faint wash (`oklch(0.66 0.2 40 / 0.14)`), an outward glow
  (`oklch(0.68 0.19 40 / 0.55)`), and the `::selection` highlight.

### Secondary
- **Imminent Blue** (`oklch(0.86 0.09 218)`): The IMMINENT / on-deck signal — a cool electric
  wash. The "Up next" foursome panel fill and top-edge light, a pressed name-picker chip, the
  "You're on deck" verdict, all focus-visible outlines, and the "N / 4 ready" readout. Reads a
  clear step hotter than plain graphite but never competes with orange.

### Tertiary
- **Caution Amber** (`oklch(0.83 0.13 85)`): Inline warnings only — the Kiosk idle-court nudge
  ("Is Court N still going?") and form error lines. Never a primary surface colour.

### Neutral
- **Arena Ground** (`oklch(0.16 0.014 255)`): The page background, behind the header and below
  the last panel — one continuous near-black cool field.
- **Panel** (`oklch(0.213 0.017 258)`): The default bolted panel surface — courts, "After that",
  queue rows' container, banners.
- **Panel Raised** (`oklch(0.253 0.019 258)`): Milled keys and inline chip-keys at rest; the one
  step above a panel.
- **Panel Recessed** (`oklch(0.13 0.013 255)`): Board-native inputs (`.od-field` / `.od-select`),
  sunk below the panel with an inset shadow.
- **Board White** (`oklch(0.97 0.006 250)`): Names, court numbers, primary text — the board's lit lettering.
- **Dim Graphite** (`oklch(0.74 0.012 250)`): Section labels, wait-time readouts, secondary
  guidance, the venue name on shared boards. ~4.6:1 on Panel.
- **Faint Graphite** (`oklch(0.64 0.012 250)`): The numbered rail, "Open spot" placeholders,
  zero-padded counts, the "First name and last initial only" fine print, footer.
- **Line** (`oklch(0.36 0.02 258)`) / **Line Soft** (`oklch(0.3 0.018 258 / 0.6)`): Panel
  hairlines, key borders, and queue-row dividers.

### Named Rules
**The LIVE-Only Rule.** Orange means one call happening right now. If a thing on screen is not
the foursome being called, the court that just opened, or the "you're up" moment, it does not
get orange — it gets graphite. Rarity is the signal.

**The Three-Temperature Rule.** Every element on the board is at exactly one of three
temperatures: LIVE (orange, happening now), IMMINENT (cool blue, on deck), or WAITING (graphite,
no accent). There is no fourth state and no blend.

**The Unaltered-Hex Rule.** `#f26522` ships as the literal PRODUCT.md hex. Do not convert it to
OKLCH, adjust its lightness for the dark ground, or derive a "dark-mode orange". Washes and
glows are separate alpha layers, not modifications of the base.

## Typography

**Display Font:** Saira Condensed (with Arial Narrow, then sans-serif) — loaded as
`--font-arena`, weights 500–900.
**Readout / Mono Font:** Geist Mono (with ui-monospace, monospace) — `--font-mono`.
**Body Font:** Geist sans (`--font-sans`) — used only for short guidance sentences under a verdict.

**Character:** An engineered condensed sport-signage face for everything read across a room,
paired with a tabular monospace for everything counted. The two never trade jobs: if it is a
name or a status, it is condensed uppercase; if it is a number-in-a-series, it is mono.

### Hierarchy
- **Display Tight** (800, `text-4xl`–`text-6xl`, line-height 0.92, letter-spacing -0.01em,
  UPPERCASE): The single verdict on the player's phone ("#4 OF 6 IN THE QUEUE", "YOU'RE UP,
  COURT 5"), court numbers on tiles, "You're in". The loudest thing on any given screen.
- **Display** (700, `text-2xl`–`text-5xl`, line-height 0.98, UPPERCASE): Foursome names, queue
  names, court occupant names, banner text, key labels. The workhorse board voice.
- **Readout** (mono, 0.75rem floor, letter-spacing 0.12em, `tabular-nums`, UPPERCASE): Section
  headings ("ON THE COURTS", "IN THE QUEUE"), wait-time labels, "OPEN", "LIVE", the "N / 4
  ready" ladder label, "N stepped out for now", inline chip-key labels, input field labels.
- **Guidance** (Geist sans, `text-sm` / `text-xs`, sentence case, `arena-dim` / `arena-faint`):
  The one quiet sentence under a verdict or form ("Head over now.", "First name and last initial
  only."). The only non-uppercase, non-condensed text in the world.

### Named Rules
**The 0.75rem Floor Rule.** The readout voice is never set smaller than 0.75rem — it has to
survive a gym viewing distance. Smaller "captions" do not exist here.

**The Two-Voices Rule.** Names and status words are always condensed uppercase; counts,
positions and wait times are always tabular mono. A number that indexes a series (queue
position, court count) takes the mono voice even when it sits inside a condensed line.

**The No-Eyebrow Rule.** Section headings are the readout label itself, standing alone. There is
no decorative kicker or eyebrow over a heading anywhere in the world; `BoardHeading` is a mono
label plus an optional zero-padded count, nothing more.

## Layout

Single-column, full-bleed within the arena wrapper — no hero shell, no marketing chrome, no
max-width card centering. The wrapper is a flex column that fills the viewport.

**Section rhythm:** major sections (On Deck, Courts, Queue) are stacked with `space-y-7` (28px).
Within a section, the heading sits above a grid with `mt-3` (12px).

**Grids:** the two On-Deck foursomes and the courts are a 1-column stack on mobile, 2-column
(`sm:grid-cols-2`) from the `sm` breakpoint up, `items-start` so unequal panels don't stretch.
Foursome panels gap 16px; court tiles gap 12px.

**The queue** is a single ordered list, never a grid: a fixed `2.25ch` right-aligned mono rail,
then the name in board type filling the row, then the wait-time readout, then any inline
operator chip-key. Group rows indent their member names to `calc(2.25ch + 0.75rem)` so they
hang under the rail. Rows divide with a soft hairline, `py-2`.

**Padding:** foursome panels `p-5` mobile / `p-6` (`sm`); court tiles `p-4` / `p-5`; the player
verdict `px-5 py-7`. Keys are 48px min-height (56px turnover, 40px ghost, 36px chip-key) —
sized for a distracted volunteer tapping a tablet by the net.

**Chrome:** the venue name is chrome-scale (`text-2xl`/`3xl`, `arena-dim`) on shared boards; on
the player's own setup landing it is the headline. Header and footer run the arena ground
continuously — no bare strip.

## Elevation & Depth

This system is **layered and lit**, not flat and not floating. Depth comes from three stacked
tonal planes (ground → panel → panel-raised, with inputs recessed below panel) plus a
consistent shadow recipe that combines a hairline lit top edge with real offset+blur.

### Shadow Vocabulary
- **Bolted panel** (`inset 0 1px 0 0 oklch(1 0 0 / 0.05), 0 1px 2px oklch(0 0 0 / 0.4), 0 18px
  40px -22px oklch(0 0 0 / 0.7)`): Every `.od-panel`. The inset white top line is the "lit
  edge"; the two dark layers are contact shadow plus a deep soft drop.
- **Lit sign / LIVE** (`inset 0 1px 0 0 oklch(1 0 0 / 0.18), 0 0 0 1px oklch(0.66 0.2 40 / 0.6),
  0 12px 40px -8px oklch(0.68 0.19 40 / 0.55)`): The `.od-live` state. Offset-zero on the glow
  layer is deliberate — a lit sign radiating, not an object casting.
- **Imminent top-wash** (`inset 0 1px 0 0 oklch(0.86 0.11 218 / 0.35), inset 0 22px 40px -30px
  oklch(0.82 0.14 218 / 0.9)`, plus the bolted-panel darks): `.od-next` — a cool glow raked down
  from the top edge.
- **Milled key** (`inset 0 1px 0 0 oklch(1 0 0 / 0.06), 0 2px 0 0 oklch(0 0 0 / 0.4), 0 6px 14px
  -8px oklch(0 0 0 / 0.6)`): The `0 2px 0` hard layer is the key's physical side wall; on
  `:active` it collapses and the key translates down 2px.
- **Recessed field** (`inset 0 2px 5px oklch(0 0 0 / 0.35)`): Inputs sunk into the panel.

### Named Rules
**The Lit-Edge Rule.** Every raised surface carries a hairline light on its top edge (white for
panels and keys, cool blue for on-deck, warm white for LIVE). A panel with no top light reads as
a flat outlined box and is wrong for this world.

**The Physical-Key Rule.** Keys have a hard `0 2px 0` bottom edge at rest and lose it on press,
translating down 2px. They are pressed, not clicked.

## Shapes

Rectangular panels with a consistent soft radius — nothing is sharp-cornered, nothing is a pill
except progress tracks. Panel radius is 14px (`--arena-radius`); keys 11px; inline chip-keys
8px; inputs 10px; name-picker chips 9px. Borders are single hairlines in Line or Line Soft.
Progress tracks (`.od-ladder-track`) and the "Group" tag are fully rounded (`9999px` /
`rounded-sm`). The select caret is an inline SVG chevron, not a glyph-font arrow. Native
disclosure triangles are removed; `<summary>` carries its own affordance (mono label +
hover underline).

## Components

### Keys (buttons)
- **Character:** milled physical keys with engraved uppercase labels — the club's own hardware.
- **Shape:** 11px radius, 48px min-height, condensed 700 uppercase label, `letter-spacing 0.03em`.
- **Default (`.od-key`):** Panel-Raised fill, Line border, lit top edge + hard bottom edge.
  Hover lightens the fill ~6%; `:active` drops 2px and flattens the shadow.
- **Go (`.od-key--go`):** Orange fill, white ink — the one committing action (join the queue,
  next, add me). Hover lightens the orange ~7%.
- **Turnover (`.od-key--turnover.od-key--go`):** Full-width, 56px, `text-lg`, orange. The one
  action a courtside operator must find in a glance ("Court N done").
- **Ghost (`.od-key--ghost`):** Transparent, Line border, 40px, `arena-dim` — secondary/cancel
  ("Send next four", "Still going", "Cancel", "Undo").
- **Chip-key (`.od-key--chip`):** 36px, 8px radius, mono 0.72rem label — inline row controls
  ("Set aside", "Break up").
- **Disabled (all variants):** drops to an unlit dark neutral (`oklch(0.19 0.014 258)`), Line
  Soft border, `arena-faint` text. A disabled key never keeps a washed fill colour — a faded
  orange reads as broken, not unavailable.

### Chips (name picker)
- **Style:** Transparent with a Line border, condensed 700 uppercase, 40px, 9px radius.
- **State:** pressed = `.od-chip--on` — Imminent Blue fill, ground-colour ink, no border.
  Pressed is the cool imminent signal, never the orange live one (nobody is called yet).

### Cards / Panels
- **Corner:** 14px radius.
- **Background:** Panel by default; `.od-next` (blue wash) for the "Up next" foursome and
  "you're on deck"; `.od-live` (orange fill) for a called foursome and "you're up".
- **Shadow:** the Bolted panel recipe (see Elevation & Depth); state variants swap in the
  lit-sign or imminent top-wash recipe.
- **Border:** Line Soft hairline (transparent under `.od-live`; `arena-next-line` under `.od-next`).
- **Padding:** 20–24px; court tiles 16–20px.

### Inputs / Fields
- **Style:** `.od-field` / `.od-select` — Panel-Recessed fill, Line border, 10px radius, inset
  shadow, and **condensed 700 uppercase 1.25rem** value text (a name goes on the board, so it
  looks like it). Labels are the mono readout voice above the field.
- **Focus:** border shifts to Imminent Blue, plus a `0 0 0 3px` blue wash ring; the inset
  shadow stays.
- **Select:** inline SVG chevron, options fall back to Panel fill.

### Navigation
There is no in-arena nav bar. The shared header is the Juice Bros mark plus "ON DECK" in the
board voice; the footer is a single faint mono line. Surfaces are reached by URL (Club QR,
Volunteer link, Display/Kiosk URLs), not by navigating within the board.

### Signature Component — the Substitution Board
Two On-Deck foursome panels lead every board: slot 0 "Up next" is blue-lit (`.od-next`) and
carries a footer with the orange **progress-to-court ladder** ("N / 4 ready", a `scaleX`-driven
fill that eases as the foursome nears the front); slot 1 "After that" is plain Panel. Below,
courts render as a 2-up grid of tiles — an occupied tile lists four names in board type, an open
tile reads "OPEN" in orange over "Waiting for a foursome". Then the numbered queue behind its
rail. The player's phone collapses this whole board to one full-width `Verdict` panel.

### Signature Motion — the Call
`.od-court-fill`: when a court turns over, the court tile's names list is keyed on the foursome
identity, so it re-mounts and the incoming four flip down from `rotateX(-82deg)` over 460ms,
trailing one orange `text-shadow` glow that fades to nothing. Guarded by
`@media (prefers-reduced-motion: no-preference)`; reduced motion gets an instant swap. Companion
keyframes: `.od-slide-in` (a fresh foursome entering the "after that" slot, 320ms) and
`.od-call-land` (the player's "you're up" verdict landing once with a 0.96→1.03→1 scale pop).
The ladder fill transition (`transform 520ms`) runs regardless of motion preference because it
carries information.

## Do's and Don'ts

### Do:
- **Do** keep orange (`#f26522`) exclusively on LIVE — the called foursome, the just-opened
  court, "you're up", the turnover key, the go-key, the ladder fill.
- **Do** use the blue wash (`--arena-next`) for on-deck / imminent and for every focus outline.
- **Do** set names, court numbers and status words in Saira Condensed uppercase; set counts,
  positions and wait times in Geist Mono tabular, never below 0.75rem.
- **Do** give every raised surface a hairline lit top edge and real offset+blur depth.
- **Do** make operator keys physical: 48px+ (56px turnover), engraved uppercase label, hard
  bottom edge that collapses on press.
- **Do** run the numbered mono rail (`2.25ch`, right-aligned) down the left of every queue list.
- **Do** collapse a disabled key to the unlit dark neutral, never a faded fill colour.
- **Do** keep the one authored motion moment (the court-fill flip) and let everything else hold still.

### Don't:
- **Don't** introduce a third accent hue or tint the neutrals warm — waiting is graphite with
  no accent.
- **Don't** convert `#f26522` to OKLCH or adjust it for the dark ground.
- **Don't** put orange on anything that is merely important but not happening-now.
- **Don't** use the light shadcn card-stack, a max-width centered card, a hero shell, or a
  dashboard of equal-weight widgets here — this is one lit board.
- **Don't** add a decorative kicker or eyebrow over a heading; the mono label stands alone.
- **Don't** set the readout voice below 0.75rem or render body text uppercase-condensed (the
  quiet guidance sentence is the one sans, sentence-case exception).
- **Don't** animate anything on the board besides the court-fill flip, its companion slide/land,
  and the ladder fill.
