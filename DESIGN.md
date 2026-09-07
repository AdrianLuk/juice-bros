---
name: Juice Bros Pickleball — Marketing Site
description: Broadcast Dark — the category-standard podcast home page, held to SaaS finish discipline.
colors:
  bx-bg: "#08090b"
  bx-raised: "#14181d"
  bx-raised-2: "#1b2027"
  bx-line: "#363d46"
  bx-line-soft: "#262c34"
  bx-line-2: "#48505a"
  bx-ink: "#f2f4f6"
  bx-muted: "#8f98a3"
  bx-accent: "#f26522"
  bx-accent-ink: "#ffffff"
  bx-youtube: "#ff0000"
  bx-youtube-ink: "#ffffff"
  bx-spotify: "#1db954"
  bx-spotify-ink: "#0a0a0a"
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
  bodySmall:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
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
  button-yt:
    backgroundColor: "{colors.bx-youtube}"
    textColor: "{colors.bx-youtube-ink}"
    rounded: "{rounded.pill}"
    padding: "0.8125rem 1.375rem"
  button-yt-hover:
    backgroundColor: "#e60000"
  button-sp:
    backgroundColor: "{colors.bx-spotify}"
    textColor: "{colors.bx-spotify-ink}"
    rounded: "{rounded.pill}"
    padding: "0.8125rem 1.375rem"
  button-sp-hover:
    backgroundColor: "#1ed760"
  panel:
    backgroundColor: "{colors.bx-raised}"
    rounded: "{rounded.card}"
  band:
    backgroundColor: "{colors.bx-raised}"
    borderColor: "{colors.bx-line-soft}"
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
routes still run the incumbent look (the same floating orange pill nav the
home page shares, plus eyebrow-pill labels and rounded card grids) and have
**not** adopted Broadcast Dark yet. Treat this
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

The chrome is greyscale by design, with two deliberate exceptions: the
floating pill nav (the global `SiteHeader`, shared with every marketing route),
which carries brand orange as its own ground, and the two platform buttons
(YouTube, Spotify), which wear their destinations' own brand colours because
those are the two places the page exists to send people to. Every
other colour a visitor sees comes from the episode thumbnails and photos; the
system itself supplies a ground, one raised surface, white ink, one muted
grey, brand orange, and the two platform colours. This restraint is what lets
fourteen different YouTube thumbnails sit on the same page without the chrome
fighting them.

**Key Characteristics:**
- Near-black page ground, one raised surface set a visible step above it (~1.2:1) with rings at ~1.4:1; no third "quiet" grey step for ink
- The page has one peak below the hero — Now Playing, on a full-bleed raised band — then the hosts and the archive as equal-rank majors, then a compressed shelf
- Brand orange is the floating pill nav's ground and the mobile corner button's fill — the global chrome, never a private bar, and never the subscribe colour
- Two platform colours (YouTube red, Spotify green) carry their own ink decisions, reasoned from contrast math and each platform's own brand guidance
- One shared hover/focus gesture (lift + brighten) used identically everywhere a thumbnail appears
- Geist at one rigorous scale for all reading type, with a `bodySmall` step for supporting copy; Geist Mono reserved for metadata only
- Pill-shaped controls, 0.75rem card radius, 4px-multiple spacing rhythm

## Colors

The palette is a near-black neutral scale plus brand orange and two destination-brand colours; there is no invented secondary or tertiary color.

### Primary
- **Brand Orange** (`#f26522`): the floating pill nav's ground (the global `SiteHeader`) and the fixed mobile corner menu button's fill, plus the focus-ring and selection color across the page. It is not a button colour on this page — see The Chrome-Carries-No-Control Rule below. On the near-black page ground it measures 5.5:1 contrast; the 3.15:1 contrast problem PRODUCT.md documents is orange-on-white, which this look never does, so it does not need the "don't darken it to fix contrast" workaround here.

