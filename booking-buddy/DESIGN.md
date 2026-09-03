---
name: Booking Buddy
description: The well-kept rec-hall bulletin board for your pickleball crew — every game a pinned card you read across the room.
colors:
  cork: "oklch(0.695 0.062 64)"
  cork-edge: "oklch(0.44 0.05 52)"
  kraft: "oklch(0.955 0.024 83)"
  laminate: "oklch(0.955 0.028 88)"
  ink: "oklch(0.23 0.022 52)"
  ink-on-cork-dim: "oklch(0.3 0.03 52)"
  muted-ink: "oklch(0.44 0.028 58)"
  rule: "oklch(0.8 0.03 78)"
  border: "oklch(0.8 0.032 74)"
  tape: "oklch(0.94 0.042 92 / 0.86)"
  tape-ink: "oklch(0.4 0.03 62)"
  sign-green: "oklch(0.33 0.045 152)"
  pin-in: "oklch(0.6 0.14 152)"
  pin-need: "oklch(0.57 0.2 28)"
  pin-maybe: "oklch(0.76 0.15 78)"
  pin-info: "oklch(0.52 0.15 256)"
  pin-commit: "#f26522"
  ink-pen: "oklch(0.4 0.13 262)"
  ink-pencil: "oklch(0.46 0.012 60)"
  marker-red: "oklch(0.5 0.19 28)"
typography:
  notice:
    fontFamily: "Anton, 'Arial Narrow', sans-serif"
    fontWeight: 400
    fontSize: "clamp(2.1rem, 6vw, 3.9rem)"
    lineHeight: 0.95
    letterSpacing: "0.09em"
  label:
    fontFamily: "Anton, 'Arial Narrow', sans-serif"
    fontWeight: 400
    fontSize: "0.7rem"
    lineHeight: 1
    letterSpacing: "0.13em"
  title:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontWeight: 600
    fontSize: "1.3rem"
    lineHeight: 1.05
  body:
    fontFamily: "Libre Franklin, system-ui, sans-serif"
    fontWeight: 400
    fontSize: "1rem"
    lineHeight: 1.5
  hand:
    fontFamily: "Caveat, ui-rounded, cursive"
    fontWeight: 700
    fontSize: "1.55rem"
    lineHeight: 1
rounded:
  card: "0.28rem"
  sheet: "3px"
  taped: "4px"
  pill: "9999px"
spacing:
  card-pad: "1rem"
  card-pad-lg: "1.25rem"
  region-gap: "1.5rem"
  section-y: "3.5rem"
components:
  button-commit:
    backgroundColor: "{colors.pin-commit}"
    textColor: "{colors.kraft}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "0 1.75rem"
    height: "3rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "0 1.5rem"
    height: "3rem"
  board-card:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "1rem"
  tape-label:
    backgroundColor: "{colors.tape}"
    textColor: "{colors.tape-ink}"
    typography: "{typography.label}"
    padding: "0.32rem 0.9rem 0.28rem"
  sign-up-sheet:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
  status-key:
    backgroundColor: "oklch(0.24 0.02 52 / 0.92)"
    textColor: "oklch(0.96 0.02 88)"
    typography: "{typography.label}"
    rounded: "{rounded.taped}"
    padding: "0.625rem 1rem"
---

# Design System: Booking Buddy

Scope: the `.bb-theme` world only (set in `src/app/booking-buddy/layout.tsx`). The Juice Bros marketing site and On Deck's `.od-arena` are separate worlds and are not governed by this file.

## Overview

**Creative North Star: "The Well-Kept Rec-Hall Bulletin Board"**

