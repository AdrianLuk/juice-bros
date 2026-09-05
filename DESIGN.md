---
name: Juice Bros Pickleball — Marketing Site
description: Broadcast Dark — the category-standard podcast home page, held to SaaS finish discipline.
colors:
  bx-bg: "#08090b"
  bx-raised: "#101317"
  bx-raised-2: "#171b20"
  bx-line: "#23282e"
  bx-line-soft: "#191d22"
  bx-ink: "#f2f4f6"
  bx-muted: "#8f98a3"
  bx-accent: "#f26522"
  bx-accent-ink: "#ffffff"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4.4vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 3.2vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    letterSpacing: "0.14em"
rounded:
  card: "0.75rem"
  stage: "1rem"
  pill: "999px"
spacing:
  section-y: "3.5rem"
  section-y-lg: "5rem"
  grid-gap: "1.5rem"
  measure-max: "72rem"
components:
  button-play:
    backgroundColor: "{colors.bx-ink}"
    textColor: "{colors.bx-bg}"
    rounded: "{rounded.pill}"
    padding: "0.8125rem 1.375rem"
  button-play-hover:
    backgroundColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bx-ink}"
    rounded: "{rounded.pill}"
    padding: "0.8125rem 1.375rem"
  button-sub:
    backgroundColor: "{colors.bx-accent}"
    textColor: "{colors.bx-accent-ink}"
    rounded: "{rounded.pill}"
    padding: "0.8125rem 1.375rem"
  button-sub-hover:
    backgroundColor: "#ff7433"
  panel:
    backgroundColor: "{colors.bx-raised}"
    rounded: "{rounded.card}"
---

# Design System: Juice Bros Pickleball — Marketing Site

**Scope.** This file governs the **marketing site** only (Home, and — once the
look rolls out — Podcast, Gear, About, Contact, Tools, Appearances). Booking
Buddy, On Deck, and Pickle Point Pal are separate apps under `/apps` with their
own visual worlds, documented elsewhere (see `CONTEXT-MAP.md`). Nothing here
governs those three surfaces, and nothing in their worlds should be imported
into this one.

**Current adoption state.** Only the home page (`src/app/(home)`) ships this
system today, scoped under the `.bx-dark` class. The other six marketing
routes still run the incumbent look (an orange pill nav, eyebrow-pill labels,
rounded card grids) and have **not** adopted Broadcast Dark yet. Treat this
file as the target for those routes' next pass, not as a description of how
they look right now.

## Overview

**Creative North Star: "Broadcast Dark"**

The page is the show's own screen: a near-black stage with the newest episode
already sitting on it, and the rest of the catalogue arranged around it. This
is not an own-world invention — it is the category standard (the arrangement
a podcast-site visitor already expects) executed at full fidelity. Adrian
chose this explicitly over four committed own-world directions (a
season-guide print world, a public-access broadcast world, a painted-court
world, a group-chat world); convention is the commitment, not a fallback. The
craft bar is podcast structure with SaaS finish — held to the type, spacing,
and state discipline of Linear, Vercel, and Stripe.

The chrome is greyscale by design. Every color a visitor actually sees on the
page comes from the episode thumbnails and photos; the system itself supplies
only a ground, one raised surface, white ink, one muted grey, and a single
reserved accent. This restraint is what lets fourteen different YouTube
thumbnails sit on the same page without the chrome fighting them.

**Key Characteristics:**
- Near-black ground, one raised surface, no third "quiet" grey step
- One accent (brand orange), spent on exactly one job: the subscribe action
- One shared hover/focus gesture (lift + brighten) used identically everywhere a thumbnail appears
- Geist at one rigorous scale for all reading type; Geist Mono reserved for metadata only
- Pill-shaped controls, 0.75rem card radius, 4px-multiple spacing rhythm

## Colors

The palette is a near-black neutral scale plus a single reserved accent; there is no secondary or tertiary brand color.

### Primary
- **Brand Orange** (`#f26522`): reserved for exactly one job on this page — the subscribe button (`.bx-btn-sub`) and its focus ring/selection color. Never used for anything else on `.bx-dark` surfaces. On this near-black ground it measures 5.5:1 contrast; the 3.15:1 contrast problem PRODUCT.md documents is orange-on-white, which this look never does, so it does not need the "don't darken it to fix contrast" workaround here.

### Neutral
- **Ground** (`#08090b`): the page background — cool near-black, not warm.
- **Raised** (`#101317`): the one raised surface — panels, tiles, the stage.
- **Raised (hover)** (`#171b20`): the hover state of a raised panel.
- **Line** (`#23282e`): borders on hover/focus states.
- **Line, soft** (`#191d22`): resting borders and hairline section dividers.
- **Ink** (`#f2f4f6`): primary text and iconography. Clears 6.6:1 on the ground.
- **Muted** (`#8f98a3`): the only secondary-text step. Also clears strong contrast on the ground; there is deliberately no third, fainter grey.

