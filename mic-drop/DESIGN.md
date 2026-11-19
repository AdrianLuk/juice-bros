---
name: Mic Drop
description: The chart. A karaoke night's Leaderboard set like a weekly music chart, big rank numerals and light bars on night ink, opened by a chart-coral field.
colors:
  ground: "#10131c"
  raised: "#161b27"
  mine: "#1a2030"
  line: "#1f2433"
  track: "#2a3042"
  ink: "#f4f1ea"
  mute: "#8c93a6"
  paper: "#f4f1ea"
  coral: "#ff5a36"
  on-coral: "#1a0b06"
  up: "#43e08a"
  down: "#ff8b7a"
typography:
  display:
    fontFamily: "Big Shoulders, Hanken Grotesk, ui-sans-serif, sans-serif"
    fontSize: "clamp(3.75rem, 19vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.85
    letterSpacing: "-0.01em"
  poll-name:
    fontFamily: "Big Shoulders, Hanken Grotesk, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.5rem, 11vw, 3.5rem)"
    fontWeight: 900
    lineHeight: 0.9
  headline:
    fontFamily: "Big Shoulders, Hanken Grotesk, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.25rem, 9vw, 3.25rem)"
    fontWeight: 900
    lineHeight: 0.92
  rank:
    fontFamily: "Big Shoulders, Hanken Grotesk, ui-sans-serif, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 900
    lineHeight: 0.9
    fontFeature: "tabular-nums"
  count:
    fontFamily: "Big Shoulders, Hanken Grotesk, ui-sans-serif, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tabular-nums"
  name:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.15
  lead:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums"
  meta:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
  movement:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.12em"
  chip:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    lineHeight: 1.4
rounded:
  control: "10px"
  frame: "28px"
  pill: "999px"
spacing:
  edge: "20px"
  edge-wide: "40px"
  rank-col: "52px"
  col-gap: "12px"
  host-gap: "32px"
  section: "56px"
  section-wide: "88px"
  column: "42rem"
  wrap: "72rem"
components:
  field:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    typography: "{typography.poll-name}"
    padding: "20px 20px 16px"
  field-final:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.on-coral}"
  chart-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.name}"
    padding: "11px 18px 12px 14px"
  chart-row-pressed:
    backgroundColor: "{colors.raised}"
  chart-row-mine:
    backgroundColor: "{colors.mine}"
  your-vote-chip:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  bar-track:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.pill}"
    height: "8px"
  bar-fill:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "8px"
  bar-fill-top:
    backgroundColor: "{colors.coral}"
  button-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    typography: "{typography.meta}"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
  remove-button:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    rounded: "{rounded.pill}"
    size: "44px"
  remove-button-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  footer:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.mute}"
    typography: "{typography.meta}"
    padding: "14px 20px 16px"
---

# Design System: Mic Drop