Booking Buddy is the cork board on the wall of a community pickleball hall, kept tidy by someone who cares. Every game is a real piece of kraft or index-card stock pinned up with one enamel pushpin, sitting at a slight opt-in angle over a warm contact shadow. You read the board across the room: the soonest game is the biggest card, a masking-tape strip names each area, and four pin colours carry a fixed status law so a first-timer can decode the wall without instruction. The build refuses the Calendly dashboard — no grid-plus-sidebar, no equal-weight panel matrix. The one grid the world keeps (the week/month calendar, any dense list) is redrawn as a laminated sign-up sheet pinned to that same board, ruled in pencil, never a Calendly panel.

The palette is entirely warm and physical: red-brown cork ground, kraft paper, forest-green routed signage, ballpoint blue and graphite for handwriting. Brand orange (`#f26522`, locked and never darkened) is rationed to exactly one commit pin per screen — the single action that matters. Type is three faces with hard-walled jobs: Anton screen-prints every notice, tape label and stamp; Libre Franklin (a Franklin Gothic-lineage municipal grotesque) does all headings, body, UI and table data; Caveat is pen marks only — RSVP tallies, "no court yet", "FULL".

Motion is one idea: pinning. A card arriving drops a few pixels, rotates to its resting angle and lands its shadow — a decelerate, deliberately no spring. The dashboard plays this once as an orchestrated board-load, then stills; every other surface cuts to rest. Reduced motion and no-JS get the board already pinned up.

**Key Characteristics:**
- Cork ground, kraft cards, one real pushpin, warm offset contact shadow — never a flat halo
- Near-square corners (0.28rem); rotation is opt-in, and the status key never tilts
- Four-colour pin law (green in / red needs-you / amber maybe / cobalt info) + one orange commit pin
- Three faces, walled: Anton = notice, Libre Franklin = workhorse, Caveat = handwriting only
- The only grid is a pinned laminated sign-up sheet, pencil-ruled
- One motion: the pin-drop; one orchestrated sequence, on the dashboard only

## Colors

A warm, physical, wood-shop palette — cork, kraft, laminate and signage green, with saturated enamel pins as the only bright notes.

### Primary
- **Commit Orange** (`#f26522`): the brand orange, locked and never darkened (PRODUCT.md). Used as exactly one pushpin per screen — the single decisive action (post a game, get started) — plus the routed nav underline and the active mobile-tab pin. Its rarity is the signal.

### Secondary
- **Signage Green** (`oklch(0.33 0.045 152)`): the routed park-sign stock the desktop nav hangs from — beveled, grounded, reads as a physical sign not a browser bar.

### Tertiary — the pin law
Four enamel colours, one fixed meaning each, printed on the status key that never tilts. Never repurpose one.
- **In Green** (`oklch(0.6 0.14 152)`): you're in / court booked / a filled capacity hole.
- **Needs-You Red** (`oklch(0.57 0.2 28)`): an item waiting on the viewer's response.
- **Maybe Amber** (`oklch(0.76 0.15 78)`): tentative / a bare proposal still gathering / no court yet.
- **Info Cobalt** (`oklch(0.52 0.15 256)`): informational, default pin, the sheet pin.

### Neutral
- **Cork** (`oklch(0.695 0.062 64)`): the ground every signed-in surface stands on — built from two SVG fractal-noise layers (fine flecks multiplied, coarse granule soft-light) plus a wall-frame vignette, over the warm red-brown. Also the pre-auth landing ground and the mobile theme-color.
- **Cork Edge** (`oklch(0.44 0.05 52)`): the darker board rim; mobile tab-strip top border, thin button outlines.
- **Kraft** (`oklch(0.955 0.024 83)`): card / popover / dialog stock — warm paper with a faint top-to-bottom sheen gradient.
- **Laminate** (`oklch(0.955 0.028 88)`): the sign-up sheet ground; slightly cooler and glossier than kraft, carries a diagonal sheen.
- **Ink** (`oklch(0.23 0.022 52)`): primary text on kraft.
- **Ink-on-Cork Dim** (`oklch(0.3 0.03 52)`): secondary text sitting directly on the cork ground (page descriptions).
- **Muted Ink** (`oklch(0.44 0.028 58)`): secondary text on kraft — deliberately held past WCAG AA on kraft for the older and non-technical friends this app onboards.
- **Rule** (`oklch(0.8 0.03 78)`) / **Border** (`oklch(0.8 0.032 74)`): pencil ruling on the sheet; hairline dividers.
- **Tape** (`oklch(0.94 0.042 92 / 0.86)`) on **Tape Ink** (`oklch(0.4 0.03 62)`): translucent masking-tape strips, board texture ghosting through.

