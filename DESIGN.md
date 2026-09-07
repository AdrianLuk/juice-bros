---
name: Juice Bros Pickleball — Marketing Site
description: Broadcast Dark — the category-standard podcast home page, held to SaaS finish discipline.
colors:
  bx-bg: "#08090b"
  bx-raised: "#14181d"
  bx-raised-2: "#1b2027"
  bx-line-soft: "#262c34"
  bx-line: "#363d46"
  bx-line-2: "#48505a"
  bx-ink: "#f2f4f6"
  bx-muted: "#8f98a3"
  bx-accent: "#f26522"
  bx-accent-ink: "#ffffff"
  bx-youtube: "#ff0000"
  bx-youtube-ink: "#ffffff"
  bx-spotify: "#1db954"
  bx-spotify-ink: "#0a0a0a"
  bx-instagram: "#e1306c"
  bx-instagram-ink: "#ffffff"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5.4vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  peak:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.4vw, 2.125rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 3.2vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  minor:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
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
  link:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  field:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    letterSpacing: "0.14em"
rounded:
  card: "0.75rem"
  stage: "1rem"
  chip: "0.25rem"
  pill: "999px"
spacing:
  shelf-y: "2.5rem"
  shelf-y-lg: "3.5rem"
  section-y: "4rem"
  section-y-lg: "6rem"
  band-y-xl: "7rem"
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
  button-ghost-hover:
    backgroundColor: "{colors.bx-raised}"
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
  button-ig:
    backgroundColor: "{colors.bx-instagram}"
    textColor: "{colors.bx-instagram-ink}"
    rounded: "{rounded.pill}"
    padding: "0.8125rem 1.375rem"
  button-ig-hover:
    backgroundColor: "#d81b60"
  field:
    backgroundColor: "{colors.bx-bg}"
    textColor: "{colors.bx-ink}"
    rounded: "{rounded.card}"
    padding: "0.75rem 0.875rem"
    typography: "{typography.field}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.bx-ink}"
    rounded: "{rounded.chip}"
    padding: "0.1875rem 0.4375rem"
  plate:
    backgroundColor: "#ffffff"
    rounded: "{rounded.card}"
  panel:
    backgroundColor: "{colors.bx-raised}"
    rounded: "{rounded.card}"
    padding: "1.5rem"
  panel-hover:
    backgroundColor: "{colors.bx-raised-2}"
  band:
    backgroundColor: "{colors.bx-raised}"
    padding: "4rem 0"
  tile:
    backgroundColor: "{colors.bx-raised}"
    rounded: "{rounded.card}"
  stage:
    backgroundColor: "{colors.bx-raised}"
    rounded: "{rounded.stage}"
  duration-chip:
    backgroundColor: "rgb(0 0 0 / 0.78)"
    textColor: "#ffffff"
    rounded: "{rounded.chip}"
    padding: "0.1875rem 0.375rem"
    typography: "{typography.label}"
---

# Design System: Juice Bros Pickleball — Marketing Site

**Scope.** This file governs the **marketing site** only (Home, and — once the
look rolls out — Podcast, Gear, About, Contact, Tools, Appearances). Booking
Buddy, On Deck, and Pickle Point Pal are separate worlds with their own
documentation, indexed by `CONTEXT-MAP.md`. Nothing here governs those three
surfaces, and nothing in their worlds should be imported into this one.

**Current adoption state.** The whole marketing site ships this system: Home,
Podcast (index and `/podcast/[slug]`), Tools (index and `/tools/[slug]`), Gear,
Appearances, About and Contact. The `.bx-dark` scope is applied once, by
`SiteShell` (`src/components/layout/site-shell.tsx`), to the wrapper holding the
header, `<main>` and the footer — not per page. It has to be the shell: the pill
nav is `sticky` on interior routes, so it sits in flow above `<main>`, and a
per-page ground left a bare light band across the top of every dark route.
`body:has(.bx-dark)` paints the document behind it, which is what shows on an
elastic overscroll.

Routes deliberately **outside** the scope: Booking Buddy, On Deck and Pickle
Point Pal (their own worlds), and `/s/[token]` and `/connect/[token]`, which are
Booking Buddy flows wearing the global chrome and stay on the incumbent light
ground until Booking Buddy's world reaches them. `SiteFooter` carries `bx-dark`
on its own root so it paints correctly on those pages too.