### Secondary
- **YouTube Red** (`#ff0000`, ink `#ffffff`): the "Watch on YouTube" button's own fill, in the platform's own brand color rather than the site's. White text on this red measures 4.0:1 — marginally under the 4.5:1 AA bar for button text — kept anyway for brand fidelity as an explicit, recorded call; `#cc0000` is the swap noted in code if that ever needs to clear AA.
- **Spotify Green** (`#1db954`, ink `#0a0a0a`): the "Listen on Spotify" button's own fill. Ink is near-black, not white: white-on-this-green measures 2.6:1, near-black measures 8.2:1, and near-black is also what Spotify's own brand guidance specifies for this green.

### Neutral
- **Ground** (`#08090b`): the page background — cool near-black, not warm.
- **Raised** (`#14181d`): the one raised surface — panels, tiles, the stage, and the full-bleed Now Playing band. 1.12:1 on the ground, measured: lower than either line token, and legible only because it is spent across a full-bleed region.
- **Raised (hover)** (`#1b2027`): the hover state of a raised panel.
- **Line** (`#363d46`): borders on hover/focus states, and the resting ring of a tile that sits on the band (1.81:1 on the ground).
- **Line, soft** (`#262c34`): resting borders and hairline section dividers. 1.42:1 on the ground, the register Vercel's dark border sits at. The first build shipped `#191d22` here, which measures 1.16:1 and did not render on a real panel — the reason the page read as "nothing sticks out".
- **Line, strong** (`#48505a`): the hover ring of a tile on the band, one step above Line so the gesture still reads on the lighter ground.
- **Ink** (`#f2f4f6`): primary text and iconography. Clears 6.6:1 on the ground.
- **Muted** (`#8f98a3`): the only secondary-text step. Also clears strong contrast on the ground; there is deliberately no third, fainter grey.

### Named Rules
**The Chrome-Carries-No-Control Rule.** Brand orange is the floating pill nav's ground and the mobile corner button's fill, and the nav carries identity and links only — no subscribe pill, no button of any kind. A control on an orange ground would have to be near-black or an outline to be seen at all, and either reads weaker than the same action on the page ground. So the subscribe path lives where it can wear its own colour: the YouTube-red and Spotify-green buttons in the hero, and the YouTube-red close in the footer.

**The Visible-Step Rule.** Every value step has to survive a real screen, and the floor depends on how much area the step is spent across. A hairline or a resting ring needs **1.4:1** against its ground; a fill covering a full-bleed region gets away with **1.1:1**, because area does the work a thin line cannot. The first build ignored both: rings at 1.16:1 and a raised fill at 1.07:1, and the page read as flat black with text on it. Measure what you ship rather than estimating it — `#14181d` was documented here as "~1.2:1" and actually measures 1.12:1. When a new surface needs to recede, use size, weight or spacing, not a step below these floors.

**Platform Colours Carry Their Own Ink.** The YouTube and Spotify buttons wear their destinations' brand colors, each with its own reasoned ink choice (white for YouTube red at 4.0:1, kept for brand fidelity; near-black for Spotify green at 8.2:1, both for contrast and to match Spotify's own guidance). Do not default new destination buttons to the page's ink/bg pair — resolve ink per platform color the same way.

**The No-Fake-Quiet Rule.** There is no third, fainter neutral step beyond ink and muted. A color that exists only to look quiet is a contrast failure waiting to happen; if something needs to recede, use size, weight, or spacing, not a fainter grey.

## Typography

**Display/Body Font:** Geist (with ui-sans-serif, system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback)

**Character:** One rigorous sans scale carries every heading and every line of body copy; Geist Mono is reserved entirely for metadata, so its appearance is a deliberate signal ("this is a date, a runtime, a count") rather than a stylistic accent.

