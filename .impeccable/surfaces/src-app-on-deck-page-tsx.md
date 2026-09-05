---
version: 1
slug: "src-app-on-deck-page-tsx"
primary_target: "src/app/on-deck/page.tsx"
related_targets: ["on-deck/DESIGN.md","src/app/on-deck/sections","src/components/on-deck/arena-shell.tsx"]
---

# On Deck landing page (`/on-deck`)

Scope: the marketing landing at exactly `/on-deck` (`src/app/on-deck/page.tsx` and its
`sections/*`). Mode: Persuade — visitor is a club organizer deciding whether to bring On
Deck to their social.

Audience/job: an organizer who currently runs rotation off a paddle stack or a
volunteer's memory, evaluating whether On Deck is worth adopting. Action: understand the
mechanism, see the real differentiator (flexible Floor Mode — no volunteer required), and
reach the CTA to bring it to their club. Proof: the app's own live surfaces, not claims —
no fabricated metrics/testimonials (none exist yet per PRODUCT.md).

This redesign extends the already-established Arena Board world (documented in
`on-deck/DESIGN.md`) onto this landing page, which that file currently (incorrectly, as of
this brief) lists as out of scope / on the light shadcn marketing theme. That boundary
line in `on-deck/DESIGN.md` gets corrected once this ships — the landing joins the arena
system, the rest of the Juice Bros marketing site does not.

## Direction contract

THESIS: The page proves On Deck by putting its three real consoles — Player phone,
Volunteer floor, Kiosk/Display — side by side as one live Session, refusing the generic
single-screenshot-plus-bullets SaaS pitch.

OWN-WORLD: On Deck's own Arena Board system exactly as `on-deck/DESIGN.md` records it —
near-black `arena-bg` ground running continuously behind the header, bolted panels with a
lit top edge and offset+blur depth, Saira Condensed board type in uppercase, Geist Mono
tabular readouts, orange (`#f26522`, unaltered hex) reserved for LIVE only, cool
`arena-next` blue for imminent/on-deck, a numbered mono rail on queue lists, milled
physical keys with a hard bottom edge.

STORY: An organizer understands in one viewport that On Deck runs live across three
surfaces from one source of truth, sees the real problem it replaces, learns the Floor
Mode model (volunteer-run / self-serve / hybrid — never volunteer-required), and leaves
knowing how to bring it to their own club.

FIRST VIEWPORT: Full-bleed dark hero, arena ground behind the header, no card/max-width
shell. Three consoles side by side at desktop scale — Player phone verdict, Volunteer
floor panel, Kiosk/Display board — all reflecting the same Session (e.g. Court 5 turning
over live across all three), a mono readout line beneath reading "ONE SESSION. ONE
TRUTH." The primary CTA ("Bring On Deck to your club") sits in the hero, not buried below
the fold.

FORM: "Three Consoles, One Truth" — dealt index 4 of 7 grounded structural candidates,
seed key `07b980aa`, scope surface / mode persuade. Raise donated from the catalog
challenger `medium-native-algorave-source-floor` (declined on audience identification,
kept for its live-reacts-instantly discipline): the Floor Mode selector on the page
actually switches which console is lit vs. dimmed, so the differentiator is operated, not
just described.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Build path

Code-led: no image-generation tool is available in this harness/session, so there is no
comp round — the ambition above (FIRST VIEWPORT + the Floor Mode raise) is the contract
the finish review audits in behavior instead of against a rendered comp.

## Unresolved

- Exact copy for each section beyond the hero/consoles beat (problem statement, floor
  mode explainer, CTA line) is drafted during build in the existing site's brand voice
  (casual, rec-player, self-deprecating) — not yet locked.