Scope: every route under `/tools/mic-drop`, through the `.md-surface` wrapper in `src/app/tools/mic-drop/layout.tsx`. Tokens and component rules live in `src/app/tools/mic-drop/mic-drop.css` and reach no other route. `SiteShell` lists the route in `DARK_EXCEPTIONS`, so the marketing site's Broadcast Dark never paints it, and `SiteChromeSlot` drops the site header, footer and floating menu button on every Mic Drop page, the Host's and the landing included. The two faces are loaded with `next/font/google` in `src/app/layout.tsx`: Big Shoulders (variable `--font-md-chart`, `opsz` axis on) and Hanken Grotesk (variable `--font-md`). Direction contract: `.impeccable/surfaces/src-app-tools-mic-drop.md`. Glossary: `mic-drop/CONTEXT.md`. Finish review: shipped (#683).

## Overview

**Creative North Star: "The Chart"**

The Leaderboard is set like a weekly music chart. Every Contestant is one full-width row: a big rank numeral with a movement mark under it, the name, the Vote count, and a thick light bar under the name scaled to the leader. When a Vote lands the chart re-sorts and each row slides to its new rank, and the marks say how far it moved. At the close the chart freezes and the No. 1 slot is read off it like the top of a countdown.

The room is dim and it is night, so the ground is night ink and no Guest phone shows a white field while voting is open. A solid chart-coral field opens every screen with the Poll's name and whether it is live; when the Poll closes that field turns paper white, the only white field in the world, and it means "final". Below the field there are no cards: rows sit on the ground divided by hairlines, the way a printed chart is ruled.

The personality is one move, not costume. Neon and themed props were tried for this world and rejected; showiness lives in the size of the numerals and the slide of a re-sort, and the names and counts stay plain enough to read with a drink in the other hand. Controls are standard web controls (buttons, text fields, links, `details`) restyled in the world.

**Key Characteristics:**
- Night ink ground with hairline-ruled rows and no cards.
- A chart-coral field opens every screen; it turns paper white when the Poll is closed.
- Big Shoulders caps for every rank numeral, count, Poll name and heading; Hanken Grotesk for names, prose and every control.
- Coral is rationed to the field, the No. 1 bar and your Vote.
- Green and salmon exist only in movement marks.
- The whole surface sets tabular numerals, so a count going from 9 to 10 never shifts its column.

## Colors

Night ink neutrals with one loud accent and two signal hues that are each bound to a single meaning.

### Primary
- **Chart Coral** (`coral`, #ff5a36): the header field behind the Poll name, the No. 1 row's bar, the "Your vote" chip, the 4px inset edge on your own row, and text selection. Text on it is **Coral Ink** (`on-coral`, #1a0b06), a near-black warm brown.

### Secondary
- **Up Green** (`up`, #43e08a): an up movement mark and a "New" mark. Nothing else.
- **Down Salmon** (`down`, #ff8b7a): a down movement mark. Nothing else, not even errors.

### Neutral
- **Night Ink** (`ground`, #10131c): the page ground, the sticky footer, and the document behind the surface (painted as a literal on `body:has(.md-surface)` so overscroll on a phone stays night).
- **Raised Night** (`raised`, #161b27): input fills, a row's pressed state, the remove control's hover, and the landing's closing Host band.
- **Your Row** (`mine`, #1a2030): the fill of the row you voted for, one step off the ground.
- **Hairline** (`line`, #1f2433): every rule between rows, under the No. 1 block, above the footer and between landing bands.
- **Track** (`track`, #2a3042): the bar's empty track, the input's border, the framed demo screen's border and the Guest Link's underline.
- **Paper** (`ink` / `paper`, #f4f1ea): primary text and the full bars on the ground; the closed field's fill; the primary button's fill; the focus outline. One value under two names because it plays two parts: text on night, and a surface.
- **Mute** (`mute`, #8c93a6): secondary text, labels, the unranked dash, the "no change" dash and the line-up's entry numbers. About 6.2:1 on the ground.

### Named Rules
**The Coral Is Rationed Rule.** Coral marks the field, the No. 1 bar and your Vote (chip and row edge), plus selection. It never fills a button, colours a link or marks an error. On the landing it appears only inside the demo chart, where the chart already uses it.

**The Movement Hues Rule.** Green means up or new, salmon means down, and neither appears anywhere else. A failed Vote, a refused tap or a Host's form problem is said in paper white at 700, never in salmon, because salmon on this chart means "down".

**The White Means Final Rule.** While a Poll is open, nothing on the Guest's screen is a white field. Paper white fills the header field only once the Poll is closed, and it reads as "Final chart".

## Typography

**Display Font:** Big Shoulders (fallback Hanken Grotesk, ui-sans-serif), loaded as `--font-md-chart` with its optical-size axis, exposed in CSS as `--md-chart`
**Body Font:** Hanken Grotesk (fallback ui-sans-serif, system-ui), loaded as `--font-md`

**Character:** Big Shoulders is a heavy condensed chart face; its optical sizes keep the big rank numerals tight and the small counts open. Hanken Grotesk is a plain, quick-reading grotesk for names and controls on a phone in a dim room.

### Hierarchy
- **Display** (900, clamp(3.75rem, 19vw, 6rem), 0.85, -0.01em, uppercase): the landing title "Mic Drop" only.
- **Poll Name** (900, clamp(2.5rem, 11vw, 3.5rem), 0.9, uppercase, balanced wrap, breaks anywhere): the field's heading, the Poll name on the Guest Link and the Host's Poll, "Your Polls" on the Host's list. Notice pages set their heading in the same voice at a fixed 2.6rem, 0.95.
- **Headline** (900, clamp(2.25rem, 9vw, 3.25rem), 0.92, uppercase): landing section heads.
- **Rank** (900, 2.1rem, 0.9): the chart's rank numerals. The closed No. 1 numeral steps up to clamp(3.25rem, 14vw, 4rem) at 0.8, the winner's name beside it to clamp(2rem, 9vw, 2.6rem) caps at 0.95, and the landing's step numbers sit at 2.75rem.
- **Count** (800, 1.6rem, 1, right-aligned): each row's Vote count. The Host's line-up sets it at 1.25rem.
- **Name** (Hanken 700, 1.125rem, 1.15, breaks anywhere): Contestant names on the chart and the line-up, and Poll names in the Host's list.
- **Lead** (400, 1.125rem, 1.5, max 34rem; 1.25rem from 1024px): the landing's standfirst.
- **Body** (400, 1rem, 1.5): notice pages and confirm copy (confirms at 600, 1.45). Landing body copy is mute at 1.55, max 40rem.
- **Meta** (700, 0.875rem): the field's meta line ("Live chart", phones in), the footer, problem lines, quiet links.
- **Movement** (800, 0.8125rem, 1, tabular): the number beside a movement triangle, and "NEW" in caps tracked 0.06em.
- **Label** (800, 0.75rem, 0.12em, uppercase, mute): form labels and the Host column's section headings ("Guest Link", "Line-up", "Last call").
- **Chip** (800, 0.6875rem): the "Your vote" chip. The Host list's Live/Final state uses the same size in caps tracked 0.08em.

### Named Rules
**The Two Faces Rule.** Big Shoulders caps for what the chart counts or announces (ranks, counts, the Poll name, headings, step numbers); Hanken Grotesk for what is read or tapped (names, prose, buttons, inputs, labels). A Contestant's name is never set in the chart face on a live row; only the closed No. 1 block sets winners in it.

**The Tabular Rule.** `.md-surface` sets `font-variant-numeric: tabular-nums`, and movement marks set it again, so counts and marks never jitter as they change.

## Layout

The field runs full width at every size; its padding (20px sides, safe-area aware) is the world's edge, and everything under it sits in one centred column of max 42rem with the same side padding, so the column's edge lines up with the Poll name. On a phone the column is the whole width.

A chart row is a three-column grid: a 52px rank column spanning both rows, the name (1fr), the count (auto), with the bar on the second row under name and count; 12px column gap, 7px row gap, padding 11px 18px 12px 14px. The closed No. 1 block uses the same 52px rank column so its numeral lines up with the rows below. Seven rows fit a 390-wide phone without scrolling. The footer is sticky to the bottom of the screen, on the ground, with a hairline above.

The Host's pages stack in that column with 32px between blocks: the Guest Link, the line-up, Add a Contestant (shown only while the Poll is open), Last call, then the way back. The line-up row is a 40px entry-number column, name, count, and a 44px remove column while open, with the bar under name and count.

The landing uses a wider wrap (max 72rem, 20px sides, 40px from 768px). Bands are separated by hairlines, sections pad 56px by 64px (88px by 96px from 768px). On a phone the demo runs edge to edge. From 1024px the hero splits into the pitch (1fr) and the demo (26rem) with a 72px gap, top-aligned so the pitch never moves when the demo grows on close; the house rules and questions split into a heading column (18rem) and the list.

### Named Rules
**The One Column Rule.** Under the field, every Mic Drop screen is one 42rem column aligned to the Poll name. No sidebars, no multi-column app layouts; only the signed-out landing goes wider.

## Elevation & Depth

Flat. Depth is tonal: raised night for inputs and pressed rows, a lighter night fill for your own row, hairlines for structure. There are two shadows in the whole world and neither is ambient decoration.

### Shadow Vocabulary
- **Your Vote edge** (`box-shadow: inset 4px 0 0 #ff5a36`): the left edge of the row you voted for, with the `mine` fill.
- **Demo frame** (`box-shadow: 0 40px 80px -32px rgb(0 0 0 / 0.7)`): the landing's demo from 1024px, framed as a phone screen with a 1px track border and 28px corners. Never on app screens.

### Named Rules
**The Ruled Not Raised Rule.** Rows, the No. 1 block and the line-up are divided by 1px hairlines on the ground. No cards and no lifted panels on any app screen.

## Shapes

Two shape families. Bars, buttons, chips and the remove control are full pills (999px). The text input rounds gently at 10px. Rows, the field and the footer are square-edged bands that run their container's width. The only larger radius is the landing's framed demo screen (28px). Borders are 1px hairlines throughout.

## Components

### Header field (PollField)
A full-width chart-coral band, coral ink text: the Poll name in Poll Name type, then a meta row with the live label on the left (an 8px current-colour dot, then "Live chart" on the Guest Link, "Live" on the Host's Poll, "Live demo" on the landing) and the phones-in count on the right. Closed, the band turns paper white, the dot goes, and the label reads "Final chart" (Guest) or "Final" (Host). A dropped connection or reads that keep failing swap the label for "Reconnecting…" with no dot, on the Guest's and the Host's screens, so stale counts never pass as live. The Host's Polls list opens on the same band ("Your Polls", "Mic Drop", Poll count).

### Chart row (signature)
Each Contestant is one button that fills the row: rank and movement mark, name, count, bar. Tapping casts your Vote, tapping another switches it, tapping your own takes it back. Your row takes the `mine` fill, the 4px coral inset edge and a coral "Your vote" pill chip after the name. Pressed, a row fills raised night (160ms ease-out). A Vote on its way dims the row to 60%. Once closed the rows are `aria-disabled` and stop responding to press.
- **Rank:** the numeral; tied rows share it as "=2". A row with no Votes has no rank yet: a mute en dash, and no movement mark under it.
- **Bar:** an 8px pill on the track, filled in paper white and scaled to the leader with `transform: scaleX` (450ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`). The No. 1 row's bar fills coral.

### Movement mark
Under the rank numeral. Up and down are authored SVG triangles (viewBox 10x8, drawn 10px by 8px, `currentColor`) followed by how many places moved at 13px, weight 800, tabular: Up Green pointing up, Down Salmon pointing down. A Contestant new to the chart reads "NEW" in green caps. No change is a short drawn dash, 12px by 2px in mute, not a typed character. Marks compare with the chart this page view last showed and hold until the next change; a reload starts every mark at no change. Each mark carries screen-reader words ("up 2", "new", "no change").

### No. 1 block
Only once the Poll is closed and only when someone has Votes. Sits under the field, on the chart's grid: the rank numeral "1" (or "=1" for joint winners) in the 52px rank column, the winner's name or names in chart-face caps beside it, and a mute line under them ("7 votes." or "4 votes each. Settle it with a sing-off."). No caption above the names. A hairline closes it, and the frozen chart follows.

### Footer
Sticky to the bottom, on night ink with a hairline above, meta type in mute with the lead phrase in paper at 700: "Tap a name to vote." while open with no pick, "Your vote: Ben Johns." once picked, "Voting's closed." once closed. A failed Vote, a refused tap or a removed pick replaces it in paper white at 700. It is the Guest's single live region.

### Buttons
- **Primary** (`md-btn`): paper white pill on night ink, ground-colour Hanken at 800, 48px high, 20px side padding, no wrap. One per block. Disabled at 60% opacity. Pending states name what is happening ("Starting…", "Adding…", "Removing…"); the close and reopen button labels its pending state by the direction of the write in flight ("Closing…" or "Reopening…"), so a close still settling never reads as a reopen when the live Poll flips first.
- **Quiet** (`md-quiet`): a mute underlined text button at 0.875rem, 700, 3px underline offset, for the second choice in a pair ("Not yet", "Keep them", "Start over") and the way back ("All your Polls", "Sign out").
- **Remove** (`md-remove`): a 44px round transparent button with an 18px X icon in mute, at the end of an open line-up row; hover fills raised night with paper icon.
- **Focus:** every focusable element in the surface takes a 2px paper outline at 2px offset; inputs pull the outline to 0 offset and turn their border paper.

### Inputs / Fields
Raised night fill, 1px track border, 10px corners, 48px high, 14px side padding, Hanken at 16px so a phone never zooms on focus; placeholder in mute. The label sits above in Label type. A field and its button share one wrapping row with a 10px gap. A problem shows under the field in paper white at 700, never salmon.

### Guest Link (Host)
A Label "Guest Link", then the full URL as one underlined line in paper at 600 (track-coloured underline) that truncates with an ellipsis and never widens the page, then the primary "Copy Guest Link" with a mute status beside it ("Paste it into the group chat."). Copying is the real action; the visible URL is for recognition.

### Line-up (Host)
The Host's Contestants in entry order, never re-sorted under the Host's thumb. Each row: a small mute "01" entry number in the chart face at 1rem (decimal-leading-zero, so it never reads as a rank), the name, the live count at 1.25rem, the remove control while open, and a paper-white bar under name and count. No coral on the Host's line-up: ranking is the Guest Link's job. Removing a Contestant always opens an in-row confirm first (the name, plus the lost Votes in plain words when there are any, a primary "Remove", a quiet "Keep them"), so a stray tap never removes anyone. The Add a Contestant form shows only while the Poll is open.

### Last call (Host)
While open: a Label "Last call" and a primary "Close the Poll", which opens an in-page confirm ("Close voting? The chart freezes and whoever leads takes No. 1. You can reopen it.") with "Close the Poll" and a quiet "Not yet". Closed: "Voting's closed", the No. 1 sentence in confirm type, and a primary "Reopen the Poll". Never `confirm()`.

### Polls list (Host)
Hairline-ruled link rows: the Poll name, then a mute meta line with a Live (paper) or Final (mute) state in tracked caps, the Contestant count and the start date, and a mute chevron at the right. Pressed rows fill raised night.

### Notice page
"No such Poll", "Can't host", sign-in and "Lost the connection" share one plain page: no field, a 34rem column, the heading in chart-face caps at 2.6rem, mute body at 1.5, and at most one primary button or the Google sign-in (max 22rem).

### Landing (signed out)
The app's world unchanged, wider. The title "Mic Drop" at Display, the lead, a mute "Free, and Guests just open a link.", "Try it: the demo room is already voting.", then the real `ChartView` on a made-up night that the visitor can tap, with a primary "Close voting" / "Reopen voting" and a quiet "Start over" under it and a mute note that it is a demo. Below, hairline-separated bands: "How a night runs" as numbered steps set like chart rows (2.75rem chart-face numeral in the 52px column, a Hanken 800 title, mute text; two across from 768px), "House rules" and "Questions" (native `details` with a mute chevron that turns 180deg in 200ms), and a raised-night Host band with Google sign-in. Demo names are PPA pros.

### Motion: the re-sort (signature interaction)
When the chart's order changes, each moved row slides from its old place to its new one (FLIP on `transform` via the Web Animations API, 450ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`), bars rescale on the same curve, and the movement marks update. Rows are measured after every commit but slide only on a real re-sort, so the No. 1 block appearing or a chip wrapping never animates. Under `prefers-reduced-motion` the slide is skipped and bar and row transitions are cut.

### Named Rules
**The Restyle Not Replace Rule.** Buttons, inputs, links and `details` stay native controls dressed in the world. No custom pickers, toggles or faux controls.

**The Rows Hold Still For The Host Rule.** The Host's line-up never moves; only the Guest's chart re-sorts.

## Do's and Don'ts

### Do:
- **Do** open every Mic Drop app screen on the full-width chart-coral field (#ff5a36) with the Poll name in Big Shoulders caps, and turn it paper white (#f4f1ea) only when the Poll is closed.
- **Do** set every Contestant as a full-width hairline-ruled row on night ink (#10131c): rank and movement mark, name, count, and an 8px light bar scaled to the leader.
- **Do** draw movement as the authored 10x8 SVG triangle in `currentColor` with the places at 13px tabular, and no change as a 12px mute dash.
- **Do** keep everything under the field in one 42rem column aligned with the Poll name.
- **Do** say failures and refusals in paper white at 700, in the footer on the Guest's screen and under the form on the Host's.
- **Do** make primary actions paper white pills (48px) and second choices quiet underlined mute text.
- **Do** cut the re-sort slide and bar transitions under reduced motion.

### Don't:
- **Don't** show a white field on a Guest's phone while the Poll is open.
- **Don't** use coral for buttons, links, errors or decoration; it marks the field, the No. 1 bar and your Vote.
- **Don't** use green or salmon outside movement marks, salmon least of all for errors.
- **Don't** put rows in cards or lift them with shadows; rows are ruled by hairlines.
- **Don't** type the movement arrows or the no-change dash as text characters.
- **Don't** let the Host's line-up re-sort or take coral; ranking is the Guest Link's job.
- **Don't** add an event or venue line above the Poll name, or a caption above the No. 1 names.
- **Don't** bring back neon, themed props or other karaoke costume; the personality is the chart.