## Overview

**Creative North Star: "Broadcast Dark"**

The page is the show's own screen: a near-black stage with the newest episode
already sitting on it, and the rest of the catalogue arranged around it. This is
not an own-world invention — it is the category standard, the arrangement a
podcast-site visitor already expects, executed at full fidelity. Adrian chose it
explicitly over four committed own-world directions (a season-guide print world,
a public-access broadcast world, a painted-court world, a group-chat world), so
convention is the commitment, not a fallback. The craft bar is podcast structure
with SaaS finish — held to the type, spacing, and state discipline of Linear,
Vercel, and Stripe.

The chrome is greyscale by design, with two deliberate exceptions: the floating
pill nav (the global `SiteHeader`, shared with every marketing route), which
carries brand orange as its own ground, and the two platform buttons (YouTube,
Spotify), which wear their destinations' own brand colours because those are the
two places the page exists to send people to. Every other colour a visitor sees
comes from the episode thumbnails and photos; the system itself supplies a
ground, one raised surface, three line steps, white ink, one muted grey, brand
orange, and the two platform colours. This restraint is what lets a dozen
different YouTube thumbnails sit on the same page without the chrome fighting
them.

**Key Characteristics:**
- Near-black page ground, one raised surface a measured step above it (1.12:1),
  with rings from 1.42:1 up to 2.44:1; no third "quiet" grey step for ink
- One peak below the hero — Now Playing, on the page's only full-bleed raised
  band — then the archive and the hosts as equal-rank majors, then a compressed
  three-section shelf, then the footer
- Brand orange is the floating pill nav's ground, the mobile corner button's
  fill, and the focus ring and selection colour; it is never a button on the page
- Two platform colours (YouTube red, Spotify green) carry their own reasoned ink
- One shared hover/focus gesture (lift, brighter ring, shadow, play-mark
  brighten) used identically everywhere a thumbnail appears
- Geist at one rigorous scale for every heading and every line of prose, with a
  supporting small step; Geist Mono reserved for metadata
- Pill controls, 0.75rem card radius, 4px-multiple spacing rhythm

## Colors

The palette is a near-black neutral scale plus brand orange and two
destination-brand colours; there is no invented secondary or tertiary hue.

### Primary
- **Brand Orange** (`#f26522`): the floating pill nav's ground (the global
  `SiteHeader`), the fixed mobile corner menu button's fill, and the page's
  `:focus-visible` outline and `::selection` background. It is not a button
  colour on this page — see The Chrome-Carries-No-Control Rule. On the page
  ground it measures **6.32:1**; the 3.15:1 problem PRODUCT.md documents is
  orange-on-white, which this look never does, so no darkening is needed here.

### Secondary
- **YouTube Red** (`#ff0000`, ink `#ffffff`): the "Watch on YouTube" and
  "Subscribe on YouTube" fills, in the platform's own brand colour rather than
  the site's. White on this red measures **4.00:1** — marginally under the 4.5:1
  AA bar for button text — kept for brand fidelity as an explicit recorded call;
  `#cc0000` is the swap noted in code if that ever has to clear AA.
- **Spotify Green** (`#1db954`, ink `#0a0a0a`): the "Listen on Spotify" fill.
  Ink is near-black, not white: white on this green measures 2.59:1, near-black
  measures **7.66:1**, and near-black is what Spotify's own brand guidance
  specifies for this green.
- **Instagram Pink** (`#e1306c`, ink `#ffffff`, hover `#d81b60`): the third
  destination fill, used in exactly two places — the About page's closing "Follow
  on Instagram" and the Contact page's "The show". White on it measures
  **4.34:1**, the same register as white on YouTube red, kept on the same
  recorded reasoning. It is *not* used in the footer, where Instagram is one
  social link among three and stays a ghost icon button; a brand fill there
  would make the least important of the three the loudest.

### Neutral
All ratios below are measured against the page ground `#08090b`.
- **Ground** (`#08090b`): the page background — cool near-black, not warm.
- **Raised** (`#14181d`): the one raised surface — panels, tiles, the stage, and
  the full-bleed Now Playing band. **1.12:1**, lower than any line token, and
  sufficient only because it is spent across a full-bleed region.