### Hierarchy
- **Display** (700, `clamp(1.75rem, 4.4vw, 2.75rem)`, line-height 1.06, letter-spacing −0.03em, `text-wrap: balance`): the page's single h1 — the positioning line, not the brand name (the name already lives in the bar above it).
- **Headline** (700, `clamp(1.375rem, 3.2vw, 1.875rem)` down to a fixed 1.375rem/2xl at section scale, line-height 1.15, letter-spacing −0.02em): section headings and the featured episode title.
- **Body** (400, 1.0625rem, line-height ~1.6, `leading-relaxed`): standfirst copy, capped around 46–58ch measure.
- **Body Small** (400, 0.9375rem, line-height ~1.6): supporting copy — card descriptions, footer text, host bios — used wherever body copy needs to sit a step down from the lead line without dropping into label territory.
- **Label** (400, 0.6875rem, letter-spacing 0.14em, uppercase, tabular numerals, Geist Mono, muted color): dates, runtimes and counts. Never used for body copy, and never placed above the heading it belongs to — see The Metadata-Sits-Under-Its-Heading Rule.

Section headings run on three steps, and the step is what tells a visitor how much a section matters:

- **Peak** (`clamp(1.75rem, 3.4vw, 2.125rem)`): the Now Playing title, alone. This is the section the page exists to deliver, and nothing else takes this step.
- **Headline** (`clamp(1.375rem, 3.2vw, 1.875rem)`): "Two rec players, not coaches", the episode archive, and the footer's closing line.
- **Minor** (`1.125rem` → `1.25rem` from `sm:`): the supporting shelf — Free tools, the next tournament, the Instagram strip. Inside a shelf section, content headings drop a step further (`1rem` → `1.125rem`) so the local hierarchy still holds.

**Every step keeps its floor above the next step's.** A clamp whose lower bound collapses onto its neighbour's deletes the whole channel at the viewport where most visitors are: the first version of this ladder bottomed out at 24/22/20px below 640px, a 4px spread across four ranks, so on a phone the page had no heading hierarchy at all. The floors are now 28/22/18/16px, and a new step is checked at 390px before it is checked at 1440.

### Named Rules
**The Metadata-Only Mono Rule.** Geist Mono (`.bx-meta`) is reserved for machine-adjacent facts — a date, a runtime, a count — never for prose, section titles, or decorative labels. If a mono-styled string doesn't come from real data, it doesn't belong in `.bx-meta`.

**The Metadata-Sits-Under-Its-Heading Rule.** A `.bx-meta` line always follows the heading it describes; it never sits above it. A small tracked label stacked over a heading is an eyebrow no matter how real its data, and it costs the section its own title as the first thing read. The archive cards, the tournament panel and Now Playing all run title-then-metadata.

**One Arrow Behaviour.** Every inline `→` link on the page (`Watch the episode`, `The whole story`, `Open <tool>`) carries the same `group-hover:translate-x-0.5` nudge. Three identical-looking links behaving two different ways is the scattered-effect failure; either all of them move or none do.

## Layout

One `bx-measure` container (max-width 72rem, centered, 1.25rem inline padding below 640px, 2rem above) governs every section's width.

**Vertical rhythm encodes rank; it is not one repeated value.** Three tiers, matched to the heading steps above and to the page's job (audience growth on YouTube and Spotify):

- **Band** (`py-16 sm:py-24 lg:py-28` inside `.bx-band`): Now Playing. The most air on the page, as well as the only lighter ground and the only peak heading — rank one has to win in every channel, or the channels argue with each other.
- **Major** (`py-16 sm:py-24`): the hosts and the archive — the positioning proof and the catalogue. Peers by rank, told apart by composition (a 26rem photo and prose against a dense four-column grid) rather than by size.
- **Shelf** (`py-10 sm:py-14`): Free tools, the next tournament, the Instagram strip. Each shelf section carries a label heading and its own "all of them" link, so the zone reads as matching sections rather than one labelled section beside an unidentifiable card.

**Hairlines group, they do not decorate.** `.bx-hair` (1px `bx-line-soft` top border) opens the archive and opens the shelf, and that is all. The three shelf sections run with no rules between them so they read as one supporting zone rather than three peers of the archive, and the hosts section carries no hairline at all because the band directly above it already ends on a border — a second rule there would double it. Adding a hairline to every section is what made the first build read as a flat plateau of equals.

