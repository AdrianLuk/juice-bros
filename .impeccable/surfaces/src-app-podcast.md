---
version: 1
slug: "src-app-podcast"
primary_target: "src/app/podcast"
related_targets: ["src/app/gear","src/app/about","src/app/contact","src/app/tools","src/app/appearances","src/components/bx","src/components/layout/site-shell.tsx","src/components/layout/site-footer.tsx"]
---

Scope: the six marketing routes the home page's look was always meant to reach
— Podcast (`/podcast` and `/podcast/[slug]`), Tools (`/tools` and
`/tools/[slug]`), Gear, Appearances, About and Contact — plus the shared chrome
they forced out into the open. Visitor mode: **Persuade**, except Contact
(**Operate**) and the episode page (**Read**).

This is a rollout, not a direction round. "Broadcast Dark" was chosen by Adrian
in PR #399 from three rendered alternatives, after he took the standing exit on
four committed own-world directions across three rounds; the category standard
at full fidelity is a standing brand commitment in PRODUCT.md, and the craft bar
he set is podcast structure with SaaS finish. No new visual world was proposed
here and none should be — the work was to make six more routes belong to the one
already chosen, and to find where a system built for one page had not yet been
asked a real question.

Proof on hand: fourteen real published episodes; real gear with real ambassador
codes; four real upcoming tournaments with real brackets; the published About
copy (PRODUCT.md records it as confirmed brand voice, not draft) — every line of
which survives unchanged; the real host photo and Instagram accounts. Nothing
invented.

## What the rollout had to decide

Four questions the home page never had to answer, resolved inside the world
rather than by bending it:

1. **Where the ground lives.** The pill nav is `sticky` on interior routes, so
   it sits in flow above `<main>`; a `.bx-dark` class on each page left a bare
   light band across the top of every one of them. The scope moved to
   `SiteShell`, wrapping header, main and footer together, with
   `body:has(.bx-dark)` behind it for overscroll.
2. **Whether a panel can sit on the band.** It cannot — `.bx-panel` and
   `.bx-band` are the same fill, and stepping to `raised-2` buys 1.09:1, under
   the floor. Recorded as a rule. It is why the Appearances band holds the next
   tournament directly rather than a grid of cards.
3. **What a form looks like here.** The shadcn primitives carry the light
   theme's semantic tokens as Tailwind *utilities*, which outrank the scope's
   own layer, and `Select` portals outside the scope. Native elements with
   `.bx-field`, rings stepped up to line/line-2 because they sit on a panel.
4. **What white artwork does on near-black.** Gear photographs and tournament
   lockups are drawn for white grounds. `.bx-plate` — a `.bx-tile` that swaps
   the fill to white and the fit to `contain` — rather than a `cover` crop of
   another brand's studio backdrop.

## Deliberate departures from the incumbent, disclosed

- **The episode page now plays the episode.** It previously showed a still
  thumbnail and two outbound buttons, so every "Play <episode>" tile on the site
  delivered a picture of a play button. Same click-to-load approach, so
  YouTube's player JS still stays off the first paint.
- **Section order on About changed**: story, mission, hosts, difference,
  pillars, join in. The incumbent put the page's strongest sentence third and
  its proof fourth. No copy was rewritten.
- **About's hero is type, not the brand banner.** That banner is now the home
  page's hero; running it again would make a seven-page site look like it owns
  one image. The photographs appear where they prove something instead.
- **Podcast does not feature its newest episode**, though Appearances does
  feature its next tournament. A catalogue of fourteen peers loses more by
  promoting one card than it gains; a calendar has a time axis, and the next
  entry is the only one a visitor can act on.
- **Contact runs the site's 72rem measure**, not a narrow centred column, with
  the Instagram alternative filling the space the form does not need.

Unresolved / left alone: no newsletter signup — Adrian's call on 2026-09-06,
against CLAUDE.md's standing wish for one, because audience growth on
YouTube/Spotify is the stated success metric, a second capture ask on every page
splits it, and there is no publication to post a form to. Bricolage is still
loaded in `layout.tsx` and is now unused by the marketing site; whether it can
be dropped depends on the three app worlds, so it was not touched here.

## Direction contract

THESIS: One site, one look. The home page proved the world; these six routes
prove it is a system rather than a hero page — the same ground, the same single
tile gesture, the same four-rank heading ladder and the same two link registers,
carrying six different jobs without any of them needing a new idea.

OWN-WORLD: Unchanged from PR #399, plus what six routes needed and one page did
not: `.bx-lead`, `.bx-prose`, `.bx-actionlink`, `.bx-quietlink`, `.bx-arrow`,
`.bx-chip`, `.bx-plate`, `.bx-field`, `.bx-label`, and Instagram as the third
destination colour (two call sites, never the footer).

STORY: A visitor arrives anywhere — a search result for a paddle, a link to one
episode, the nav — and lands somewhere that answers the question they actually
asked, in the same room as everywhere else, with the episodes and the subscribe
path never more than one move away.

FIRST VIEWPORT (interior routes): the floating orange pill on the near-black
ground, then an h1 that is a sentence rather than the nav label repeated, its
metadata line, its standfirst, and — where the page has one — its actions. Never
an eyebrow.

FORM: Category standard at full fidelity. Signature interaction unchanged: one
hover/focus treatment on every image-bearing surface, now including gear plates
and tournament art. Motion grammar: short, eased, transform and opacity only.

FINISH: `next build`, `npm run lint`, `npm test` 978/978, the mechanical
detector with no non-advisory findings, a batched screenshot round at 1440 and
390 across all seven routes plus both detail routes, a second round confirming
the fixes, and a check that the three app worlds and the two Booking Buddy
flows outside the scope are untouched.