- **Raised, hover** (`#1b2027`): the hover fill of a linked panel (1.22:1).
- **Line, soft** (`#262c34`): resting rings and hairline dividers. **1.42:1**,
  the register Vercel's dark border sits at. An earlier build shipped `#191d22`
  here — 1.16:1, invisible on a real panel — which is why the page read as
  "nothing sticks out."
- **Line** (`#363d46`): the hover/focus ring on the page ground, and the resting
  ring of a tile sitting on the band (**1.81:1**).
- **Line, strong** (`#48505a`): the hover ring of a tile on the band
  (**2.44:1**), one step up so the gesture reads the same on the lighter ground.
- **Ink** (`#f2f4f6`): primary text and iconography. **18.07:1** on the ground,
  16.17:1 on the band.
- **Muted** (`#8f98a3`): the only secondary-text step. **6.82:1** on the ground,
  6.10:1 on the band — readable copy, not atmosphere. There is deliberately no
  third, fainter grey.

### Named Rules
**The Chrome-Carries-No-Control Rule.** Brand orange is the floating pill nav's
ground and the mobile corner button's fill, and the nav carries identity and
links only — no subscribe pill, no button of any kind. A control on an orange
ground would have to be near-black or an outline to be seen at all, and either
reads weaker than the same action on the page ground. So the subscribe path
lives where it can wear its own colour: the YouTube-red and Spotify-green
buttons in the hero, and the YouTube-red close in the footer.

**The Visible-Step Rule.** Every value step has to survive a real screen, and
the floor depends on how much area the step is spent across. A hairline or a
resting ring needs **1.4:1 against the ground it is actually drawn on**; a fill
covering a full-bleed region gets away with **1.1:1**, because area does the work
a thin line cannot. This is why a tile inside the band steps its rings up from
line-soft/line to line/line-strong: on the raised fill, line-soft would fall to
1.27:1. Measure what you ship rather than estimating it. When a new surface needs
to recede, use size, weight or spacing, never a step below these floors.

**Platform Colours Carry Their Own Ink.** The YouTube and Spotify buttons wear
their destinations' brand colours, each with its own reasoned ink choice. Do not
default a new destination button to the page's ink/bg pair — resolve its ink
from a real contrast check against that platform's colour the same way.

**The No-Fake-Quiet Rule.** There is no third, fainter neutral step beneath
muted. A colour that exists only to look quiet is a contrast failure waiting to
happen; if something needs to recede, use size, weight, or spacing.

**The Field-Rings-Step-Up Rule.** A form field sits inside a `.bx-panel`, so its
resting ring is `--bx-line` and its hover ring `--bx-line-2` — the same step-up
a tile takes on the band, for the same reason: on the raised fill, `line-soft`
falls to 1.27:1 and disappears. The field's own fill drops to the page ground so
it reads as cut into the panel rather than stacked on it. Nothing on a panel
takes a resting ring at `line-soft`.

**A Panel Cannot Sit On The Band.** `.bx-panel` and `.bx-band` are both
`--bx-raised`, so a panel drawn on the band is invisible, and stepping it to
`raised-2` only buys 1.09:1 — under the floor for a shape that is not full
bleed. A band section holds content directly (Now Playing, the Mission, Up
Next), never a grid of cards. If a section wants cards, it belongs on the page
ground.

## Typography

**Display/Body Font:** Geist (with ui-sans-serif, system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback)

**Character:** One rigorous sans scale carries every heading and every line of
body copy; Geist Mono is reserved entirely for metadata, so its appearance is a
deliberate signal ("this is a date, a runtime, a count") rather than a stylistic
accent.

### Hierarchy
- **Display** (700, `clamp(2.25rem, 5.4vw, 3.5rem)`, line-height 1.06,
  letter-spacing −0.03em, `text-wrap: balance`, max 18ch): the page's single h1 —
  the positioning line, not the brand name, which already lives in the pill above
  it.
- **Peak** (700, `clamp(1.75rem, 3.4vw, 2.125rem)`, line-height 1.15,
  letter-spacing −0.02em, max 20ch): the Now Playing title, alone. This is the
  section the page exists to deliver, and nothing else takes this step.
