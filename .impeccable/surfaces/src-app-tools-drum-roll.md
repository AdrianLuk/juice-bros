---
version: 1
slug: "src-app-tools-drum-roll"
primary_target: "src/app/tools/drum-roll"
related_targets: ["src/components/apps/drum-roll"]
---

## Scope and mode

Drum Roll's screens at `/tools/drum-roll`. Visitor mode **Operate**: a friend group is
standing around one phone and somebody has to draw a name.

Drum Roll is its own visual world, outside the marketing site's Broadcast Dark scope, the
same way Booking Buddy, On Deck, Pickle Point Pal and Match Mixer are. The route goes in
`SiteShell`'s `DARK_EXCEPTIONS`.

## Audience and job

A rec-level friend group, four to twenty people, drawing prizes at somebody's place or
after a session. The job: get names in fast, let everyone see the odds are what they were
told, draw, and have the room believe the result. Not a club gala and not a fundraiser
with a compere.

## Constraints

- **Two shapes only** (decided 2026-09-14 with Adrian): a ticketed prize raffle, and a
  plain pick-one-name draw with no prize and no tickets. Pick-a-few and shuffle/random
  order were explicitly declined — do not build them.
- **The prize is not a precondition.** The old build refused to open the Draw screen until
  a prize existed, which made the pick-one case impossible. Prizes are an upgrade.
- Engine is untouched: the append-only `RaffleEvent` log, `reduceRaffle`, undo-by-drop,
  `pickWinner`'s cumulative weighted walk, the seed committed before the draw, and
  localStorage persistence all stay exactly as they are.
- Legibility outranks expression here, stated by Adrian on the direction round: the job is
  one name read fast off a phone held up in a room. No fixed-pitch body text, no tracked
  caps carrying content, no script faces for names or data.

## Direction contract

**THESIS:** The wheel, built like equipment instead of a widget. Refuses the flat
conic-gradient wheel with a modal, and refuses the SaaS tool page that buries the odds
behind a ticket count.

**OWN-WORLD:** A quiet warm-white hall ground carrying one heavy object. The wheel has
real geometry: a machined hub, a sprung flapper, wedge widths proportional to tickets, and
a controlled palette stepped from brand orange. Everything else — roster, prizes, controls
— is large flat type on the ground with hairline rules and no cards. Brand orange is
reserved for the pointer and the landed wedge.

**STORY:** The organiser pastes names, sees the odds as wedge widths, reads the seed out,
spins, and the room reads one name off the wheel.

**FIRST VIEWPORT:** The wheel centred and as large as the viewport allows, pointer at top.
One line beneath it carries the bucket count and the committed seed. The SPIN key sits
under that. Roster below the fold as a plain list. On mobile the wheel is the whole screen.

**FORM:** The wheel — the category's signature device, user-pinned over the roll's
assignment (candidate 4, the lottery terminal) and over all five alternates, after Adrian
rejected the assigned card on legibility. Seed key `ffed24ea`, mode operate, code-led.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment

The spin: real spin-up, the flapper ticking across every segment edge, deceleration that
can still change the answer at a boundary, and the landed wedge lifting and holding.
Reduced motion resolves straight to the landed state.

## Unresolved

- Whether the wheel or the roster leads on very wide desktop. Decided at the responsive
  pass, not before.
- Sound. A flapper that ticks silently is half the object, but nothing else on the site
  makes noise. Not designed; ask before adding.
