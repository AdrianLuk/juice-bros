---
name: Dink Dine & Drink
description: The Tab. Every Team runs a bar tab all day; white slips on bottle green, stamp red for shots owed, and at dinner the tab settles on deep green.
colors:
  green: "#24563f"
  deep: "#10241b"
  slip: "#fbfbf8"
  field: "#ffffff"
  ink: "#111111"
  ink-2: "#4a4f4c"
  rule: "#d9dbd5"
  on-green: "#ffffff"
  on-green-2: "#cfe3d7"
  red: "#d0342c"
  mint: "#7fd6a4"
  gold: "#ffd166"
typography:
  title:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "clamp(2.5rem, 11vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.01em"
  place:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "clamp(3rem, 9vw, 8rem)"
    fontWeight: 400
    lineHeight: 0.9
  place-team:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "clamp(1.75rem, 5vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.05
  seed:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1
  total:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1
  band:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.1
  score:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1
  team:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.1
  round:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums"
  strong:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.5
  note:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  stamp:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
  stamp-small:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  corner: "3px"
spacing:
  head-edge: "20px"
  main-edge: "16px"
  slip-pad: "20px"
  card-pad: "16px"
  stack: "14px"
  stack-lg: "20px"
  column: "40rem"
  results: "72rem"
  tv: "112rem"
components:
  slip:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
    padding: "20px"
  slip-head:
    textColor: "{colors.ink-2}"
    typography: "{typography.stamp}"
  court-card:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
    padding: "14px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-green}"
    typography: "{typography.strong}"
    rounded: "{rounded.corner}"
    padding: "0 20px"
    height: "48px"
  button-on-green:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
    height: "48px"
    width: "100%"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.strong}"
    height: "44px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.corner}"
    padding: "0 12px"
    height: "48px"
  chip:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
    padding: "0 16px"
    height: "44px"
  stamp-open:
    backgroundColor: "{colors.red}"
    textColor: "{colors.on-green}"
    typography: "{typography.stamp}"
    rounded: "{rounded.corner}"
  stamp-paid:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.corner}"
  result-shots:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.red}"
    rounded: "{rounded.corner}"
---

# Design System: Dink Dine & Drink

Scope: every route under `/tools/ddd`, through the `.ddd-surface` wrapper in `src/app/tools/ddd/layout.tsx`. Tokens and component rules live in `src/app/tools/ddd/ddd.css`, declared on `.ddd-surface`, and reach no other route. `SiteShell` lists the route in `DARK_EXCEPTIONS`, so the marketing site's Broadcast Dark never paints it, and `SiteChromeSlot` drops the site header, footer and floating menu button. The three faces load with `next/font/google` in the DDD layout itself, so only DDD's routes fetch them: Anton (`--font-ddd-display`, 400), Atkinson Hyperlegible (`--font-ddd`, 400 and 700) and Courier Prime (`--font-ddd-stamp`, 700). Direction contract and its settled Adaptations: `.impeccable/surfaces/src-app-tools-ddd.md`. Glossary: `dink-dine-drink/CONTEXT.md`. Finish review: #721.

The direction's FORM line names seed `6a7cc74d9e01e449`. That seed is uncorroborated: at the #721 finish review `concept-seed --check-seed` found no local roll record and no roll output was kept, so the world's reference is the decision page alone.

## Overview

**Creative North Star: "The Tab"**

Every Team runs a bar tab all day. A Game missed against the Spread rings up as a line item, the running total ticks, and at dinner the tab settles. The ground is bottle green, like the felt of a bar back or a beer bottle; everything read sits on a white slip with a thin rule between line items, the way a bar prints a tab. Stamp red marks what is owed. When the Playoff is final the ground goes deep green, the dinner light, and the settled tabs carry a PAID or OPEN stamp.

It is openly a party, but readable first. The first Tab sketch was rejected as hard to read, so the type does the work: Atkinson Hyperlegible for everything read or tapped, Anton only for names, totals, scores and place numbers, and Courier Prime only for small stamps and slip headers. Scores and shot counts read at arm's length on a phone under gym light and across a room on a venue TV.