- **Headline** (700, `clamp(1.375rem, 3.2vw, 1.875rem)`): the hosts section, the
  archive, and the footer's closing line — the page's major sections.
- **Minor** (700, `1.125rem` → `1.25rem` from `sm:`): the supporting shelf — free
  tools, the next tournament, the Instagram strip. Content headings inside a
  shelf section drop one further step (`1rem` → `1.125rem`) so local hierarchy
  still holds.
- **Body** (400, 1.0625rem, line-height 1.6): the standfirst and each section's
  lead paragraph, capped at a 46–48ch measure.
- **Body Small** (400, 0.9375rem, line-height 1.6): supporting copy — archive
  card titles (at 600 weight), panel descriptions, host bios, footer copy —
  wherever prose sits a step below the lead line without dropping into label
  territory.
- **Link** (600 for `.bx-actionlink`, 400 for `.bx-quietlink`, `0.875rem`): the
  inline link register — "Watch the episode", "View all", "Open Booking Buddy".
  It shipped on the home page as `text-sm` from the first build and was simply
  never written down; it is named here because six more routes now use it.
- **Field** (400, `1rem`, `.bx-field` / `.bx-label` at `0.875rem`): form
  controls. 16px is the one literal off the ramp and it is deliberate — anything
  smaller makes iOS Safari zoom the page when an input takes focus.
- **Label** (400, 0.6875rem, letter-spacing 0.14em, uppercase, tabular numerals,
  Geist Mono, muted): dates, runtimes, counts, terms.

**The heading ladder has four ranks, and every step keeps its floor above the
next step's.** A clamp whose lower bound collapses onto its neighbour's deletes
the whole channel at the viewport where most visitors are: an earlier version of
this ladder bottomed out at 24/22/20px below 640px, a 4px spread, so on a phone
the page had no heading hierarchy at all. The shipped floors are **36 / 28 / 22 /
18px** from h1 down through peak, headline and minor, with a 16px content step
inside the shelf. Check a new step at 390px before checking it at 1440 — the h1
itself sat at 32px against the peak step's 28px until that check caught it, which
had made the page's largest step its least obvious one.

### Named Rules
**The Metadata-Only Mono Rule.** Geist Mono (`.bx-meta`) is reserved for
machine-adjacent facts — a date, a runtime, a count, a terms line. Never prose,
never section titles, never a decorative label. If a mono-styled string doesn't
come from real data, it doesn't belong in `.bx-meta`. The footer's copyright line
is the single borderline use, and it opts out of the uppercase and the tracking
rather than shouting a legal string.

**The Metadata-Sits-Under-Its-Heading Rule.** A `.bx-meta` line always follows
the heading it describes; it never sits above it. A small tracked label stacked
over a heading is an eyebrow no matter how real its data, and it costs the
section its own title as the first thing read. Now Playing, the archive cards,
the tool panels and the tournament panel all run title-then-metadata.

**One Arrow Behaviour.** Every inline `→` link on the page (`Watch the episode`,
`The whole story`, `Tournament details`, `Open <tool>`) carries the same
`translate-x-0.5` nudge on group hover, over 200ms. Identical-looking links
behaving two different ways is the scattered-effect failure; either all of them
move or none do.

## Layout

One `.bx-measure` container (max-width 72rem, centered, 1.25rem inline padding
below 640px, 2rem above) governs every section's width, including the content
inside the full-bleed band.

**Vertical rhythm encodes rank; it is not one repeated value.** Three tiers,
matched to the heading steps above and to the page's job (audience growth on
YouTube and Spotify), plus the footer's own close:

- **Band** (`py-16 sm:py-24 lg:py-28` — 4/6/7rem, inside `.bx-band`): Now
  Playing. The most air on the page, as well as the only lighter ground and the
  only peak heading — rank one has to win in every channel, or the channels argue
  with each other.
- **Major** (`py-16 sm:py-24` — 4/6rem): the archive and the hosts, the
  positioning proof and the catalogue. Peers by rank, told apart by composition
  (a 26rem photo and prose against a dense four-column grid) rather than by size.
- **Shelf** (`py-10 sm:py-14` — 2.5/3.5rem): free tools, the next tournament, the
  Instagram strip. Each shelf section carries a minor heading and its own "all of
  them" link, so the zone reads as matching sections rather than one labelled
  section beside an unidentifiable card.