### Handwriting inks
- **Pen Blue** (`oklch(0.4 0.13 262)`): ballpoint — "you", confirmed, booked. Also the caret colour app-wide.
- **Pencil Graphite** (`oklch(0.46 0.012 60)`): penciled / maybe / quick notes.
- **Marker Red** (`oklch(0.5 0.19 28)`): the rubber-stamp state — FULL / BOOKED / CONFIRMED, `mix-blend-mode: multiply`.

### Named Rules
**The One Commit Pin Rule.** Brand orange appears exactly once per screen, as the pushpin on the single most important action. If a second orange element wants in, one of them is not the commit — demote it to ink (`bg-foreground`) or a pin-law colour. Duration pickers and view toggles use ink, never orange.

**The Pin Law Rule.** The four pin colours mean exactly `in` / `needs-you` / `maybe` / `info` and nothing else, everywhere. The legend that teaches them (`StatusKey`) has exactly four entries and never tilts. Orange is an action cue, not a fifth law entry — it never appears in the key.

**The Dark Mode Is Dormant Rule.** A `.dark .bb-theme` token set exists but nothing ever activates it (no toggle, no `prefers-color-scheme` sync). Treat the light cork world as the only shipped surface; don't build against the dark tokens.

## Typography

**Notice Font:** Anton (with 'Arial Narrow' fallback) — `--font-bb-sign`
**Workhorse Font:** Libre Franklin (with system-ui) — `--font-bb-body`, the base `font-family` of the whole theme
**Handwriting Font:** Caveat (600/700) (with ui-rounded) — `--font-bb-hand`

**Character:** Anton is the screen-printed voice of a municipal notice — tall, tight, all-caps, always tracked out. Libre Franklin is its plain-spoken civil-servant partner: a humanist grotesque that carries every heading, every table cell, every button of running UI without drawing attention. Caveat is the pen someone actually picked up to write on the card.

### Hierarchy
- **Notice / Display** (Anton 400, `clamp(2.1rem, 6vw, 3.9rem)`, line-height 0.92–0.95, uppercase, tracking 0.09em): page titles (`bb-h` / `BbPageHeading`, no eyebrow), landing headlines, section headings. Titles ride masking tape or stand bare on cork.
- **Tape / Kicker Label** (Anton 400, 0.6–0.7rem, tracking 0.10–0.14em, uppercase): masking-tape section labels, venue tags, nav section labels, card date stamps, the status key.
- **Card Title** (Libre Franklin 600, 1.3rem regular / 1.7rem lead, line-height ~1.05): the game time on a `GameCard` — the soonest game's is largest. Note the running-title role is Libre Franklin, not Anton; Anton is reserved for the notice/label register.
- **Body** (Libre Franklin 400, 0.95–1.05rem, line-height 1.5, max ~65ch / `max-w-xl`): descriptions, help text, FAQ, form copy.
- **Handwriting** (Caveat 700, 0.95–1.55rem): RSVP tallies (count big, read beside it), "no court yet", "waiting on replies", short penned notes. The count is Pen Blue; penciled maybes are Graphite.
- **Stamp** (Anton 400, tracking 0.14em, uppercase, 2.5px marker-red box, rotated -8deg): FULL / BOOKED / CONFIRMED only.

### Named Rules
**The Three Faces, Walled Rule.** Anton = notices, tape labels, stamps, big numerals. Libre Franklin = everything that is read as information (headings, body, UI, table data). Caveat = handwritten content only — a tally, a "FULL", a scribbled note — never a label, never body copy, never a button. Geist never appears in this world.

