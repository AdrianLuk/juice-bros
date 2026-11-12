---
version: 1
slug: "src-app-tools-mic-drop"
primary_target: "src/app/tools/mic-drop"
related_targets: ["mic-drop/CONTEXT.md"]
---

## Scope and mode

Mic Drop, every surface under `/tools/mic-drop`: the Guest's vote and Leaderboard screen (the Guest Link), the Host's Poll list, the Host's Poll editor, and the not-allowed state: visitor mode **Operate**. The signed-out landing at `/tools/mic-drop` (Adrian asked for one on 2026-11-11, to show friends a preview) is **Persuade**. Still unlisted: not on the Tools page, kept out of search.

Mic Drop is its own world, outside the marketing site's Broadcast Dark scope, like Team Tally, Match Mixer and Drum Roll. The route goes in `SiteShell`'s `DARK_EXCEPTIONS`. Spec: GitHub #666; glossary `mic-drop/CONTEXT.md`.

## Audience and job

Rec players at a karaoke night after dinner, in a dim room, voting from their own phones with a drink in the other hand. Guests glance at the Leaderboard between songs; the Host sets the Poll up beforehand and closes it at the end.

## Constraints

- Dim room at night: dark ground, no white full screens on the Guest phone while voting is open.
- Showy but readable (Adrian, 2026-11-11): names and counts read at a glance; personality lives in one move, not costume. Neon and themed props were tried and rejected.
- Every count has a light bar beside it (Adrian's ask). Bars scale to the leader.
- The Poll has one text field, its name. The header shows only that name: no event or venue line above it (Adrian, 2026-11-11).
- No em-dashes in Mic Drop's own copy. Demo names are PPA pros.

## Direction contract

**THESIS:** The Leaderboard is set like a weekly music chart: big rank numbers, a movement mark under each, a thick light bar under every name. Refuses both the costumed night-out world and the grey-card live poll.

**OWN-WORLD:** Night ink ground `#10131c`, rows divided by hairlines, no cards. A solid chart-coral field (`#ff5a36`) carries the Poll name and live state; on close it turns paper white (`#f4f1ea`). Elsewhere coral marks only the No. 1 bar and your Vote. Bars are paper white on a `#2a3042` track. Green and salmon appear only in movement marks. Big Shoulders Display (heavy, caps) for rank numbers, counts and the Poll name; Hanken Grotesk for names and every control. Standard web controls, restyled.

**STORY:** A Guest finds their singer, taps once, sees the chart re-sort and how far each row moved. At the close they read the No. 1 slot.

**FIRST VIEWPORT:** Guest at 390 wide: coral field with the Poll name, "Live chart" and phones-in count; then every Contestant as a full-width tap row (rank and movement mark, name, count, bar), highest first, seven without scrolling; your pick gets a coral edge and a "Your vote" chip. Closed: white field reading "Final chart", a No. 1 block naming the winner or joint winners, the frozen chart below; no block with zero Votes. Signature interaction: on re-sort rows slide to their new rank and the marks update; reduced motion cuts.

**FORM:** The Chart, candidate 1 of 2 in a safer-register hand (round 3, after two re-rolls), chosen by Adrian. seed:6fdcb67352c7ea99, mode operate, code-led. Decision page: https://claude.ai/artifact/AfLqyv2N9XN5SwhkSZksMn (version 3).

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Settled in the Guest screen (#669)

- Movement marks compare with the Leaderboard this page view last showed and hold until the next change. A reload starts fresh, with every mark at "no change".
- Tied rows share a rank, shown as "=2". A row with no Votes has no rank yet: a dash, and no movement mark under it (a second dash for "no change" was noise).
- The Guest Link drops the site header and footer, so the coral field opens the screen. On wide screens the chart sits in a centred column of 42rem; the field stays full width.
- A failed Vote or refusal shows in the footer in white, bold. Salmon stays for "down" marks only.
- The closed No. 1 block names its winner by the chart's own rank numeral, "1" or "=1" for joint winners, in the rows' rank column; no caption above the names (finish review on the landing, #680, Adrian 2026-11-11).

## Settled in the Host screens (#668)

- Every Mic Drop page drops the site header, footer and floating menu button, the Host's included: the site's orange header stacked on the coral field read as two clashing oranges, and the menu button covered the Add button on a phone.
- The Host's pages open on the same coral field ("Your Polls", or the Poll's name with Live or Final), then one 42rem column padded like the field so its edge lines up with the name.
- Primary buttons are paper white pills on night ink; coral stays reserved. Inputs are raised night with a track-colored hairline, 16px text so a phone doesn't zoom.
- The line-up numbers rows in entry order with small muted "01", so it never reads as a rank.
- Signed out, and an account off the allowlist, get the plain notice page used for "No such Poll".

## Settled in the live Leaderboard (#670)

- The Host's line-up stays in entry order and carries each Contestant's live count and bar, all paper white; "N phones in" sits in the field. Rows never move under the Host's thumb, and the ranked chart stays the Guest Link's job (Adrian, 2026-11-11).
- A dropped connection, or reads that keep failing, swaps the field's live label for "Reconnecting…" with no dot, on the Guest's screen and the Host's.

## Landing contract (signed out, Persuade)

**THESIS:** The pitch is the product running. A made-up karaoke night's chart sits in the first viewport and takes taps, while a made-up room votes around the visitor. Refuses the screenshot-and-feature-grid tool page.

**OWN-WORLD:** The app's world unchanged: night ink ground, paper type, Big Shoulders caps for the title, headings and step numbers, Hanken Grotesk for everything else, hairline rows, no cards. Coral appears only inside the demo chart, where the chart already uses it.

**STORY:** A friend opens the link, sees MIC DROP and one sentence, taps a name, watches the chart re-sort and their pick move, closes voting to see No. 1, then reads how a night runs, the house rules and the questions. A Host signs in at the bottom.

**FIRST VIEWPORT:** Phone: the title at display size, the lead, the free/no-install line, "Try it", then the demo edge to edge, its coral field and first rows on screen. Desktop: the pitch left, the demo right as a framed phone-width screen with Close voting and Start over under it.

**FORM:** Pinned by Adrian: the sibling tools' landing pattern (Team Tally's: a real component on made-up data, how it runs, rules, questions, a closing action) plus a tap demo. seed: none (roll skipped: Adrian pinned the form)

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Remove per row and the two-step Close the Poll arrive with #671, inside this contract.
- The screen tickets (#668 to #671) build inside this contract; the last one ends with the finish review and DESIGN.md.