- **Footer** (`py-14 sm:py-16`, after a `mt-4`): the closing subscribe block,
  between shelf and major in air.

**A fact appears once.** An episode's runtime is drawn on its thumbnail, in the
chip a video player would put it in, so it is not printed again in the metadata
line below — that line carries the date alone. The rule is about the whole
composition, not the string: the thumbnail is read before the caption, so a
caption that repeats it spends the page's smallest type on something already
known. Where the visible instance sits inside an `aria-hidden` tile or a link
named by its `aria-label`, the caption keeps an `sr-only` copy, because "once"
means once per reader, not once per document.

**Hairlines group, they do not decorate.** `.bx-hair` (1px line-soft top border)
is drawn in exactly three places at section level: it opens the hosts section, it
opens the shelf (on the first shelf section only), and it opens the footer. The
other two shelf sections run with no rule between them, so the zone reads as one
supporting passage rather than three peers of the archive; the archive itself
carries no hairline at all because the band directly above it already ends on a
border, and a second rule there would double it. Inside the footer the same
hairline is reused twice more as an internal divider — the one place on the page
a rule separates rows rather than sections. Putting a hairline on every section
is what made an earlier build read as a flat plateau of equals.

**Grids step up responsively.** The episode archive runs 1 → 2 (`sm`) → 3 (`lg`)
→ 4 (`xl`) columns; the Instagram strip runs 3 → 6 (`lg`); the tools grid runs
1 → 2 (`md`). Gaps hold to a small set of steps: `gap-3` (0.75rem) for the
tightest grid, `gap-4`–`gap-6` for card grids (the archive splits them, 1.5rem
across and 2.25rem down, so wrapped two-line titles never crowd the row below),
and `gap-8`–`gap-16` between major layout blocks. Every spacing value on the page
is a 4px-scale multiple.

**The header is the global floating pill.** `SiteHeader` — the same component
every marketing route renders — is `fixed top-0` on `/` (`hasOverlayHero`): a
`rounded-full` brand-orange pill at `max-w-6xl` with `pt-4` above it, floating
over the hero and staying fixed down the page. The home page has no private bar;
`SiteChromeSlot` mounts the global header on `/` and suppresses only the global
footer, so the near-black look runs to the bottom of the page. Below `sm` the
header is an in-flow orange identity strip (wordmark only) plus a fixed corner
button (bottom-right, `size-14`, brand-orange fill) that opens a Sheet panel
anchored to the same corner.

**Now Playing is a full-bleed band.** `.bx-band` paints the raised surface edge
to edge with a hairline above and below, and the section's measure sits inside
it. It is the page's one peak below the hero: the scroll arrives at a lighter
passage with the stage at up to 38rem
(`lg:grid-cols-[minmax(0,38rem)_1fr]`, sized so the title beside it keeps a
readable measure rather than wrapping to four lines), and every other section
returns to the page ground. Do not put a second band on the page.

**The hero is a two-layout component**, not one fixed composition
(`sections/photo-hero.tsx`), and the banner photo of both hosts is a pinned asset
— Adrian chose it over a stage-first hero, and it owns the full first screen
(`sm:min-h-[100svh]`) under the floating pill. Wide (`sm:` and up), the banner is
the section's own background (`sm:absolute sm:inset-0 sm:-z-10`) with the h1 and
CTAs laid over it near the bottom, on a ramp that is fully opaque for its lowest
14% so the copy never shares a band with the banner's own baked-in type. Narrow,
the banner is a plain in-flow block (a fixed 14rem strip with a 5rem
foot-softening ramp) and the copy sits beneath it on the page's own dark ground.
This is a crop decision, not a simplification: the banner is a wide two-shot with
the hosts on the left and right thirds and clear space in the middle, so a
phone-shaped crop puts the hosts off-frame and leaves the overlay illegible
exactly where most visitors are.

## Elevation & Depth

The system is flat by default and uses a single hairline-plus-shadow pairing for
anything raised, never a shadow scale. A resting panel or tile carries a 1px
inset ring only — not a drop shadow. The one true shadow token appears only on
hover/focus of a `.bx-tile`, alongside a 3px lift (`translateY(-3px)`) gated
behind `prefers-reduced-motion: no-preference`. Depth otherwise comes from the
tonal step between ground and raised fill, and from the band's full-bleed area.