Grids follow a responsive step-up: the episode archive runs 1 → 2 (`sm`) → 3 (`lg`) → 4 (`xl`) columns; the Instagram strip runs 3 → 6 columns; the tools grid runs 1 → 2 columns. Gaps hold to a small set of steps: `gap-3` (0.75rem) for the tightest grid (Instagram), `gap-4`–`gap-6` for card grids, `gap-8`–`gap-14` between major layout blocks. All spacing values observed on the page are 4px-scale multiples, consistent with the direction contract's "4px spacing system."

**The header is the global floating pill.** `SiteHeader` — the same component every marketing route renders — is `fixed top-0` on `/` (`hasOverlayHero`): a `rounded-full` brand-orange pill at `max-w-6xl` with `pt-4` above it, floating over the hero and staying fixed down the page. The home page has no private bar; `SiteChromeSlot` mounts the global header on `/` and suppresses only the global footer. Below `sm` the header is an in-flow orange identity strip (wordmark only) plus a fixed corner button (bottom-right, `size-14`, brand-orange fill) that opens a Sheet panel anchored to the same corner.

**Now Playing is a full-bleed band.** `.bx-band` paints the raised surface edge to edge with a hairline above and below, and the section's `bx-measure` sits inside it. It is the page's one peak below the hero: the scroll arrives at a lighter passage with the stage at up to 38rem (`lg:grid-cols-[minmax(0,38rem)_1fr]`, sized so the title beside it still has a readable measure rather than wrapping to four lines), and every other section returns to the page ground. Do not put a second band on the page.

**The hero is a two-layout component**, not one fixed composition (`src/app/(home)/sections/photo-hero.tsx`), and the banner photo of both hosts is a pinned asset — Adrian chose it over a stage-first hero, and it owns the full first screen (`sm:min-h-[100svh]`) under the floating pill. Wide (`sm:` and up), the banner photo is the section's own background (`sm:absolute sm:inset-0 sm:-z-10`) with the h1 and CTAs laid over it near the bottom, on a ramp that is fully opaque for its lowest 14% so the copy never shares a band with the banner's own baked-in type strip. Narrow, the banner is a plain in-flow block (a fixed 14rem-tall strip) and the copy sits beneath it, on the page's own dark ground, not on top of the image. This is a deliberate crop decision, not a simplification: the banner is a wide two-shot composed with the hosts on the left and right thirds and clear space in the middle, so a phone-shaped crop of that same image puts the hosts off-frame and leaves the overlay illegible exactly where most visitors are.

## Elevation & Depth

The system is flat by default and uses a single hairline-plus-shadow pairing for anything raised, never a shadow scale. A resting panel or tile carries a 1px inset ring only (`box-shadow: 0 0 0 1px var(--bx-line-soft)`) — not a drop shadow. The one true shadow token (`--bx-shadow`: a hairline highlight plus a soft, far-thrown dark shadow) appears only on hover/focus of a `.bx-tile`, alongside a 3px lift (`translateY(-3px)`), gated behind `prefers-reduced-motion: no-preference`.

### Shadow Vocabulary
- **Resting ring** (`box-shadow: 0 0 0 1px var(--bx-line-soft)`): the default state of every `.bx-tile` and `.bx-panel`.
- **Hover ring** (`box-shadow: 0 0 0 1px var(--bx-line)`): a one-step-brighter ring on hover/focus, no shadow yet added.
- **Band rings**: a `.bx-tile` inside `.bx-band` rests on `--bx-line` and hovers to `--bx-line-2`, one step up from the page-ground pair, so the gesture reads the same on the lighter ground.
- **`--bx-shadow`** (`0 1px 0 rgb(255 255 255 / 0.04), 0 24px 48px -32px rgb(0 0 0 / 0.9)`): added alongside the hover ring only on `.bx-tile:hover`/`:focus-visible` — the sole true drop shadow in the system.

### Named Rules
**The Depth-Is-Earned Rule.** Nothing on this page carries a drop shadow at rest. A shadow only ever appears as the response to a hover or focus interaction on a `.bx-tile`; a panel that is merely raised in the layout gets a 1px ring, never a shadow.

