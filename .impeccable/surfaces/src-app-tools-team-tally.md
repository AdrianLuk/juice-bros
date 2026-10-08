---
version: 1
slug: "src-app-tools-team-tally"
primary_target: "src/app/tools/team-tally"
related_targets: ["src/components/team-tally","team-tally/CONTEXT.md"]
---

## Scope and mode

Team Tally, every surface under `/tools/team-tally`: landing, sign-in, the Organizer's list, setup and the brief view (#622, #626), and later the Score Link (#623), the Flight hand-off (#624), the results page and the Public Link's phone and big-screen layouts (#625). Visitor mode **Operate** everywhere except the signed-out landing, which is **Persuade** inside the same world.

Team Tally is its own world, outside the marketing site's Broadcast Dark scope, like Match Mixer, Drum Roll and Pickle Point Pal. Spec: GitHub #621; glossary `team-tally/CONTEXT.md`.

## Audience and job

Rec players on a captained team night at an indoor club, under bright overhead gym light. Captains enter scores on their phones between games; everyone else glances at a lounge TV across the room. The Organizer builds the night beforehand at a desk.

## Constraints

- Indoor, bright light: a light ground, high-contrast ink, no glare-prone dark full screens on phones.
- Public repo: demo data uses PPA Tour names only.
- No em-dashes in Team Tally's own copy; the generated brief keeps the organizer's text verbatim.
- The TV must stay readable across a room with 14 Teams; more Teams cycle to another screen rather than shrinking.

## Direction contract

**THESIS:** Every number on a team night is a sports-TV graphic, read the way a golf broadcast reads its leaderboard: Matchups are score bugs, standings are a timing tower with R1, R2, R3 and TOT columns, and Flight cuts are bands across it. Refuses the SaaS dashboard of cards and tables.

**OWN-WORLD:** Cool white ground; deep navy plates carry every live number and nothing else; the brief's own red and blue mark the two sides of a Matchup as colour blocks inside a plate; ball yellow is reserved for "now" (the live Round, your own row) and never decorates. Sofia Sans Extra Condensed for numerals, team names and plate labels in tracked caps; Sofia Sans for everything read or tapped. FINAL stamps a finished Round or Matchup; scores never disappear. Standard web controls throughout, restyled in the world.

**STORY:** A captain sees their Matchup round by round, enters a score in two taps, and sees who entered it; the room sees the tower re-sort and who is about to drop a Flight.

**FIRST VIEWPORT:** Score Link: app bar, the Matchup's round-by-round bug (R1 R2 R3 TOT, live column underlined in yellow), the live Round's two Games with score inputs and the edited-by tag, then the tower slice with the Flight bands. TV: the leaderboard's spacing, a full-width tower split in two columns (Flights A to C, then D to G) with large type; Matchup score bugs live on their own screen, and the TV hard-cuts between screens, never scrolls. Signature interaction: the tower re-sorts with rows sliding to their new position and an up or down mark; reduced motion cuts to the new order.

**FORM:** The Broadcast package (candidate 5 of 7, the roll's assignment) fused with the structure of the Tournament leaderboard (candidate 1, the pick), chosen by Adrian over both parents and the standard. Seed key `fb8e9ead`, mode operate, code-led (no image generation). Type translated from the mockups' Archivo to the Sofia Sans family because Archivo is Match Mixer's face. Decision page: https://claude.ai/artifact/8EA7idomDZ2defc8RZK4Vz

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- The Score Link, Flight hand-off, results page and both Public Link layouts are built by #623 to #625 inside this contract; #625 ends with the finish review over every surface.