### Shadow Vocabulary
- **Resting ring** (`box-shadow: 0 0 0 1px var(--bx-line-soft)`): the default
  state of every tile and panel on the page ground.
- **Hover ring** (`box-shadow: 0 0 0 1px var(--bx-line)`): one step brighter on
  hover/focus; panels take it alone, tiles take it with the shadow.
- **Band rings**: a tile inside the band rests on `--bx-line` and hovers to
  `--bx-line-2`, one step up from the page-ground pair, so the gesture reads the
  same on the lighter ground.
- **`--bx-shadow`**
  (`0 1px 0 rgb(255 255 255 / 0.04), 0 24px 48px -32px rgb(0 0 0 / 0.9)`): a
  hairline highlight plus a soft, far-thrown dark shadow, added alongside the
  hover ring on `.bx-tile:hover` / `:focus-visible` and on
  `.bx-card:focus-within .bx-tile`. It is the only true drop shadow in the
  system.

### Named Rules
**The Depth-Is-Earned Rule.** Nothing on this page carries a drop shadow at rest.
A shadow only ever appears as the response to a hover or focus interaction on a
tile; a panel that is merely raised in the layout gets a 1px ring, never a
shadow.

**The Portal-Escapes-The-Scope Rule.** Every `--bx-*` custom property is scoped
to `.bx-dark`. A portaled surface — Sheet, Dialog, popover, toast — renders at
the document root, outside that subtree, so it resolves every `--bx-*` reference
to nothing and comes out unpainted. Any portaled surface opened from inside
`.bx-dark` must repeat the `bx-dark` class on its own root. This is one of the
system's two cascade traps; the other is the layer rule in Do's and Don'ts.

## Shapes

Two radius steps cover the page: `0.75rem` (`--bx-radius`) for cards, tiles and
panels, and `1rem` (`--bx-radius-lg`) reserved for the one large hero tile, the
stage. The runtime chip takes a tight `0.25rem`, and the page's focus ring rounds
to the same value so it hugs small inline targets. Every interactive control —
buttons, the mobile corner button, the footer's social icon buttons — is a full
pill (999px). There are no square-cornered buttons and no sharp-cornered cards.
Borders are always 1px, always drawn from the three line tokens, never a heavier
weight. Media is cropped to its own aspect: 16:9 for the stage and archive
thumbnails, 4:3 for the hosts photo, 1:1 for the Instagram strip.

## Components

### Buttons (`.bx-btn`)
- **Shape:** full pill (999px), `0.8125rem 1.375rem` padding, 0.9375rem/600
  label, inline-flex with a 0.5rem gap for a leading icon.
- **Play** (`.bx-btn-play`): solid ink fill with near-black text — white is the
  loudest neutral available, since orange is spoken for elsewhere. Hover
  brightens to pure white.
- **Ghost** (`.bx-btn-ghost`): 1px line border, transparent fill, ink text. Hover
  brightens the border and adds the raised fill. Also the footer's `size-10`
  social icon buttons, which drop the padding to zero.
- **YouTube** (`.bx-btn-yt`): solid YouTube red, white text; hover `#e60000`. The
  footer's subscribe close scales the same variant up (`px-6 py-3.5`, 1rem label)
  rather than introducing a size variant.
- **Spotify** (`.bx-btn-sp`): solid Spotify green, near-black text; hover
  `#1ed760`.
- **Active (all variants):** `translateY(1px)` press feedback.
- **Transitions:** background, border, colour and transform all animate over
  160ms on `cubic-bezier(0.32, 0.72, 0, 1)`, the page's one easing curve.

### Cards / Containers
- **`.bx-panel`** — the generic raised block (tool cards, the tournament panel).
  0.75rem radius, raised fill, resting line-soft ring, `p-6 sm:p-7` internal
  padding. When the panel itself is a link, hover brightens the fill to raised-2
  and the ring to line, over 200ms. No lift and no shadow: a panel is not a tile.
- **`.bx-band`** — the full-bleed raised passage: raised fill, 1px line-soft top
  and bottom, no radius. It is a region of the page, not an object on it, and it
  is used exactly once, for Now Playing.