**The No Eyebrow Rule.** Page headings carry no kicker/eyebrow — the routed nav sign already names the section. A short uppercase Anton line above a card title is allowed only as a literal date stamp (the day of a game), not as a category label.

## Layout

The signed-in app is a single scrollable board, not a panelled dashboard. `Board` lays the cork ground; content sits in `BoardRegion`s — dashed tape-outlined areas with a masking-tape label riding the top-left corner, holding their children in a `flex flex-wrap` run with `1.25–1.5rem` gaps so cards keep tight alignment under their individual rotations. Reading order is the layout: within a region the soonest / most important card comes first and largest (`lead` = ~19–21rem wide, `regular` = ~15.5rem).

Containers are centered (`mx-auto`) and capped at `max-w-6xl` for the nav and full board, `max-w-xl`/`max-w-lg` for prose and single-column CTAs. Horizontal page padding steps `1rem → 1.5rem → 2rem` (`px-4 sm:px-6 lg:px-8`); vertical section rhythm is `3.5rem` mobile, `5rem`+ desktop.

The dashboard is the full board: an Anton greeting, a taped "This week" region (orange-pinned "Pin a new game" leads, then `GameCard`s), a right column of pinned "Upcoming courts" and "Your availability" notes, a four-entry `StatusKey` strip, then the week calendar rendered as a pinned sign-up sheet. Interior section pages (Games, Availability, Find a time, Bookings, Friends, Groups, Facilities) are lighter: `BbPageHeading` + `BbSectionNav` on cork, then all content on one laminate `.bb-sheet` — flat pencil-ruled rows, `.bb-outline` empty states. Settings keeps per-section kraft cards.

Mobile drops the desktop park-sign for a fixed kraft bottom tab strip (`h-16`, safe-area padded); the board content pads its bottom to clear it. Dropdown menus on desktop render as small kraft cards pinned below the sign.

## Elevation & Depth

Depth is physical contact, not Material elevation. Every card and sheet casts the same warm two-part **contact shadow** — a tight offset drop plus a soft, wider, warm-tinted pool — reading as stock lying a few millimetres off a wall. There is no z-axis ramp of shadow tokens; a card is either on the board (contact shadow) or it is the board.

### Shadow Vocabulary
- **Contact shadow** (`box-shadow: 0 2px 4px oklch(0.32 0.04 45 / 0.32), 0 16px 30px -12px oklch(0.36 0.06 40 / 0.5)`, token `--bb-contact-shadow`): every `.bb-card`, `.bb-sheet`, dialog. The house shadow.
- **Card hover lift** (`0 4px 8px oklch(0.32 0.04 45 / 0.3), 0 22px 34px -14px oklch(0.4 0.06 40 / 0.5)` + `translateY(-2px) scale(1.008)`): interactive whole-card links only, 150ms; `:active` presses back to `scale(0.997)`.
- **Pushpin cast shadow** (`0 2px 3px oklch(0.2 0.03 40 / 0.5), inset 0 -1px 2px oklch(0 0 0 / 0.25)`): the enamel disc — one top-left highlight, one real cast shadow. Matte, never a glossy gumball.
- **Routed sign** (`inset 0 1px 0 oklch(1 0 0/0.14), inset 0 -2px 3px oklch(0 0 0/0.32), 0 10px 22px -12px oklch(0.3 0.06 150/0.65)`): the desktop nav bar only — a bevel that makes it a hung sign.
- **Tape** (`0 2px 7px oklch(0.3 0.03 45 / 0.22)`): a low, soft strip shadow.

### Named Rules
**The Contact-Not-Halo Rule.** Every shadow has vertical offset and a warm brown tint. A zero-offset even glow is forbidden — it breaks the "pinned to a wall" read. Depth = one object resting near another, never a floating card.

