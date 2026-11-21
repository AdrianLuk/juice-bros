---
version: 1
slug: "src-app-tools-ddd"
primary_target: "src/app/tools/ddd"
related_targets: ["src/components/ddd","dink-dine-drink/CONTEXT.md"]
---

## Scope and mode

Dink Dine & Drink, every surface under `/tools/ddd`: Organizer sign-in and invite, the DDD list and setup, roster paste, Lineups, the 24-Spread grid, the Score Link, and the Public Link's phone and TV layouts, including the results page. Visitor mode **Operate** everywhere. Unlisted: link only, noindex, not on the Apps page or tools index.

DDD is its own world, outside the marketing site's Broadcast Dark scope, like Team Tally, Mic Drop and Match Mixer. Spec: GitHub #709; glossary `dink-dine-drink/CONTEXT.md`.

## Audience and job

The Juice Bros friend group on DDD day. By day at indoor courts under gym light: players enter final scores on their phones between Games and check where they play next; a TV by the courts shows standings. At night at the dine & drink venue, in dim light: everyone reads Final places, Punishments and shots owed. Organizers set up the roster, Lineups and Spreads beforehand at a desk.

## Constraints

- Openly a party (Adrian, 2026-11-21), but readable first: Adrian rejected the first Tab sketch as hard to read. Scores and shot counts read at a glance on a phone held at arm's length.
- Screens never say "Wave": Games are On now, Up next or Final, each with its court (Adrian, 2026-11-21).
- Say "shots", never "soju shots": the drink is whatever is poured (Adrian, 2026-11-21). Say "Spread", never "handicap".
- No em-dashes in DDD's own copy. Real names stay out of the public repo's demo data: PPA pros.

## Direction contract

**THESIS:** Every Team runs a bar tab all day. A Game missed against the Spread rings up as a line item on that Team's tab, the running total ticks, and at dinner the tab settles. Refuses both the sports-broadcast scoreboard (Team Tally's) and the neon party costume.

**OWN-WORLD:** Bottle green ground `#24563f` by day, deeper `#10241b` once the Playoff is final and on the results page. Every Team's tab is a white slip (`#fbfbf8`, ink `#111`) with a thin rule between line items; no cards, no rounded panels beyond a 3px corner. Stamp red `#d0342c` marks shots owed and the OPEN stamp; mint `#7fd6a4` stamps PAID; gold `#ffd166` is for Final place numbers only. Anton for Team names, totals and place numbers; Atkinson Hyperlegible for everything read or tapped; Courier Prime only for tiny stamps and slip headers (TAB 01, OPEN, PAID), never for data. Standard web controls, restyled.

**STORY:** A player opens the Score Link, sees what is on now on every court, enters a final in two taps, and watches the shots ring up on the losing Team's tab. At dinner everyone reads the settled tabs.

**FIRST VIEWPORT:** Score Link at 390 wide: Anton DDD title with date and round on the green; an On now strip of white court cards (court, Game, both Pairs, live score); then the viewer's Matchup as two Teams' tabs, one line per Game (Game, score, shots), the Spread line under each final Game, Up next Games dimmed, a running total under a heavy rule. Results: Final places 1 to 4 on deep green rows with gold numbers, each row's Punishment and shots and a PAID or OPEN stamp. Signature interaction: when a final is entered, the new line item prints onto the tab and the total ticks up; reduced motion cuts.

**FORM:** The Tab, Impeccable's pick (candidate 1 of 7), chosen over the roll's assignment (The Diner, candidate 7) and revised for legibility at Adrian's request. seed:6a7cc74d9e01e449, mode operate, code-led (no image generation). Decision page: https://claude.ai/artifact/Af2DHewBvRyrUuM93gypML (version 2).

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- The TV layout of the Public Link (4 tabs side by side, or standings plus On now) is decided in #715 to #717 inside this contract.
- The screen tickets (#711 to #718) build inside this contract; #721 runs the finish review and writes `dink-dine-drink/DESIGN.md`.