- **`.bx-card`** — the archive card wrapper. It carries no visual style of its
  own; it exists so focus can be mirrored. Its thumbnail link is `aria-hidden`
  with `tabIndex={-1}` (the title beside it is the real link), so
  `.bx-tile:focus-visible` can never fire there; `.bx-card:focus-within` applies
  the full tile gesture instead, and a keyboard visitor gets the same lift a
  pointer does.
- **`.bx-tile` (the signature gesture)** — every thumbnail-bearing surface: the
  stage, archive thumbnails, the Instagram grid, the hosts' photo. Raised fill,
  0.75rem radius, `overflow: hidden`, images `object-fit: cover` filling the tile
  edge to edge with no internal padding. One hover/focus treatment — lift 3px,
  ring brightens a step, `--bx-shadow` appears, the play mark goes opaque white
  and scales to 1.06 — applied identically everywhere, over 220ms, so the whole
  page has one gesture instead of scattered per-component effects. The lift and
  the scale are both dropped under `prefers-reduced-motion: reduce`; the ring and
  the shadow are not.
- **`.bx-stage`** — a tile modifier that changes only the radius (1rem) and
  enlarges the play mark. Used on the newest episode and on the episode page's
  player.
- **`.bx-plate`** — a `.bx-tile` modifier that swaps the raised fill for white
  and the image fit from `cover` to `contain`. For artwork drawn by somebody
  else for a white ground: gear photographs, tournament cover art. A `cover`
  crop of a brand's studio backdrop is not a product shot, and a transparent
  logo lockup on near-black is an empty rectangle. It keeps the tile gesture, so
  it lifts and rings like every other image on the site.

### Interior-page vocabulary
Named once in `globals.css` rather than respelled per route. The home page was
one composition and could afford inline strings; seven routes cannot.
- **`.bx-lead`** — the standfirst under an h1 or section heading. Body step,
  muted, 48ch.
- **`.bx-prose`** — multi-paragraph passages (the About page's story and
  argument). Body step at 1.7 line-height, 62ch, `1.125rem` gaps. `strong`
  inside it promotes to ink; that is the passage's only emphasis, and it stays
  inside the two-step ink scale rather than inventing a third tone.
- **`.bx-actionlink`** / **`.bx-quietlink`** — the two link registers. An action
  link is ink dropping to muted (the thing to do next); a quiet link is muted
  rising to ink (the way out of a section). Colour only, 200ms.
- **`.bx-arrow`** — One Arrow Behaviour, in one place: `translateX(2px)` on
  `.group:hover`, 200ms. Pair with Tailwind's `group` on the link.
- **`.bx-chip`** — a small factual chip in the metadata register but ringed and
  in ink: a discount code, a "tentative" flag. Something a visitor may copy or
  act on, which is why it is not muted. Brand orange stays out of it.
- **`.bx-field`** / **`.bx-label`** — form controls, on the Contact page only.
  See The Field-Rings-Step-Up Rule below.

### Signature Component: the play/duration pairing
- **`.bx-play`** — an authored SVG play glyph (never an icon-set import),
  absolutely centered on a tile, on a 92%-white disc with near-black ink. 3.25rem
  standard, 4.5rem on the stage; the glyph is 38% of the disc and nudged 6% right
  for optical centring.
- **`.bx-dur`** — the runtime chip, bottom-right of the tile, 78%-black fill,
  white Geist Mono with tabular numerals, 0.25rem radius. It is the only place
  an episode's runtime is printed; see the Fact-Appears-Once Rule.
- **`.bx-meta`** — the metadata line beneath a title (date, kicker, terms),
  Geist Mono, uppercase, 0.14em tracking, muted, tabular numerals.

### Navigation
The header is the global `SiteHeader`, styled from the site's brand tokens rather
than this system's: a fixed floating brand-orange pill with a `white/15` border
and the brand shadow, carrying the logo, wordmark and link row. Links are
`white/70` rising to white on hover over 300ms; the active route gets a
`white/12` pill behind it. No control of any kind sits in the bar. Below `sm`, an
in-flow orange identity strip plus a fixed corner button opening a Sheet panel
that grows from the same corner (`rounded-3xl`, near-black/95 with a backdrop
blur, staggered link entrance). That header and its Sheet render outside
`.bx-dark`, so the Portal-Escapes-The-Scope Rule does not apply to them; it still
applies to any portal the page itself opens. Link hover elsewhere on the page is
a colour shift only (muted ↔ ink over 200ms), no underline, no background.

