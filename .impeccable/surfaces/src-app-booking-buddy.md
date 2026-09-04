---
version: 1
slug: "src-app-booking-buddy"
primary_target: "src/app/booking-buddy"
related_targets: []
---

# Booking Buddy — surface brief

## Scope & mode

The entire Booking Buddy app, redesigned into a new visual world (replace, not refine).
Signed-in app (~20 routes, ~60 components) is **Operate**. Pre-auth landing / sign-in /
join / privacy are **Persuade / Read** in the same world's register. Product truth,
copy, entities, routes, Supabase wiring, TanStack Query usage, and the two-tier nav IA
(ADR 0016) are all preserved; only the visual world changes.

## Audience & job

Rec / casual pickleball players (Juice Bros audience; includes 50s–60s, non-technical
friends). Job: resolve "are we playing this week, who's in, is the court booked" at a
glance instead of re-reading a group chat. Primary action: pin/post a game, or RSVP.
Proof: real entities — Games (Slots), venues (PicklePlex Downsview, Vaughan Pickleball),
Connections, Availability Windows, Bookings. No fabricated metrics/testimonials.

## Constraints

- Brand orange `#f26522` is locked and **must not be darkened** (PRODUCT.md). Here it is
  the single commit-action pin colour per screen, not a dominant field.
- Motion stays in BB's established restrained register — "warm & witty", not playful /
  gimmicky (memory: booking-buddy-delight-register).
- `.bb-theme` scoping stays; marketing site outside `/booking-buddy` untouched.
- White-on-orange chips/badges are an accepted contrast call — don't re-flag.
- Must not collide with On Deck's dark-arena "substitution board" world (`.od-arena`).

## Direction contract

THESIS: Booking Buddy is the well-kept rec-hall bulletin board for your crew — every game
a pinned card you read across the room. It refuses the Calendly grid-plus-sidebar
dashboard (what BB is today). The one grid it keeps — the week/month calendar and any
dense list — is a **sign-up sheet pinned to that board**, never a SaaS calendar.

OWN-WORLD: Cork ground, one subtle texture. Kraft / index-card stock, near-square corners
(2–4px), 0.5–1.5° rotation, one real pushpin, soft contact shadow. Masking-tape section
labels. Four fixed pin colours are a status **law** — green "you're in", red "needs you",
amber "maybe", cobalt "info" — printed on a legend that never tilts. Brand orange
`#f26522` undarkened is the single **commit pin** per screen; nothing else borrows it.
Yarn (SVG) links a person to their games / groups, taut on hover. Ruled tape regions keep
the board *kept* — tight alignment under the rotations. Display + card kickers in a
condensed poster/gothic face; body/UI in a sturdy humanist grotesque; a handwriting face
for pen marks (tallies, "FULL") only. All faces measured at build — never Inter, Geist,
or Space Grotesk. Sign-up-sheet sub-world: laminated cream, ruled day×time grid,
Special-Elite-flavoured masthead, penciled names = maybe, ballpoint blue = "you"
confirmed, red rubber-stamp = booked / FULL.

STORY: Open the board, this week is pinned up — next game front and centre with its RSVP
tally penned in, your availability strip, a red pin on anything needing you. One glance
tells you whether you're playing and whether you owe an answer. Act by pinning a new
card, pressing a pin to RSVP, or pulling a card to its detail.

FIRST VIEWPORT (signed-in dashboard, desktop): cork fills the viewport behind a slim
routed "COURTS" sign — the nav, section tabs, active tab orange-underlined. Top-left, a
masking-taped "This week" region: an orange-pinned "Pin a new game" card first in reading
order, then 1–3 game cards at slight angles — soonest largest, venue on a tape label, a
penned yes/no/maybe tally, a spots meter drawn as pushpin holes filling a row. A narrower
right region pins "Your availability" (a week strip, felt-tip looking/busy blocks) above
an "Upcoming courts" index-card stack. A fixed, never-tilting status key at the foot. The
"Calendar" tab swaps the This-week region for a full sign-up sheet pinned to the cork.
Named raises: COMMIT PIN (one orange action/screen, real :active press-travel) ·
CHANGED-SINCE-SEEN (a game whose time/court/roster moved holds an alert tint + "moved"
mark until viewed; cards reorder soonest-first without vanishing) · FLAP ON UPDATE (a
changed time or spot-count flips old→new in place) · ONE-MOTION CONFIRM (a bare "who's
in?" card becomes a confirmed game in one transition when a court attaches, no new
screen) · THE KEY NEVER TILTS.

Signature interaction: **pinning** — create/move a card = a pushpin press (card drops
~8px, rotates to rest, contact shadow lands, pin-head bounce); RSVP presses a colour pin
in and the tally pen-stroke draws on. One orchestrated board-load pins cards in reading
order (~60ms stagger) then stills. Reduced-motion: all at rest, pins set, no draw-on.

FORM: grounded candidate #7 of 7 (community-hall cork bulletin board); seed key
`861cf732`. Code-led — no image generation on this machine, so the comp round is skipped
by contract (new-work.md §5); ambition lives in this FIRST VIEWPORT block + the signature
interaction, audited by the finish reviewer in behavior. Two HTML concept mockups
(board + sign-up sheet dashboards) were shown to the user and ride to the finish review
as critique references (`scratchpad/shot-board.png`, `scratchpad/shot-sheet.png`).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Memorable moment

The board-load: the week's game cards pinning themselves onto the cork in reading order,
each with a weighted drop-and-settle, then perfectly still — you've walked up to the
board and it's all there.

## Unresolved

- Exact type faces (measured/chosen at build).
- Whether "sheet view" is a per-surface toggle on dense lists (Games, Bookings) or only
  the Calendar tab. Lean: toggle on the two long lists, default board.
- Cork texture: pure CSS vs one tiled raster patch (no generator — default to CSS).
- Landing-page (Persuade) composition — decided when that surface is built.