### Named Rules
**The One Accent Rule.** Brand orange is spent only on the subscribe action (the header pill and the closing footer CTA) and its focus ring. If a new element on this page reaches for orange for any other reason — a badge, a kicker, a decorative underline — that is a system violation, not a variant.

**The No-Fake-Quiet Rule.** There is no third, fainter neutral step beyond ink and muted. A color that exists only to look quiet is a contrast failure waiting to happen; if something needs to recede, use size, weight, or spacing, not a fainter grey.

## Typography

**Display/Body Font:** Geist (with ui-sans-serif, system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback)

**Character:** One rigorous sans scale carries every heading and every line of body copy; Geist Mono is reserved entirely for metadata, so its appearance is a deliberate signal ("this is a date, a runtime, a count") rather than a stylistic accent.

### Hierarchy
- **Display** (700, `clamp(1.75rem, 4.4vw, 2.75rem)`, line-height 1.06, letter-spacing −0.03em, `text-wrap: balance`): the page's single h1 — the positioning line, not the brand name (the name already lives in the bar above it).
- **Headline** (700, `clamp(1.375rem, 3.2vw, 1.875rem)` down to a fixed 1.375rem/2xl at section scale, line-height 1.15, letter-spacing −0.02em): section headings and the featured episode title.
- **Body** (400, 1.0625rem for lead copy / 0.9375rem for supporting copy, line-height ~1.6, `leading-relaxed`): standfirst and description copy, capped around 46–58ch measure.
- **Label** (400, 0.6875rem, letter-spacing 0.14em, uppercase, tabular numerals, Geist Mono, muted color): dates, runtimes, counts, and the "New episode" / "Next tournament" style kickers that sit directly beside real data. Never used for body copy.

### Named Rules
**The Metadata-Only Mono Rule.** Geist Mono (`.bx-meta`) is reserved for machine-adjacent facts — a date, a runtime, a count — never for prose, section titles, or decorative labels. If a mono-styled string doesn't come from real data, it doesn't belong in `.bx-meta`.

## Layout

One `bx-measure` container (max-width 72rem, centered, 1.25rem inline padding below 640px, 2rem above) governs every section's width. Sections stack vertically with a consistent rhythm: `py-14` (3.5rem) on mobile, `py-20` (5rem) from `sm:` up, separated by a single hairline (`.bx-hair`, 1px `bx-line-soft` top border) rather than background-color changes or shadows.

Grids follow a responsive step-up: the episode archive runs 1 → 2 (`sm`) → 3 (`lg`) → 4 (`xl`) columns; the Instagram strip runs 3 → 6 columns; the tools grid runs 1 → 2 columns. Gaps hold to a small set of steps: `gap-3` (0.75rem) for the tightest grid (Instagram), `gap-4`–`gap-6` for card grids, `gap-8`–`gap-14` between major layout blocks. All spacing values observed on the page are 4px-scale multiples (0.375rem tick shown in the shared token comment through to 5rem section padding), consistent with the direction contract's "4px spacing system."

The header is a sticky, blurred bar (`sticky top-0`, `backdrop-blur-md`, 85%-opacity ground) that never obscures content because everything beneath it starts below `h-16`.

## Elevation & Depth

The system is flat by default and uses a single hairline-plus-shadow pairing for anything raised, never a shadow scale. A resting panel or tile carries a 1px inset ring only (`box-shadow: 0 0 0 1px var(--bx-line-soft)`) — not a drop shadow. The one true shadow token (`--bx-shadow`: a hairline highlight plus a soft, far-thrown dark shadow) appears only on hover/focus of a `.bx-tile`, alongside a 3px lift (`translateY(-3px)`), gated behind `prefers-reduced-motion: no-preference`.

### Shadow Vocabulary
- **Resting ring** (`box-shadow: 0 0 0 1px var(--bx-line-soft)`): the default state of every `.bx-tile` and `.bx-panel`.
- **Hover ring** (`box-shadow: 0 0 0 1px var(--bx-line)`): a one-step-brighter ring on hover/focus, no shadow yet added.
- **`--bx-shadow`** (`0 1px 0 rgb(255 255 255 / 0.04), 0 24px 48px -32px rgb(0 0 0 / 0.9)`): added alongside the hover ring only on `.bx-tile:hover`/`:focus-visible` — the sole true drop shadow in the system.

### Named Rules
**The Depth-Is-Earned Rule.** Nothing on this page carries a drop shadow at rest. A shadow only ever appears as the response to a hover or focus interaction on a `.bx-tile`; a panel that is merely raised in the layout gets a 1px ring, never a shadow.

## Shapes

Two radius steps cover the whole system: `0.75rem` (`--bx-radius`) for standard cards, tiles, and panels, and `1rem` (`--bx-radius-lg`) reserved for the one large hero tile (`.bx-stage`). Every interactive control — buttons, the mobile menu toggle, social icon buttons — is a full pill (`border-radius: 999px`). There are no square-cornered buttons and no sharp-cornered cards anywhere in the system. Borders are always 1px, always drawn from the two line tokens, never a heavier weight.