**The Portal-Escapes-The-Scope Rule.** `SheetContent` (and any other portaled surface — dialogs, popovers, toasts) renders through a portal at the document root, outside the page's own `.bx-dark` subtree. Every `--bx-*` custom property is scoped to `.bx-dark`, so a portaled panel that doesn't carry the class itself resolves every `--bx-*` reference to nothing and comes out unpainted. Any portaled surface used from inside `.bx-dark` must repeat the `bx-dark` class on its own root. This sits beside the `@layer components` rule below as the system's other cascade trap.

## Shapes

Two radius steps cover the whole system: `0.75rem` (`--bx-radius`) for standard cards, tiles, and panels, and `1rem` (`--bx-radius-lg`) reserved for the one large hero tile (`.bx-stage`). The mobile Sheet panel is the one exception, at a larger `rounded-3xl` to read as its own floating object anchored to the corner it grows from. Every interactive control — buttons, the mobile corner menu button, social icon buttons — is a full pill (`border-radius: 999px`). There are no square-cornered buttons and no sharp-cornered cards anywhere in the system. Borders are always 1px, always drawn from the two line tokens, never a heavier weight.

## Components

### Buttons (`.bx-btn`)
- **Shape:** full pill (999px radius), `0.8125rem 1.375rem` padding at default size, 600-weight 0.9375rem label.
- **Play** (`.bx-btn-play`): solid white-on-ink fill (background `--bx-ink`, text `--bx-bg`) — white is the loudest neutral available since orange is spoken for elsewhere. Hover brightens to pure white.
- **Ghost** (`.bx-btn-ghost`): 1px `--bx-line` border, transparent fill, ink text. Hover darkens the border and adds the raised-surface background.
- **YouTube** (`.bx-btn-yt`): solid YouTube red (`--bx-youtube`) fill, white text. Hover darkens to `#e60000`.
- **Spotify** (`.bx-btn-sp`): solid Spotify green (`--bx-spotify`) fill, near-black text (`--bx-spotify-ink`). Hover brightens to `#1ed760`.
- **Active state (all variants):** `translateY(1px)` press feedback.
- **Transitions:** background/border/color/transform all animate over 160ms with the same eased curve (`cubic-bezier(0.32, 0.72, 0, 1)`) used sitewide on this look.

### Cards / Containers
- **`.bx-panel`:** the generic raised block (tool cards, the appearance panel). 0.75rem radius, `--bx-raised` background, 1px resting ring, hover brightens to `--bx-raised-2` when the panel itself is a link.
- **`.bx-band`:** the full-bleed raised passage. `--bx-raised` background, 1px `--bx-line-soft` top and bottom, no radius — it is a region of the page, not an object on it. Used once, for Now Playing.
- **`.bx-card`:** the archive card wrapper. Its thumbnail link is `aria-hidden`/`tabIndex={-1}` (the title beside it is the real link), so `.bx-tile:focus-visible` can never fire on it; `.bx-card:focus-within` mirrors the full gesture instead, and a keyboard visitor gets the same lift a pointer does.
- **`.bx-tile` (the signature gesture):** every thumbnail-bearing surface — the hero stage, archive cards, Instagram grid, the hosts' photo — is a `.bx-tile`. One hover/focus treatment (lift 3px, ring brightens, shadow appears, its `.bx-play` mark brightens and scales to 1.06) is applied identically everywhere a thumbnail exists, so the whole page has one gesture instead of scattered per-component effects. `.bx-stage` is a `.bx-tile` modifier that only changes the radius (1rem) and enlarges the play mark.
- **Internal Padding:** panels use `p-6`–`p-8` (1.5–2rem); tiles have no internal padding — the image fills the tile edge-to-edge.