The world refuses both the sports-broadcast scoreboard (Team Tally's) and neon party costume. No cards beyond the slip, no shadows, no rounded panels past a 3px corner. Controls are standard web controls (buttons, text fields, selects, `details`) restyled in ink on paper.

**Key Characteristics:**
- Bottle green ground by day; deep green once the Playoff is final and on the results.
- White slips with 1px rules between line items and a heavy 3px ink rule over a running total.
- Stamp red for shots owed, OPEN and refusals; mint for PAID; gold only for Final place numbers.
- Anton for names and numbers that count, Atkinson Hyperlegible for everything read or tapped, Courier Prime for stamps and slip headers.
- The whole surface sets tabular numerals.
- A new line item prints onto the tab and the total ticks; reduced motion cuts both.

## Colors

One green ground in two lights, paper and ink on top of it, and three signal colours each bound to one meaning.

### Primary
- **Bottle Green** (`green`): the ground of every screen by day, the overscroll behind it (painted as a literal on `body:has(.ddd-surface)`), the caret in fields, booked courts in the shared court grid, and the ink of Seed numerals, a won Dreambreaker's points, and the On now label.
- **Dinner Green** (`deep`): the ground once the Playoff is final (`.ddd-settled`) and on the results page, body included.

### Secondary
- **Stamp Red** (`red`): shots owed (the counts on a Matchup, a tab's total, a ledger line's "3 shots on ..."), the OPEN stamp, every problem and refused save (`.ddd-problem`, 700), the border of a destructive confirm, and the court grid's warnings. White text on the OPEN stamp.
- **Mint** (`mint`): the PAID stamp, with ink text, and text selection.
- **Gold** (`gold`): Final place numbers on the results. The shipped focus outline also uses it; see Components, Focus.

### Neutral
- **Slip** (`slip`): every tab, court card, form and notice; the "N shots" plate on the results; the full-width primary button when it sits directly on the green.
- **Field White** (`field`): inputs, selects, the paste box and chips, one step brighter than the slip they sit on.
- **Ink** (`ink`): all text on a slip, the 2px borders of controls, the primary button's fill, and the heavy rule over a total.
- **Slip Grey** (`ink-2`): secondary text on a slip (notes, Team under a Pair, slip headers, table heads, "by 2.5"). About 7:1 on the slip.
- **Rule** (`rule`): the 1px line between line items, Games, Seeds, roster rows and court lines.
- **On Green** (`on-green`): headings, facts and quiet links on the green. On the results the row rules are white at 20%.
- **Green Grey** (`on-green-2`): secondary text on the green (fact labels, "The Teams land here once ..."). About 6.5:1 on the green.

### Named Rules
**The Red Means Owed Rule.** Stamp red marks shots owed, OPEN, and anything refused or unresolved. On now is not red; it moved to bottle green so red keeps its meaning.

**The Red Sits On Paper Rule.** Red text appears on a slip, never directly on either green. On the results the shot count gets its own slip plate so the red still reads at dinner.

**The Gold Is For Places Rule.** Gold sets the Final place numbers 1 to 4 and nothing else in the palette's roles.

**The Paid Means Nothing Owed Rule.** Nobody records shots as drunk, so a settled tab stamps PAID at 0 shots and OPEN otherwise.

## Typography

**Display Font:** Anton (fallback Impact, sans-serif), one weight, always uppercase, exposed as `--ddd-display`
**Body Font:** Atkinson Hyperlegible (fallback ui-sans-serif, system-ui), 400 and 700
**Label/Mono Font:** Courier Prime 700 (fallback Courier New, monospace), exposed as `--ddd-stamp`

**Character:** Anton is a tall condensed poster face that makes a Team name or a shot count read across a room. Atkinson Hyperlegible was built for low-vision reading and carries every Pair, score line and control. Courier Prime is the bar's receipt printer, kept small and kept to labels.

### Hierarchy
- **Title** (Anton, clamp(2.5rem, 11vw, 3.75rem), 1, 0.01em, uppercase, breaks anywhere): the DDD name at the top of every screen; the screen name on screens with no DDD yet.
- **Place** (Anton, clamp(3rem, 9vw, 8rem), 0.9, gold): Final place numbers on the results.
- **Place Team** (Anton, clamp(1.75rem, 5vw, 4.5rem), 1.05, uppercase): the Team in each Final place.
- **Seed** (Anton, 2.25rem, 1, bottle green): the Seed or place number heading each tab row.
- **Total** (Anton, 2rem, 1): a tab's shot total. The results' count sets at 1.6em of its plate.
- **Band** (Anton, 1.75rem, 1.1, uppercase): section heads on the green ("Courts", "Round 2", "Final places") and the Team names atop a Matchup slip.
- **Score** (Anton, 1.75rem, 1): a Game's points, right-aligned beside each Pair.
- **Team** (Anton, 1.375rem to 1.625rem, 1.1, uppercase): Team names in a tab row and DDD names in the Organizer's list.
- **Round** (Atkinson 700, 1.25rem): the round the day is in, under the facts on the links.
- **Body** (Atkinson 400, 1.0625rem, 1.5, tabular): the surface default.
- **Strong** (Atkinson 700): Pairs, labels, buttons, outcomes, the ledger's Spread winner, problems.
- **Note** (Atkinson 400, 0.9375rem, slip grey): notes, the Team under a Pair, list meta, link status. The Team under a Pair sets at 0.875rem.
- **Stamp** (Courier Prime 700, 0.8125rem, 0.08em, uppercase): OPEN and PAID, slip headers (COURT 1, SHOTS SO FAR, SEEDING, LINEUP), a Game's status line.
- **Stamp Small** (Courier Prime 700, 0.75rem, 0.06em, uppercase): header fact labels (DATE, PLAY, DINE & DRINK), roster table heads, Pair legends, the On now / Up next labels on a court card, the Captain tag (0.6875rem, 1px ink border).

### Named Rules
**The Three Faces Rule.** Anton for what is counted or named big (Team names, totals, scores, Seed and place numbers, section heads). Atkinson Hyperlegible for everything read or tapped. Courier Prime for stamps, slip headers and header fact labels, never for data: a court name inside a status line drops back to Atkinson at 0.9375rem, and so does the round on the green.

**The Tabular Rule.** `.ddd-surface` sets `font-variant-numeric: tabular-nums`, so a total going from 9 to 10 never shifts its column.

## Layout

Phone first. The header sits on the green with 20px sides (safe-area aware) and 24px over the title; the body runs 16px sides and 56px clear at the bottom. Both centre one column of max 40rem. Inside it, blocks stack at 20px and slips' contents at 14 to 16px. A slip pads 20px; a Matchup, Dreambreaker or court card pads 14 to 16px.

On a phone the court strip runs tight (8px gaps, 10px by 12px card padding, Pairs at 0.875rem) so the first tab lands in the first screen. Court cards fill a grid of min 10rem columns, two across on a 390 phone. From 40rem, Pair slots and Dreambreakers go two across.

The results widen to 72rem, and the header widens with them so the title lines up over the places. Each place is a three-column row: number, Team and Punishment, then the shots plate with its stamp under it.

### Named Rules
**The TV Rule.** At 100rem (1600px) and wider the Public Link is one 1920x1080 screen nobody scrolls: a 112rem column, every court across the top in one row, then the tabs ("Shots so far", then "Final places") beside the Seeding in two columns. Before Round 2 there are no tabs, so the Dreambreakers sit beside the Seeding. A round's Matchups go two across. The roster and the Spreads stay on the phones and are hidden on the TV.

**The One Column Rule.** Below 100rem every DDD screen is one centred column: 40rem, or 72rem on the results.

## Elevation & Depth

Flat. No shadows anywhere. Depth is paper on felt: white slips on the green, and rules inside the slip for structure. Hierarchy inside a slip comes from rule weight (1px between line items, 3px ink over a total) and from dimming (Up next and later Games print at 72% opacity; the slip stays white).

### Named Rules
**The Paper On Felt Rule.** A slip is the only surface. No shadows, no lifted panels, no nested cards; inside a slip, line items are divided by rules.

## Shapes

One corner for everything: 3px, on slips, buttons, inputs, chips, stamps and the shots plate. Controls carry a 2px ink border; rules are 1px, and the total's rule is 3px ink. No pills, no circles, no larger radius.

## Components

### Slip (signature)
Slip white, ink text, 3px corner, no shadow, 20px padding. Opens with a slip header in Stamp type and slip grey when it needs one (COURT 1, SHOTS SO FAR, SEEDING). Line items inside are separated by 1px rules.

### Tab row ("Shots so far")
Each Team's own tab is its row in the "Shots so far" slip: the Seed or place number in bottle-green Anton, the Team name in Anton caps with a note under it, and on the right the total in red (Anton count plus "shots"). The total is the tap target, underlined at a 4px offset, and opens the Team's line items Game by Game under the row. Once the Playoff is final each total carries its PAID or OPEN stamp beneath it. No TAB 01 numbering: the Seed or place number already heads each tab.

### Matchup slip
One slip per Matchup, not two tabs: a Game belongs to both Teams, so it is scored once. The two Team names head it in Band type with a note under, then the outcome line (red while unresolved), then one Game per ruled row: a status line (Courier "FINAL", the court in Atkinson), each Pair at 700 with its Team under it in slip grey and its points in Anton on the right, the Spread line, then the ledger line. A 3px ink rule closes the slip over the running total, each Team's shots in red.

### Ledger line
Under each final Game: who beat the Spread (700, with the Team under it), "by 2.5" in slip grey, and the shots and on whom in red, right-aligned. When a final is entered the new ledger line prints onto the tab (clip from the top plus a 6px drop, 420ms, `cubic-bezier(0.2, 0.7, 0.2, 1)`) and the total ticks up (rises 40% and fades in, 360ms, same curve). Under `prefers-reduced-motion` neither runs.

### Game states
On now labels in bottle green. Up next and later print dim at 72% and take no form; "Enter its final" (a quiet button) opens one, since a court can run a Game early. A final can be corrected the same way. A refused save says so in red at 700 under the Game.

### Court card
A slip per court, 14px padding: the COURT header, then On now and Up next lines, each a Stamp Small label, the Game at 700 and both Pairs at 0.9375rem. The Up next line sits under a rule at 72%. An empty slot reads "Free" as a note.

### Stamps
OPEN and PAID: Courier Prime 700 caps at 0.8125rem, 0.08em, 3px corner, 0.15em by 0.5em padding. OPEN is red with white text, PAID is mint with ink. Filled, so they read on a slip and on the deep green alike. On the results they scale to clamp(0.8125rem, 1.4vw, 1.25rem).

### Final place row (results)
On the deep green, ruled by white at 20%: the gold place number, the Team in Place Team type with its Punishment at 700 under it, and on the right a slip plate with the red shot count (Anton at 1.6em plus "shots") over its stamp. Before the Playoff is decided, each place shows its name in green grey and what it will drink, with no plate.

### Buttons
- **Primary** (`ddd-btn`): ink fill, white Atkinson 700, 2px ink border, 3px corner, 48px tall, 20px sides. Disabled at 60%.
- **On the green:** a primary button sitting directly in the body column on the green turns slip white with ink text and runs full width.
- **Ghost** (`ddd-btn-ghost`): transparent with the 2px ink border and ink text, for a second action on a slip ("Invite an Organizer").
- **Quiet** (`ddd-quiet`): inherited colour, 700, underlined at a 3px offset, 44px tall: second choices, "Enter its final", "Correct the score", Remove, and links on the green.

### Chips
Field white, 2px ink border, 3px corner, 44px tall, 700 at 0.9375rem: the court-shape presets in setup.

### Inputs / Fields
Field white, 2px ink border, 3px corner, 48px tall, 12px sides, inherited Atkinson. The label sits above at 700, 6px gap. Score inputs set at 1.25rem in a two-up grid. Selects take a 14rem minimum outside the roster. A destructive confirm is a box with a 2px red border and 14px padding, its question at 700.

### Focus
Every focusable element takes a 3px outline at 2px offset. The shipped colour is gold, which reads on the green but measures about 1.35:1 against a slip, where most controls live. That colour is an open defect, not part of the system.

### Navigation
There is no nav bar. The header (title, then a definition list of Date, Play and Dine & drink with Stamp Small labels and Atkinson 700 values) opens every screen, with the round under it on the links and a quiet link to the results on the Public Link. Organizer pages also carry a back link above the title; its shipped treatment is not recorded as a rule (see the open defects).

### Named Rules
**The Restyle Not Replace Rule.** Buttons, inputs, selects, links and `details` stay native controls dressed as ink on paper. No custom pickers or faux controls.

**The Print And Tick Rule.** The one signature motion is a line item printing onto a tab and its total ticking. Nothing else animates.

## Do's and Don'ts

### Do:
- **Do** set every tab, court, form and notice on a slip (#fbfbf8, 3px corner, no shadow) on the bottle green (#24563f).
- **Do** turn the ground deep green (#10241b) once the Playoff is final and on the results.
- **Do** score each Game once, on its Matchup's slip, with its ledger line under it and a 3px ink rule over the running total.
- **Do** keep red (#d0342c) for shots owed, OPEN and refusals, and set it only on a slip.
- **Do** stamp PAID in mint at 0 shots and OPEN in red otherwise.
- **Do** dim Up next Games to 72% and give them "Enter its final" instead of a form.
- **Do** lay the Public Link out as one unscrolled screen from 100rem: courts across the top, tabs beside the Seeding.
- **Do** cut the print and tick under reduced motion.

### Don't:
- **Don't** set data (names, courts, rounds, scores) in Courier Prime; it is for stamps, slip headers and header fact labels.
- **Don't** put a line above the title or above a Matchup's Team names; the app name is the tab title, not a kicker.
- **Don't** use gold for anything but Final place numbers, or red for On now or decoration.
- **Don't** split a Game across two Team tabs, or number tabs TAB 01.
- **Don't** add shadows, pills, rounded panels past 3px, or cards inside a slip.
- **Don't** bring in Team Tally's broadcast scoreboard or neon party costume.