## Components

### Buttons (`.bx-btn`)
- **Shape:** full pill (999px radius), `0.8125rem 1.375rem` padding at default size, 600-weight 0.9375rem label.
- **Play** (`.bx-btn-play`): solid white-on-ink fill (background `--bx-ink`, text `--bx-bg`) — white is the loudest neutral available since the accent is already spoken for. Hover brightens to pure white.
- **Ghost** (`.bx-btn-ghost`): 1px `--bx-line` border, transparent fill, ink text. Hover darkens the border and adds the raised-surface background.
- **Subscribe** (`.bx-btn-sub`): the only button that spends the accent — solid brand orange fill, white text. Hover shifts to `#ff7433`. This is the sole place brand orange appears in the entire system.
- **Active state (all variants):** `translateY(1px)` press feedback.
- **Transitions:** background/border/color/transform all animate over 160ms with the same eased curve (`cubic-bezier(0.32, 0.72, 0, 1)`) used sitewide on this look.

### Cards / Containers
- **`.bx-panel`:** the generic raised block (tool cards, the appearance panel). 0.75rem radius, `--bx-raised` background, 1px resting ring, hover brightens to `--bx-raised-2` when the panel itself is a link.
- **`.bx-tile` (the signature gesture):** every thumbnail-bearing surface — the hero stage, archive cards, Instagram grid, the hosts' photo — is a `.bx-tile`. One hover/focus treatment (lift 3px, ring brightens, shadow appears, its `.bx-play` mark brightens and scales to 1.06) is applied identically everywhere a thumbnail exists, so the whole page has one gesture instead of scattered per-component effects. `.bx-stage` is a `.bx-tile` modifier that only changes the radius (1rem) and enlarges the play mark.
- **Internal Padding:** panels use `p-6`–`p-8` (1.5–2rem); tiles have no internal padding — the image fills the tile edge-to-edge.

### Signature Component: the play/duration pairing
- **`.bx-play`:** an authored SVG play glyph (never an icon-set import), centered absolutely on a `.bx-tile`, on a near-white translucent disc. 3.25rem on standard tiles, 4.5rem on `.bx-stage`.
- **`.bx-dur`:** the runtime chip, bottom-right of the tile, black-translucent background, Geist Mono, tabular numerals, white text.
- **`.bx-meta`:** the metadata line beneath a title (date · runtime · kicker), Geist Mono, uppercase, 0.14em tracking, muted color, tabular numerals.

### Navigation
The header is a sticky, blurred bar carrying the logo/wordmark, a horizontal link row (hidden below `md`), and the subscribe pill — the one accent-colored element in the bar. Below `md`, links collapse into a hamburger-triggered panel (a custom three-line SVG toggle that morphs to an X, not an icon-set glyph) that appears inline beneath the bar rather than as an overlay. Link hover is a color shift only (muted → ink), no underline, no background.

## Do's and Don'ts

### Do:
- **Do** author every hover/focus effect on a thumbnail through `.bx-tile` (lift + ring + shadow + play-mark brighten) rather than inventing a one-off transition — this is the page's one shared gesture.
- **Do** keep every `.bx-*` rule inside Tailwind's `components` layer. Unlayered CSS placed after `@import "tailwindcss"` outranks every layered utility class — that broke `md:hidden` and `normal-case` mid-build (a bare `.bx-btn` rule would have beaten a Tailwind responsive/case utility applied alongside it). Any new `.bx-*` rule must go inside the existing `@layer components { … }` block, not appended outside it.
- **Do** spend brand orange only on the subscribe action; every other accent need should reach for white-on-ink (`.bx-btn-play`) or the ghost outline instead.
- **Do** draw icons and glyphs (the play mark, the mobile menu toggle) as authored inline SVG so their geometry matches the rest of the page's drawing, rather than importing an icon-set component for these specific marks.
- **Do** render a section as `null` when its underlying data is empty (Archive, FreeTools, OnTheRoad, FromInstagram all do this) rather than printing an empty-state placeholder.

### Don't:
- **Don't** darken or otherwise alter brand orange (`#f26522`) to "fix" contrast — this is a confirmed brand commitment in PRODUCT.md. It is moot on `.bx-dark` surfaces anyway, since orange-on-near-black already clears 5.5:1; the 3.15:1 problem the commitment describes is orange-on-white, which this look never does.
- **Don't** add a third, fainter neutral tone beneath `--bx-muted`. The system has exactly two ink steps on purpose.
- **Don't** carry Broadcast Dark's `.bx-dark` scope, tokens, or components onto Booking Buddy, On Deck, or Pickle Point Pal routes, or vice versa — the four visual worlds are deliberately separate and none of them import another's tokens.
- **Don't** treat the six not-yet-migrated marketing routes (Podcast, Gear, About, Contact, Tools, Appearances) as already conforming to this system when auditing or extending them — they currently run the incumbent orange-pill-nav look and are pending migration, not already-compliant.