### Signature Component: the play/duration pairing
- **`.bx-play`:** an authored SVG play glyph (never an icon-set import), centered absolutely on a `.bx-tile`, on a near-white translucent disc. 3.25rem on standard tiles, 4.5rem on `.bx-stage`.
- **`.bx-dur`:** the runtime chip, bottom-right of the tile, black-translucent background, Geist Mono, tabular numerals, white text.
- **`.bx-meta`:** the metadata line beneath a title (date · runtime · kicker), Geist Mono, uppercase, 0.14em tracking, muted color, tabular numerals.

### Navigation
The header is the global `SiteHeader` (`src/components/layout/site-header.tsx`), not a component of this system: a fixed floating brand-orange pill carrying the logo/wordmark and the link row with a white/12 active pill, and no control of any kind. Below `sm`, an in-flow orange identity strip; a fixed corner button (bottom-right, brand-orange fill, `lucide-react` menu glyph) opens a Sheet panel anchored to the same corner. That header and its Sheet are styled from the site's brand tokens and render outside `.bx-dark`, so the Portal-Escapes-The-Scope Rule does not apply to them; it still applies to any portal the page itself opens. Link hover elsewhere on the page is a color shift only (muted → ink), no underline, no background.

### The Hero (signature, two-layout)
Wide screens run the banner as the section background with the h1/CTAs laid over it; narrow screens run the banner as an in-flow block with the copy beneath it on the dark page ground. See Layout for the full reasoning — the composition of the source photo, not a generic responsive simplification, drives the split.

## Do's and Don'ts

### Do:
- **Do** author every hover/focus effect on a thumbnail through `.bx-tile` (lift + ring + shadow + play-mark brighten) rather than inventing a one-off transition — this is the page's one shared gesture.
- **Do** keep every `.bx-*` rule inside Tailwind's `components` layer. Unlayered CSS placed after `@import "tailwindcss"` outranks every layered utility class — that broke `md:hidden` and `normal-case` mid-build (a bare `.bx-btn` rule would have beaten a Tailwind responsive/case utility applied alongside it). Any new `.bx-*` rule must go inside the existing `@layer components { … }` block, not appended outside it.
- **Do** repeat the `bx-dark` class on any portaled surface (Sheet, Dialog, popover, toast) opened from within `.bx-dark` — see The Portal-Escapes-The-Scope Rule.
- **Do** give a destination-brand button (YouTube, Spotify, or any future platform button) its own reasoned ink choice from a real contrast check against that platform's own color, rather than defaulting to the page's ink/bg pair.
- **Do** draw icons and glyphs (the play mark, the runtime chip) as authored inline SVG so their geometry matches the rest of the page's drawing, rather than importing an icon-set component for these specific marks.
- **Do** render a section as `null` when its underlying data is empty (Archive, FreeTools, OnTheRoad, FromInstagram all do this) rather than printing an empty-state placeholder.

### Don't:
- **Don't** darken or otherwise alter brand orange (`#f26522`) to "fix" contrast — this is a confirmed brand commitment in PRODUCT.md. It is moot on `.bx-dark` surfaces anyway, since orange-on-near-black already clears 5.5:1; the 3.15:1 problem the commitment describes is orange-on-white, which this look never does.
- **Don't** put a control on the pill nav, or brand orange on any button on this page — see The Chrome-Carries-No-Control Rule. The subscribe path wears YouTube red.
- **Don't** add a ring, hairline or fill step below the Visible-Step floor (~1.4:1 for a line, ~1.2:1 for a fill). If it would not show on a phone in a bright room, it is not hierarchy.
- **Don't** add a third, fainter neutral tone beneath `--bx-muted`. The system has exactly two ink steps on purpose.
- **Don't** carry Broadcast Dark's `.bx-dark` scope, tokens, or components onto Booking Buddy, On Deck, or Pickle Point Pal routes, or vice versa — the four visual worlds are deliberately separate and none of them import another's tokens.
- **Don't** treat the six not-yet-migrated marketing routes (Podcast, Gear, About, Contact, Tools, Appearances) as already conforming to this system when auditing or extending them — they currently run the incumbent orange-pill-nav look and are pending migration, not already-compliant.
</content>
