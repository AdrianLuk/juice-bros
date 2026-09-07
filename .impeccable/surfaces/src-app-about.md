---
version: 1
slug: "src-app-about"
primary_target: "src/app/about"
related_targets: []
---

Scope: the About route (`/about`) only. Visitor mode: **Persuade**. The visual
world is fixed — Broadcast Dark, as recorded in DESIGN.md and pinned sitewide by
PRODUCT.md. This round changed composition, not identity: no new palette, type
ramp, component vocabulary, or control behaviour was introduced.

The six-route rollout brief (`src-app-podcast`) still governs everything About
shares with its siblings. What is here is About's own.

Proof on hand: episode one (`J6gvgo_RKfo`), the real first thing recorded; the
on-court photograph of both hosts; the published About copy, which PRODUCT.md
records as confirmed brand voice; `content/team.ts`, whose `bio` strings are
explicitly interim and whose `funFact` lines are real. Nothing invented, no copy
rewritten.

## What this round decided

Adrian asked for a redesign and chose "a new page in the same world" over both a
private visual world for About and a polish pass. Seven structures were ranked;
the seed dealt three (episode-led, a chaptered contents rail, a photo-led host
page) and he locked the episode-led lead after a recommendation round.

Two risk lines written into the decision material were corrected before the
choice: the home page's first viewport is the banner **photograph**, with Now
Playing below the fold. That makes the episode-led hero a genuinely different
opening from the home page's, and makes a full-bleed host photo here the move
that would actually have been repeated.

The flat-scroll problem the rail option existed to solve is handled inside this
direction by varying section composition and density, not by adding navigation
furniture to a Persuade page.

## Direction contract

THESIS: About opens on the show, not on an essay about the show. Episode one
plays in the first viewport and the origin story becomes its notes. It refuses
the category's About arrangement — a headline over empty space above a column of
same-shaped prose sections, which is what shipped here before.

OWN-WORLD: Unchanged Broadcast Dark. Near-black ground, one raised surface, the
three line steps, Geist at four heading ranks with Geist Mono for metadata only,
the single `.bx-tile` hover gesture, pill controls, orange confined to the nav,
focus ring and selection. `.bx-prose`, `.bx-lead`, `.bx-actionlink`, `.bx-panel`,
`.bx-band`, `.bx-stage` carry the page; no new token or component family.

STORY: A rec player arrives asking who these two are, hears them inside seconds,
reads how it started as the notes for what is playing, meets the mission on the
band, sees the two of them, recognises himself in the difference, and leaves via
Instagram or the contact form.

FIRST VIEWPORT: The floating orange pill on near-black. Below it a two-column
lock — episode one on a `.bx-stage` tile at 38rem on the left, the same width
as the home page's Now Playing so the site's one gesture is at its largest
here. Right column runs the `PageHead` order: the h1 ("Two friends who couldn't
stop talking about pickleball") at the display step, a `.bx-meta` line naming
the episode and its date, the standfirst, then two actions — a solid ink "Every
episode" and a YouTube-red "Subscribe on YouTube". Narrow, the stage runs first
at full width with the h1 beneath it.

The actions are an amendment, made at the finish review and recorded here
rather than left as a silent substitution. The contract first named a solid ink
"Play episode one"; the stage already is the play control, carrying the play
mark every thumbnail on the site wears, so a labelled pill repeating it gave
one action two affordances. The ink register moved to "Every episode", which is
the genuine next step from this page, and subscribing takes the platform colour
DESIGN.md reserves for it.

FORM: Category standard at full fidelity, composition rank 3 of 7 on the ranked
list, dealt lead. Seed key `0ef54dfa` (surface scope, persuade; degraded roll —
no network, so no catalog challengers and no quality-bar boards). Signature
interaction unchanged: the one tile lift/ring/shadow/play-mark gesture. Motion
grammar: short, eased, transform and opacity only.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Unresolved

- `content/team.ts` bios stay interim by Adrian's standing note; the layout must
  not depend on their length.
- No newsletter signup, per his 2026-09-06 call recorded in the rollout brief.