## Shapes

Near-square corners everywhere: `--radius` is `0.28rem` for cards, `3px` for the sign-up sheet, `4px` for taped things (regions, dialogs, the status key, `.bb-outline`). The only full-radius elements are the enamel pins, capacity holes and the nav underline pill. Nothing is soft or rounded-friendly; the corner language is "cut paper stock", not "app card".

Borders are used sparingly and always as a material cue: `2px dashed` translucent white for a taped-off `BoardRegion`, `2px dashed` faded ink for an empty-state `.bb-outline`, `1px` pencil `--bb-rule` between sheet rows, a thin `--bb-cork-edge` hairline on ghost buttons and the mobile tab strip. Solid heavy borders appear only on the rubber stamp (`2.5px` marker-red) and the `.bb-key`.

Rotation is a shape rule: `.bb-pinned` applies a small resting tilt (`-1.1deg`, with `+1.3deg` / `+0.5deg` variants cycling by position) — opt-in, so the board reads as *kept*. The status key and the sign-up sheet never rotate. Masking tape sits at `-1.3deg`; the stamp at `-8deg`.

## Components

### Buttons
- **Shape:** near-square (`rounded-sm` ≈ `0.28rem`), height `3rem`, Anton uppercase label, `tracking-widest`.
- **Commit (primary):** brand-orange context, carries a literal `.bb-pin--commit` orange pushpin at its top edge; `--bb-contact-shadow`; hover `-translate-y-0.5` (motion-reduce cancels). One per screen.
- **Ghost (secondary):** transparent, thin `--bb-cork-edge`/25 border, ink label, `px-6`.
- Duration pickers, calendar view toggles and other in-UI toggles use ink fills (`bg-foreground`), never orange.

### Pushpin (signature)
A matte enamel disc, ~`1.05rem`, absolutely positioned at the top edge (`top: -0.5rem`, centered) of whatever it pins. One soft top-left highlight, one dark cast shadow. Colour from the pin law via `bb-pin--{in,need,maybe,info,commit}`. Always carries an `aria-label` naming its status meaning.

### Board Cards
- **Corner:** `0.28rem`. **Background:** kraft with a faint sheen gradient.
- **Shadow:** the house contact shadow; `interactive` adds the hover lift + `:active` press.
- **Rotation:** `pinned` (default true) applies the resting tilt.
- **Pin:** one pushpin, colour = status; `pinLabel` overrides the SR word.
- **Padding:** `1rem` (`sm:1.25rem`).
- `pinInOnMount` plays the `bb-pin-drop` keyframe for a card added after load.

### GameCard
A board card for one game. Green `in` pin when a court is booked, amber `maybe` for a bare proposal. Anton date stamp, Libre Franklin 600 time (lead card largest), masking-tape venue label or penciled "no court yet", ballpoint-blue Caveat tally (`3 in · 1 maybe · full`), and a row of pushpin-hole dots for capacity (filled = In Green, empty = pressed-in hollow).

### Tape Label
Torn translucent masking-tape strip (mask-image feathered ends), Anton uppercase 0.13em, `-1.3deg`. Carries venue names, section headers, facility tags.

### Sign-up Sheet (the one grid)
`.bb-sheet` — laminate ground, `3px` corners, diagonal sheen, contact shadow. Remaps `--card` / `--border` / `--muted` for its whole subtree so nested calendar grids and list rows draw as pencil ruling on laminate, not kraft cards. `.bb-sheet-pin` adds a single cobalt pushpin at the top edge and does not rotate. Masthead in Anton with a double rule; legend reads "penciled = maybe · pen = booked". Booked courts are "penned in" — ballpoint-blue fill (week view) or blue tint with no side-border (month/agenda).

### Status Key
Dark near-black translucent strip, Anton uppercase, exactly four law entries with a small enamel dot each. `bar` variant = full-width dashboard footer; `inline` = quiet chip run on a page. `transform: none !important` — never tilts.