### The Hero (signature, two-layout)
Wide screens run the banner as the section background with the h1 and CTAs laid
over it; narrow screens run the banner as an in-flow block with the copy beneath
it on the dark page ground. See Layout for the reasoning — the composition of the
source photograph, not a generic responsive simplification, drives the split.

## Do's and Don'ts

### Do:
- **Do** author every hover/focus effect on a thumbnail through `.bx-tile` (lift
  + ring + shadow + play-mark brighten) rather than inventing a one-off
  transition — this is the page's one shared gesture.
- **Do** mirror a tile's gesture from a wrapper's `:focus-within` whenever the
  tile itself is `aria-hidden` and the real link sits outside it, so keyboard and
  pointer get the same feedback.
- **Do** keep every `.bx-*` rule inside Tailwind's `components` layer. Unlayered
  CSS placed after `@import "tailwindcss"` outranks every layered utility — that
  broke `md:hidden` and `normal-case` mid-build. Any new `.bx-*` rule goes inside
  the existing `@layer components { … }` block, not appended outside it.
- **Do** repeat the `bx-dark` class on any portaled surface (Sheet, Dialog,
  popover, toast) opened from within `.bx-dark`.
- **Do** give a destination-brand button its own reasoned ink choice from a real
  contrast check against that platform's colour, rather than defaulting to the
  page's ink/bg pair.
- **Do** draw the page's own marks — the play glyph, the platform icons — as
  authored inline SVG, so their geometry and optical centring match the rest of
  the page's drawing.
- **Do** render a section as `null` when its data is empty (Archive, FreeTools,
  OnTheRoad, FromInstagram all do) rather than printing an empty-state
  placeholder.
- **Do** carry rank in all three channels at once — vertical air, heading step,
  and composition scale. Any one of them alone reads as an accident.

### Don't:
- **Don't** darken or otherwise alter brand orange (`#f26522`) to "fix" contrast
  — a confirmed brand commitment in PRODUCT.md. It is moot on `.bx-dark` surfaces
  anyway: orange on this ground clears 6.32:1, and the 3.15:1 problem the
  commitment describes is orange-on-white, which this look never does.
- **Don't** put a control on the pill nav, or brand orange on any button on this
  page — see The Chrome-Carries-No-Control Rule. The subscribe path wears YouTube
  red.
- **Don't** add a ring, hairline or fill step below the Visible-Step floor
  (1.4:1 for a line against the ground it sits on, 1.1:1 for a full-bleed fill).
  If it would not show on a phone in a bright room, it is not hierarchy.
- **Don't** add a third, fainter neutral tone beneath muted. The system has
  exactly two ink steps on purpose.
- **Don't** put a hairline on every section. Rules group; a rule between every
  pair of sections flattens the page into equals.
- **Don't** add a second band, or a second peak heading. Rank one is Now Playing,
  and the page has only one.
- **Don't** stack a mono metadata line above the heading it belongs to; that is
  an eyebrow regardless of how real the data is.
- **Don't** carry Broadcast Dark's `.bx-dark` scope, tokens, or components onto
  Booking Buddy, On Deck, or Pickle Point Pal, or vice versa — the four visual
  worlds are deliberately separate and none of them imports another's tokens.
- **Don't** clamp text on an element whose only child is a `.bx-actionlink`.
  That class is `inline-flex`, so `line-clamp-2` clamps one flex child instead
  of the text inside it — which is how episode titles ran to four lines in the
  catalogue grid. A clamped title takes a plain inline link.
- **Don't** put a `.bx-meta` line at the top of a card in a grid. Cards stretch
  to their row's height, so the metadata goes last with `mt-auto`, which is what
  lines every date in a row up on one baseline.
- **Don't** reach for the shadcn form primitives (`Input`, `Select`, `Field`)
  inside `.bx-dark`. They carry the light theme's semantic tokens as Tailwind
  *utilities*, which outrank anything this scope declares in the components
  layer, and `Select` portals its popup outside the scope on top of that. Use
  native elements with `.bx-field`; `color-scheme: dark` handles the dropdown.