### Dialogs
A note taped up: `4px` corners, contact shadow, Anton uppercase title at `1rem` / 0.07em. Not a soft rounded sheet.

### Navigation
- **Desktop:** a routed forest-green park sign (`oklch(0.33 0.045 152)`), sticky, `max-w-6xl`, beveled shadow. Anton uppercase section labels at `0.82rem` / 0.14em; inactive labels are pale green, active is near-white with a `3px` brand-orange underline that slides between sections as a shared view-transition element (`bb-nav-pill`). Dropdowns are small pinned kraft cards.
- **Mobile:** fixed kraft bottom tab strip, `h-16`, `2px` cork-edge top border. Anton `0.6rem` labels, Lucide line icon per tab; the active tab is marked by a small orange pushpin dot that slides between tabs (`bb-tab-pill`) and an orange icon.
- **Section nav** (`BbSectionNav`): raised card-stock tabs; the active tab carries a small pin.

### Empty States
`.bb-outline` — a `2px` dashed faded-ink rectangle over a translucent kraft wash, `4px` corners: "where the first thing goes", a penciled outline waiting to be filled.

## Do's and Don'ts

### Do:
- **Do** stand every signed-in surface on `.bb-board` cork and put content on kraft `.bb-card`s or one `.bb-sheet`.
- **Do** give each card exactly one pushpin whose colour states its status per the four-colour law.
- **Do** spend the single orange commit pin on the one action that matters on that screen; make everything else ink or a law colour.
- **Do** lead a region with its most urgent/soonest item, largest — reading order is the layout.
- **Do** keep Anton for notices/labels/stamps, Libre Franklin for all read information, Caveat for handwritten marks only.
- **Do** cast the warm two-part contact shadow (`--bb-contact-shadow`) on anything "pinned up".
- **Do** render the calendar and dense lists as a pencil-ruled laminated sign-up sheet, pinned, unrotated.
- **Do** use near-square corners (`0.28rem` cards, `3–4px` sheets/taped things) and the opt-in `-1.1deg`-family tilt on posted cards only.
- **Do** keep the pin-drop as the only entrance motion — a decelerate with no spring — and only orchestrate it once, on the dashboard; reduced motion gets everything at rest.

### Don't:
- **Don't** build a Calendly grid-plus-sidebar or an equal-weight panel matrix — this world is a board, not a dashboard.
- **Don't** darken or recolour brand orange `#f26522`, and don't let a second orange element onto a screen.
- **Don't** add a fifth pin colour or reassign one of the four meanings; don't tilt the status key or the sign-up sheet.
- **Don't** use a zero-offset even glow or a Material elevation ramp — every shadow is offset and warm-tinted.
- **Don't** set body copy, labels or buttons in Caveat, and don't bring Geist into `.bb-theme`.
- **Don't** put a kicker/eyebrow above a page or section heading (a literal date stamp on a card is the only exception).
- **Don't** add spring physics, parallax, or a second authored page-load sequence — Operate-mode restraint holds outside the one board-load.

## Known Gaps (named in the direction, not built)

These are unbuilt scope, not defects — record them so a future surface knows they're intended, not invented:
- **Yarn** — SVG connective links from people to games/groups. Named in the direction's own-world; not built anywhere.
- **CHANGED-SINCE-SEEN** — an alert tint + "moved" mark on a game whose time/court/roster changed. Only CSS scaffolding (`.bb-flap`, a flap-on-update keyframe) exists; no wired behavior.
- **ONE-MOTION CONFIRM** — a bare proposal card visibly becoming a confirmed game in one transition. Named raise, `.bb-flap` scaffolding only.
- **Interior page recomposition** — Games / Availability / Bookings / Friends / Groups / Facilities carry the world's material and one board gesture (the pinned sheet) but were not rebuilt into full board vocabulary (regions, pinned cards, reading-order layout).
