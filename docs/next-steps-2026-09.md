# Next steps: Booking Buddy, On Deck, Round Robin Generator

Status: planning input, not committed scope. Written 2026-09-04. Third pass 2026-09-12
(shipped rows became pointers; their decisions live in ADRs, CONTEXT files and code
comments, and this doc says where instead of restating them — see **Shipped, and where it
went**).

**Fourth and fifth passes, 2026-09-12.** The fourth recorded that tonight is TO Pickleball
Club's last night, which removed the premise the On Deck half of this doc rested on — "the
retro, then two or three more real sessions" — and moved the gate from OD-0 to OD-6.

**The fifth goes further, and it is the one that set the current shape.** The club is not
using the app tonight. There is no first session, no retro, no real event log, no Session
Summary, and no photographs of On Deck in a room. **OD-0 does not happen, and cannot be
made to happen by us.** On Deck is a feature-complete v1 that has never been used by
anyone and has no path to a first user except a stranger. Every consequence below follows
from that, and the doc no longer pretends otherwise.

**Sixth pass, 2026-09-18, and it is the one to read now.** OD-6 shipped — the whole of it,
eleven tickets across four days (#512, tickets #514 to #524). A stranger can now open a
demo night, watch it fold, create a Club in two fields, and be told the two things to do
before Saturday, without speaking to anyone. **The front door exists.** Three things follow
and the table below is rewritten around them:

- **The doc is no longer the authority on OD-6.** The 2026-09-14 grilling session reopened
  things this doc had settled and settled things it had left open, and #512 is the record
  of that. Co-owners are cut, the one-release rule is gone, and the target user narrowed
  from "a stranger" to "an informal organizer running a Saturday social out of a group
  chat." Where this doc and #512 disagree, **#512 is later.** The OD-6 section is now a
  pointer.
- **The release has not happened.** #512's own words: *"the release is the day we start
  pointing people at On Deck, not a deploy."* Everything is deployed and nobody has been
  told. The six funnel counters went live today and are currently measuring zero of
  nothing. That is the new row 6, and it is the cheapest row this doc has ever carried.
- **OD-0′ is now reachable rather than hypothetical.** It stops being "blocked on a
  stranger's choice" and becomes "blocked on a stranger hearing about it," which is a thing
  we control the first half of.

**Eighth pass, 2026-09-24.** RR-6 shipped, all three tickets inside a day of the grill
(#392; #552, #553, #554). Row 6 is done and **BB-1 is the first unstarted row**, which is
also the one outstanding pick from the month's original three. Nothing else in the table
moves. RR-2 is no longer waiting on a shape; the Schedule it builds on is now a list of
pools, and that adds one question to its section.

This doc is the raw material for the grill → spec → tickets → build pipeline. It is
deliberately opinionated so there is something to push against. Nothing here is settled
until it survives a grilling session.

Companions: [booking-buddy/docs/differentiation-roadmap.md](../booking-buddy/docs/differentiation-roadmap.md),
[booking-buddy/docs/profiles-and-loop-roadmap.md](../booking-buddy/docs/profiles-and-loop-roadmap.md),
[briefs/juice-bros-round-robin-brief.md](../briefs/juice-bros-round-robin-brief.md),
[on-deck/CONTEXT.md](../on-deck/CONTEXT.md), [PRODUCT.md](../PRODUCT.md).

---

## How to use this doc

One initiative at a time. For each:

1. `/grilling` (or `/grill-with-docs` when the initiative needs a new glossary term or an
   ADR, flagged per initiative below). Paste the initiative's section as the opening
   context. The **Already decided** list is off the table unless the grill finds a
   contradiction. The **Open questions** are the first frontier; the recommended answers
   are a starting position, not the answer.
2. `/to-spec` once the frontier is empty. It publishes to GitHub Issues with
   `ready-for-agent`.
3. `/to-tickets` against that issue. Vertical slices, blocking edges, one branch + PR per
   ticket, built in a worktree (see CLAUDE.md git rules).
4. Build. Screenshots in the PR for anything with a UI surface.

Sizes: **S** half a day, **M** one to two days, **L** three to five days, **XL** a week or
more. All assume a solo dev with agent help.

### Suggested interleave across the three apps

Sixth pass, 2026-09-18. **Rows 1 through 5 are all shipped**, which is the first time this
table has been clean to the bottom of its build items. The fifth pass's question — *what
gets a complete stranger to run a night on software nobody has ever run a night on* — has
a built answer sitting in production that no stranger has seen. So the ordering question
changes one more time, and gets smaller: **what tells anyone it is there.** That is row 6,
it is an afternoon, it needs no venue and no favour, and every OD row below it stays
exactly where the fifth pass put it until it happens.

The fifth pass's four rules survive with one correction, and it is worth stating because it
is the rule that would otherwise stop row 6 from being written down. *"A row that needs a
real session cannot be started to make one appear"* is still true. But row 6 is not a row
that needs a real session — it is the row that offers one, and it is the only one that has
ever been available. The fifth pass could not write it because the front door did not
exist. It does now.

Kept below, because it is the reasoning rows 8 onward still rest on:

Fifth pass, 2026-09-12. The pre-night rules are spent — they were build only what the
night needs, and let nothing be in flight across Saturday, and between them they picked
rows 1 and 3. What replaces them is one fact and its consequences.

**There is no first session.** The club is not running On Deck tonight and is finishing
afterwards. OD-0 does not happen, and no rearrangement of this table makes it happen: it
needed a venue, an organizer and fifty players, and the only set of those this project
had access to is gone. So the ordering question is no longer "what does the retro teach
us first" — there is no retro — it is **"what gets a complete stranger to run a night on
software nobody has ever run a night on."**

That splits the On Deck rows in two, and the split is harsher than the fourth pass's:

- **Rows that need a real session** — OD-1's offline behaviour, OD-2, OD-3, OD-4, and now
  OD-5 again. These are not retro-gated, or second-club-gated. They are gated on the
  **first** session, by someone we have not met, on a club that does not exist yet. That
  is two steps away, and pretending otherwise is how they get built on guesses.
- **Rows that make that possible** — OD-6, and the two non-code rows that feed it. It is
  the entire On Deck plan now, not the first item of one.

Four rules:

- **Correct the record before shipping anything new.** The live landing page says, in the
  present tense, that we are building On Deck with a club that is finishing and never ran
  it. That is a copy fix, it is half an hour, and it comes before the release rather than
  inside it.
- **A row that needs a real session cannot be started to make one appear.** Unchanged from
  the fourth pass and truer now. Building OD-2 gets nobody to use On Deck. OD-6 might.
- **The demo is no longer marketing.** It is the only end-to-end exercise of the Floor,
  Display and Kiosk that will ever have existed, including for us. See OD-6 slice 1.
- **Separate what buys artifacts from what buys evidence**, and note that neither is
  scheduled. A Juice Bros night buys artifacts — a real event log, real numbers, real
  photographs, a real load — and no onboarding evidence at all, because the person running
  it built it and a test that cannot fail measures nothing. A staged non-author walkthrough
  buys the evidence and none of the artifacts. **Both were briefly rows here and both came
  back out on 2026-09-12** (see OD-0′ questions 1 and 2 for why, and for what stands in
  their place). The rule survives them: do not let a night we run ourselves answer a
  question only a stranger can.

✅ means shipped to master; a blank cell means not started.

**Seventh pass, 2026-09-18, same day, and it is the one that sets the table below.** Every
On Deck row that hasn't shipped — OD-A, OD-0′, OD-1, OD-2, and OD-3/4/5 — moves to the
bottom. The reason is plain and doesn't need dressing up: nobody is using On Deck right
now, and that includes the sixth pass's own row 6, OD-A, whose entire job was to go find
somebody. This overrides the sixth pass's *ordering* call, not its reasoning — OD-A is
still the right next On Deck move whenever On Deck work resumes, and the four rows behind
it keep the relative order the fifth and sixth passes already gave them. What changes is
that Booking Buddy and Match Mixer's unstarted rows move up to fill 6 through 13, in the
order they already held relative to each other.

| Order | Done | Initiative | Why here |
|---|---|---|---|
| 1 | ✅ | OD-6 Printed Club QR sign (slice 3 only) | Shipped 2026-09-08 (#463, PR #466). `/on-deck/home/qr` is now the sign itself, printing on Letter and A4, plus two open routes serving the bare code as a file for a print shop or a group chat. Nothing now stands between the booked night and its checklist except printing one |
| 2 | ✅ | RR-1 remainder (#394 to #397, plus #441) | Shipped 2026-09-07. All five tickets closed, plus an unplanned sixth (RR-1.6, clear-the-roster with undo). Match Mixer is live at `/tools/match-mixer` |
| 3 | ✅ | RR-3 remainder — share URL and find-me | Shipped 2026-09-10. Specced as #490 and ticketed #491 to #495, all closed inside one day. RR-3 is now complete on all four counts: print and roster memory landed early inside RR-1, the share link and find-me landed here. It cleared the gap in front of the night exactly as the slot intended, and nothing was left in flight across Saturday |
| 4 | ✅ | **Correct the landing page** | Shipped 2026-09-13 (#504, PR #505). The page no longer names the club anywhere in its copy — naming it was the part that implied the relationship — and the two illustrations use a stand-in the way the PPA pro names beside them already do. "Talk to us about your club" stays, because self-serve is row 5 and not yet real. Half a day, blocking nothing, taken first because shipping an adoption release off a page making a claim that stopped being true is worse than the day it costs |
| 5 | ✅ | **OD-6 The adoption release** (demo night, self-serve Club, first-night kit, landing flip, funnel) | Shipped 2026-09-14 to 2026-09-18 (#512; tickets #514 to #524). Specced out of a grilling session that cut co-owners, dropped the one-release rule in favour of shipping continuously, and narrowed the target user. **#512 is the authority on what this is, not the OD-6 section below.** The front door exists: demo night at `/on-deck/demo`, self-serve Club creation, a first-night kit, a landing page that claims nothing it cannot show, a Session that closes itself, and six funnel counters live before anyone is told |
| 6 | ✅ | **RR-6 Pools (#392)** | Shipped 2026-09-23 to 2026-09-24 (#392; tickets #552, #553, #554). Grilled, built and closed inside two days. A Pool count deals the Roster, `---` lines in the Roster declare the pools instead, courts are allocated once for the night, and the board is one field with a band per pool. The Impeccable pass it was still waiting on happened inside RR-6.1 (sticky band names, summary lines stacked where the one line always sat). `GENERATOR_VERSION` stayed at 1, and `unchanged-boards.test.ts` pins twelve pre-pools boards to prove a one-pool link still draws what it drew |
| 7 |  | **BB-1 Recurring games** | **First unstarted row as of the eighth pass**, 2026-09-24. The month's other goal and now the only one of the original three picks still outstanding. It needs no user we do not have: Booking Buddy has people using it, On Deck does not. The one L on the table, unchanged in importance, and not waiting on anything |
| 8 |  | RR-2 Courtside mode | Turns the generator into the thing that stays open on the bench. The Schedule shape it was held behind is settled and shipped, so nothing ahead of it is Match Mixer work any more. Grill it against the pooled shape (see RR-2's new question 6) |
| 9 |  | BB-3 Slot Link as the growth surface | Needs BB-1 to have a "next week" to hook onto |
| 10 |  | BB-4 Copy for group chat | Small, high-use |
| 11 | ✅ | **RR-4 Constraint toggles (#391)** | Shipped 2026-09-19 to 2026-09-20 (#391; tickets #543, #544, #545). Three of the four features specced, and skill balance cut rather than deferred — a lopsided skill pairing comes out in the wash over eight rounds, which is the argument mixed doubles cannot make and is why that one got a hard constraint instead. Three of the four also turned out not to be Formats at all (ADR 0003): the row holds rotating, fixed partners and singles, and mixed doubles is a checkbox under rotating. Still orthogonal to RR-6 — each pool runs whichever Format is picked |
| 12 |  | BB-5 Booker jobs + countdown | The moat, and the roadmap already has most of the spec |
| 13 |  | BB-6 PWA + push | Makes every time-sensitive nudge above actually land |
| 14 |  | **OD-A Point somebody at it** | **Was row 6; moved to the bottom of the table in the seventh pass, 2026-09-18, because nobody is using On Deck right now.** The reasoning that made this the cheapest possible next On Deck step is untouched (see OD-A below) — #512's shipping rule was *"the release is the day we start pointing people at On Deck, not a deploy,"* the product is live, the funnel is instrumented, and the counters read zero. It is simply not the priority at the moment. Still first among the four remaining On Deck rows whenever that changes |
| 15 |  | **OD-0′ A real session, run by somebody else** | Downstream of OD-A rather than of anything Booking Buddy or Match Mixer touch. Still not code, still the thing that turns every OD row below it from a guess into a decision, and now gated on row 14 rather than on nothing we control |
| 16 |  | OD-1 Venue resilience (offline behaviour only) | Its two self-serve pieces moved into row 5 and shipped there. What is left needs a real room on real gym wifi, which is row 15, which is row 14 first |
| 17 |  | OD-2 Announce turnovers | Cheapest big win for a self-serve session. Unchanged, and still behind a session that has not happened |
| 18 |  | OD-3 Wait bands, OD-4 TV Display, OD-5 Recap image | Polish informed by real sessions, all three of them back here as of 2026-09-12. OD-5 was briefly promoted on the strength of one real Summary that never arrived, so a recap image still has nothing to be designed against |

No row sits outside the order.

If only one thing per app ships this month: RR-1, OD-0, BB-1. RR-1 landed 2026-09-07.
OD-0 will not happen, and **OD-6 landed in its place on 2026-09-18**, which is the On Deck
goal met by substitution. That leaves BB-1, and it is the only one of the three original
picks still outstanding — worth noticing, because it has been unblocked and un-started for
the whole month while three other things overtook it. As of 2026-09-24 it is four: RR-6
went past it too, legitimately, and it is now the top of the table with nothing left above
it to overtake it by default.

The uncomfortable version, updated 2026-09-18 and still uncomfortable: **On Deck is a
feature-complete v1 with a front door that nobody has ever used.** The "no way in" half is
fixed — demo, self-serve Club, first-night kit, a landing page that tells the truth — and
the "nobody" half is untouched and will stay untouched until row 6 happens. The change is
that the honest question has moved. It was *"is anyone going to run this, and what would it
take to find out cheaply"*; the answer to the second half was OD-6, it cost four days, and
it is spent. The question now is just the first half, and it is answered by telling people,
not by building.

The trap named here, before the seventh pass: **row 7 was more fun than row 6.** RR-6 is a
specced, grillable, satisfying M with a live public surface to land on. Row 6 was writing a
post and waiting. The whole of OD-6 was justified on getting a stranger to run a night, and
skipping straight past the one step that could produce one would make the previous four days
a very elaborate way of avoiding it.

**Moot as of the seventh pass, same day** — OD-A didn't lose to RR-6 for being less fun, it
got moved on purpose because nobody is using On Deck right now, which is a decision, not the
avoidance this paragraph warned about. Worth rereading anyway if OD-A is still sitting at the
bottom months from now for no better reason than that something else kept being next — that
is the trap arriving after all, just later than this paragraph expected.

Worth naming while the table is this clean: rows 1 through 5 are the first stretch where
what got built and what this table said to build are the same list, and it now runs five
rows deep rather than three. The earlier passes diagnosed the opposite, and the diagnosis is
what fixed it.

### Shipped, and where it went

Kept as a log so the table above can't silently drift again. Compressed on 2026-09-12:
the per-PR inventories that used to live here were making the point that off-table work
outnumbered table work, and that point is made below once rather than re-evidenced every
pass. Anything shipped is now a line and a pointer, because its reasoning has a durable
home and this doc is not it.

**On the table.**

- **RR-1 Engine + plain output — complete 2026-09-07** (#389; #393 to #397, plus #441
  added while building). Live at `/tools/match-mixer`. Row 2.
- **OD-6 slice 3, the printed Club QR sign — 2026-09-08** (#463, PR #466). Row 1, and the
  one build item OD-0 was waiting on. `/on-deck/home/qr` is the sign itself, printing on
  Letter and A4, plus `/on-deck/c/<clubId>/qr.svg` and `qr.png` serving the bare code as a
  file — the thing an inline `<svg>` on a gated page could never be, and what a print shop
  or a group chat actually needs.
- **RR-3 Share link and find-me — complete 2026-09-10** (#490; #491 to #495). Row 3, and
  the last thing built before the night. The share URL encodes Config and not the
  Schedule, so a link regenerates deterministically; #494 added the part the plan did not
  have, which is that a link minted before a generator change says so rather than quietly
  drawing a different board. RR-3's other two halves had already shipped inside RR-1.
- **The landing page correction — 2026-09-13** (#504, PR #505). Row 4, written into the
  table and shipped the next day. It does the part of OD-6 slice 5 that could not wait for
  the release: the club section is gone rather than updated, because there were no real
  numbers to update it with and there will be none until a stranger runs a night. What is
  left for slice 5 is the harder half — what stands in its place — not the removal.
  `src/lib/on-deck/session-date.ts` still names the club in a code comment explaining why a
  Club carries a time zone, deliberately: that is history, not a public claim.
- **OD-6, the adoption release — complete 2026-09-18** (#512; tickets #514 to #524, eleven
  of them, four days). Row 5, and the largest single piece of table work this doc has
  governed. Specced out of a `/grilling` session on 2026-09-14 whose output supersedes the
  OD-6 section below on four counts, recorded here because rows 9 onward reason from them:
  **co-owners are cut** (unrelated to the auto-close they were bundled with, and they
  assume a second willing person the evidence says does not exist); **the one-release rule
  is dropped** in favour of shipping continuously, with one hard ordering rule kept — the
  funnel counters ship before the announcement, because analytics added in month two cannot
  see month one; **the target user narrowed** from "a stranger" to an informal organizer
  running a Saturday social out of a group chat, with no club platform, no volunteer, no
  spare tablet and probably no printer; and **the problem was confirmed first-hand** as the
  marker board and the one person maintaining it all night, not the admin around the social.
  What shipped: a demo night folding a full 40-player log client-side across the Floor,
  Display and Kiosk (#519, #522) on a rotation projector lifted out of `server-only` (#514),
  self-serve Club creation through an RPC (#515) with the draft surviving sign-in (#520),
  a Club QR on your phone and a link you can paste (#517), a first-night kit (#521), the
  landing flip (#523), a Session that closes itself (#516), club-branded player surfaces
  (#518, and #510 before it), and six funnel counters (#524, `on-deck/docs/adr/
  0008-adoption-funnel-analytics.md`). Slice 1 did the job it was promoted for, and this is
  the part worth carrying forward: it is the first end-to-end fold of a complete night this
  software has ever run, and watching it fold turned up two things nothing else would have.
  #532 is a plain bug — a closed Session still offering walk-up and group-queue controls on
  production. #533 is not a bug at all and is the more valuable of the two: replaying the
  demo's log showed that the first two Foursomes of a night are committed while the room is
  still filling, so they seat arrivals in arrival order across the widest skill gap of the
  evening, which is ADR 0007 working exactly as written and producing the worst fit the
  scorer knows how to make. Neither was visible from the code, from the tests, or from any
  amount of clicking around a half-populated board.
- **RR-4 Constraint toggles — complete 2026-09-20** (#391; #543, #544, #545). Row 11,
  taken out of order. Skill balance cut, mixed doubles a hard constraint, and ADR 0003 on
  why three of the four were never Formats. See the RR-4 section.
- **RR-6 Pools — complete 2026-09-24** (#392; #552, #553, #554). Row 6. Grilled on
  2026-09-23 into ADRs 0004 and 0005 (#555), then built the same night and the next day.
  6.1 is the pool layer above a pool-blind engine, the banded field, per-pool limits and
  refusals, and the link; 6.2 is `---` headers, labels and Keep this split; 6.3 turned out
  to be mostly built already by 6.1 and 6.2, and shipped as the find-me line naming the
  pool plus the CONTEXT.md entries that described none of it. `match-mixer/CONTEXT.md`
  is the authority now; the RR-6 section below is a pointer.

**Off the table, and larger than it.**

- **The Session Summary reader, and a clock for the Club — 2026-09-08** (#469, PR #470).
  `on_deck_session_summaries` had been populated since #255 and read by nobody. Three
  surfaces now do, under `/on-deck/home/summaries`. It pulled in an unplanned schema
  change: a Summary is the first On Deck surface that has to name a *day*, and TO
  Pickleball Club plays 18:00 to 20:00, which in Toronto closes on the next UTC day — so a
  Club now carries a time zone, adopted silently from the Organizer's browser. Migration
  `20260908120000` is on the hosted project (#487 re-confirmed it, and corrected
  `on-deck/PROGRESS.md`, which had it as unpushed).
- **Match Mixer became The Board — 2026-09-09** (#477 to #489). The largest single day of
  off-table work this doc has seen, and it changed what governs the tool: `match-mixer/
  DESIGN.md` is now the visual authority and the brief's direction is superseded. Two
  consequences that reach rows below — the Partner Matrix is cut (#477, with Coverage and
  the Repeat mark standing in its place), and **print is now a demotion of the board
  rather than the constraint that shapes it.**
- **OD-0's Club is seeded — 2026-09-09** (#487). Not code, and the actual last blocker.
  Vanessa owns it. The durable lesson is the ordering: the insert joins on an `auth.users`
  row that only her first sign-in creates, so an insert run any earlier would have matched
  nothing and reported success. One owner per Club plus a Volunteer Link that cannot start
  a Session means her login was the only thing in the world that could have opened a night.
  Moot in the event — no night was opened — but the constraint is real and carries into
  self-serve, where it is slice 2b of OD-6.
- **Booking Buddy import/sync hardening, and marketing-site work** — roughly two full days
  across 2026-09-07 and 2026-09-08, none of it on this table, all of it closed. Itemised
  in git and in the issue list; not re-listed here.
- **Two small fixes, 2026-09-23 to 2026-09-24.** The Booking Buddy date picker scrolling
  the Bookings page to the top (#551), and the crawl signals behind three "Discovered, not
  indexed" pages in Search Console (#559: honest sitemap `lastmod`, episode pages
  prerendered with 1h ISR, a server-rendered h1 on Pickle Point Pal). #559 leaves a manual
  step: resubmit the sitemap and request indexing on `/contact`, the part-2 mixed doubles
  episode and `/tools/pickle-point-pal`.

**The lesson the log actually produced.** Of everything built between this doc being
written and 2026-09-07, only row 2 came from the table — the rest was marketing polish and
Booking Buddy sync work the table doesn't govern. Writing that down is what moved row 1:
it shipped the next day, and it was half a day's work, which is the more useful half. The
deadline-shaped row had been sitting behind work that felt more urgent because it was
already in flight.

The test that came out of it — *does the night or the retro fail without it?* — sorted
the last two weeks well and **retired unused on 2026-09-12**, when the night and the retro
both stopped existing. Recorded because the shape of it was right and the replacement in
the interleave is the same instrument pointed at a different target: *does this get anyone
to run On Deck?* The sign and the reader passed the old test. Only OD-6 passed the new
one.

**And it still points somewhere, 2026-09-18.** OD-6 shipped, and the honest reading is that
it has not answered its own test yet — it built the thing that *can* get somebody to run On
Deck and stopped one step short of the step that would. Held against the same question, row
6 passes and row 7 does not (row numbers as of the sixth pass, before the seventh pass moved
On Deck to the bottom of the table for an unrelated reason — see the note above the
interleave table). Match Mixer is the better afternoon, and this is the third pass running
where the better afternoon was not the right one — a streak the seventh pass's table order
doesn't reset, since OD-A moved for lack of an audience, not because RR-6 out-argued it.

---

## Booking Buddy

Diagnosis: the mechanics are deep (visibility lattice, two import sources, derived
Capacity, session-less accept links). The loop is thin, and both roadmap docs say so. The
app has no reason to be opened between games. Every initiative below either creates that
reason or removes friction on the path to it.

**Frozen for now** (don't grill these, they're deliberately parked):
- DUPR partner API (profiles roadmap Part 3). Partnership dependency, low value for friends
  who already know each other's level. Interim `skill_self_rating` field is fine when
  profiles come up.
- Profile fields beyond a self-rating.
- Crowd-sourced booking windows at the Place level (differentiation A4). Needs user density
  first.
- Cost splitting (C1). Real pain, but push (BB-6) has to land first or "who's paid" nudges
  go to email and die.
- Anything from the "Explicitly out of scope" list in the differentiation roadmap.

### BB-1 · Recurring games

**Size:** L. **Blocked by:** nothing. **Needs:** `/grill-with-docs` (new glossary term,
likely an ADR on template-vs-rule).

**Claim.** "Tuesday 8pm, every week" is the single biggest retention lever and it's still
unbuilt. Until it exists every Slot is a one-off and the app is a poll tool.

**Already decided.**
- The Slot stays the unit everything else understands (Responses, Capacity, Reminders,
  Slot Links, Bookings all hang off a Slot). Recurrence must not fork that.
- Bookings do not carry over between instances. Each week's court is imported or logged
  as today (ADR 0002 holds). The Intended Org does carry over.
- Reuses the existing pure-planner-plus-cron pattern (`planAttendeeReminderRun` shape) for
  minting instances and pinging regulars.

**Open questions (first frontier).**
1. Is a recurring game a **template entity that mints ordinary Slots**, or a Slot with a
   recurrence rule on it?
   ➡️ Template entity. A new glossary term (working name: **Standing Game**) that owns
   cadence, default time, Intended Org, division, notes, and the regulars list, and mints a
   plain Slot N days ahead. A Slot-with-a-rule makes every Slot query recurrence-aware.
2. How far ahead is the next instance minted?
   ➡️ One instance at a time, minted seven days before start, via cron. Configurable per
   Standing Game later if anyone asks.
3. Who are the "regulars" who get pinged?
   ➡️ Derived: everyone who responded yes to the previous instance, unioned with an
   optional Friend Group the organizer attaches. First instance uses the Friend Group
   alone. No separate invite list to maintain.
4. Do regulars auto-RSVP yes, or get asked?
   ➡️ Asked. Auto-yes creates ghost Capacity and turns no-shows into a data problem. The
   ping is the "reason to open the app between games."
5. Skip a week vs end the series vs edit one instance?
   ➡️ All three, and they're different actions. Editing an instance edits that Slot only.
   Skipping deletes the minted Slot and mints the next. Ending stops minting and leaves
   history alone.
6. Where does it live in the UI?
   ➡️ Games page. A "repeats weekly" chip on the Slot, a Standing Games section (or filter)
   above one-offs, and "make this a standing game" on an existing Slot's detail page.
7. What does the Guest (non-account) experience look like on a recurring Slot Link?
   ➡️ Defer to BB-3. The Slot Link is per Slot, so v1 is unchanged: a new link per week.

**Constraints.** ADR 0001 (bare-proposal Slots), ADR 0016 (two-tier nav), Reminder and
Booking Reminder semantics unchanged. `bb_first_slot` analytics: decide whether a minted
instance counts.

### BB-2 · Visibility defaults to `calendar` on accept — shipped

**Shipped 2026-09-06** (#376, slices #377 to #380). Dropped from the interleave.

The reasoning used to be restated here and is not any more: it was written up properly as
[ADR 0021](../booking-buddy/docs/adr/0021-visibility-default-is-calendar.md), which is
longer, current, and the thing a future grill should actually read. The one-line version,
because BB-3 leans on it: accept now grants `calendar` symmetrically, the ADR 0007 lattice
is untouched, existing Connections were not widened retroactively, and Groups moved off
the primary nav behind an "advanced" affordance on Friends.

### BB-3 · The Slot Link page is the growth surface

**Size:** M. **Blocked by:** BB-1 (the "next week" hook needs a Standing Game to point at).

**Claim.** The Guest who opens a share link and RSVPs is the whole growth loop. Today they
RSVP, get no Reminder (Guests are excluded in v1), and get no reason to sign up. Make this
the best page in the app.

**Already decided.**
- Guests stay name-identified and RSVPing does not create a Connection (glossary: Guest).
- Sign-up from a Slot Link routes through the organizer's Invite Link mechanism so the
  result is a pending friend request, never an auto-accepted Connection (ADR 0004 spirit).

**Open questions.**
1. How does a Guest get a Reminder?
   ➡️ Optional email field at RSVP. Supplying it is the opt-in; no separate preference.
   Reminder copy for Guests carries the join hook.
2. What is the join hook?
   ➡️ After a yes: "This game repeats every Tuesday. Want next week's automatically?" →
   sign up → auto-created request to the organizer via their invite token → on accept,
   they're a regular (BB-1 Q3).
3. Does the Slot Link page show who else is in?
   ➡️ Yes, first names of yes responders, count of maybes. Organizer toggle to hide.
   Organizers already paste this into the chat, so it's not new exposure.
4. Can a Guest change their answer later?
   ➡️ Yes, same name on the same link, no auth. Accept the small spoofing risk; it's a
   pickleball RSVP.

### BB-4 · "Copy for group chat"

**Size:** S. **Blocked by:** nothing.

**Claim.** The crew lives in WhatsApp and Booking Buddy isn't replacing that. One button
that produces a clean text block for the chat will likely be the most-used action in the
app. Meet the chat, don't fight it.

**Already decided.**
- Freeform chat inside Booking Buddy stays out of scope (differentiation roadmap).

**Open questions.**
1. What's in the block?
   ➡️ Name, day/date/time, facility (Intended Org or booked court), court label(s), "N in,
   M maybe," the Slot Link. Plain text, no markdown, WhatsApp-safe line breaks.
2. Where does the button live?
   ➡️ Slot detail (primary) and the dashboard row (secondary). Web Share API on mobile
   with clipboard fallback.
3. One template or configurable?
   ➡️ One. Add a second only when someone asks for a specific change.

### BB-5 · Booker jobs and booking-window countdown

**Size:** L. **Blocked by:** nothing (BB-6 makes the nudges better but isn't required).

**Claim.** Twelve people need three courts, one account holds one, everyone races at 7am,
half of them sleep through it. Nobody else models that. It's the moat. The differentiation
roadmap's A2 section is already close to a spec; the grill's job is to cut v1.

**Already decided.** Everything in differentiation roadmap A2 and A3, specifically: jobs
are on a Slot, one or many; a target court is a starting hint not a binding; reconcile on
courts actually held; "still open" is neutral, never an accusation; no booking-side
reliability signal ever; stand-down messaging for non-bookers.

**Open questions.**
1. What's the v1 cut?
   ➡️ Fan-out jobs with states open / claimed / booked / couldn't, seeded from Slot
   division, plus the dashboard countdown with the per-booker line. Defer cover-bookers
   (multiple people per court) and the soft post-open nudge to v2.
2. Who can claim an open job?
   ➡️ Any yes-responder with an account. Guests can't.
3. Where does "got it" attach the Booking?
   ➡️ The existing Log-a-Booking form, prefilled from the job (Org, date/time, target
   court), with the court freely editable. Same form, same Booking.

### BB-6 · PWA + web push

**Size:** L. **Blocked by:** nothing, but the value compounds after BB-1, BB-3, BB-5.

**Claim.** "Vaughan opens in 10 minutes" by email is dead on arrival. Every time-sensitive
nudge in the roadmap needs to buzz. Pickle Point Pal already has the PWA plumbing pattern.

**Already decided.**
- No native app (PRODUCT.md, differentiation roadmap).
- Push is in addition to email, governed by the same per-notification preferences, never a
  replacement.

**Open questions.**
1. Scope and install surface?
   ➡️ Manifest scoped to `/booking-buddy`, install prompt on the dashboard after first
   value (first Slot or first Booking), never on the landing page.
2. Which sends go to push?
   ➡️ All of them: Reminder, Booking Reminder, Connection Request, Connection Accepted,
   and the BB-5 countdown/claim pings. Each honours its existing preference.
3. iOS?
   ➡️ Web push on iOS requires the PWA to be installed to the home screen. Say so in the
   install prompt. Don't build a workaround.
4. Subscription storage?
   ➡️ One row per browser per User, pruned on 410 from the push service.

---

## On Deck

Diagnosis, rewritten 2026-09-12: every issue in the spec shipped (#238 through #351, all
closed). It is feature-complete for v1 and **has never run a real night, and no longer
has one booked**: TO Pickleball Club is not using it tonight and is finishing afterwards.
The gap that used to matter — "has never run a real Saturday" — did not close, it widened
into the one that matters now:
**On Deck has no way to acquire the next club.** An organizer cannot evaluate it, cannot
start it, and until #463 could not put it on a wall. Every code initiative below is
therefore gated on OD-6 rather than OD-0, and OD-6 is gated on nothing.

**Diagnosis again, 2026-09-18, because OD-6 shipped and the sentence above is now false.**
An organizer can evaluate it (`/on-deck/demo`), can start it (self-serve Club creation), and
can put it on a wall or in a group chat without emailing anyone. The acquisition gap is
closed on the product side and open on every other side: **nobody has been told On Deck
exists.** The diagnosis is no longer about missing capability, it is about a distribution
step that has never been taken, and it belongs to OD-A below rather than to any code row.

**Frozen for now:**
- Playing Style (deferred in the spec; Session Summaries decide whether the mismatch
  complaint is real).
- Scoring, results, anything cross-week (ADR 0001, ADR 0002).
- Team assignment inside a Foursome (ADR 0003).
- Co-owners per Club (cut in #512, 2026-09-14). Not frozen for the usual reason — it is
  cut because it assumes a second willing person, and the one piece of real evidence this
  project has says that person is the scarce thing. Re-open it when somebody asks, as an
  ordinary migration.

### OD-A · Point somebody at it

**New 2026-09-18. Row 14** (was row 6 for a few hours the same day, until the seventh pass
moved every unstarted On Deck row to the bottom of the interleave table because nobody is
using On Deck right now — see the note above that table. The reasoning below is unchanged;
only its place in the queue moved). The row that turns everything OD-6 built into something
that can be observed. **Size:** not code, an afternoon. **Blocked by:** nothing. **Gates:**
OD-0′, and through it every remaining On Deck initiative.

**Claim.** #512's shipping rule was that *the release is the day we start pointing people at
On Deck, not a deploy.* By that definition On Deck has not been released. It is deployed,
the demo works, the Club form works, the first-night kit works, the six funnel counters are
live, and the number of people who know any of it exists is zero. Every counter reads zero
and will keep reading zero for reasons that have nothing to do with the product.

**Already decided** (all of it in #512, restated because this row is where it gets used).
- **The audience is one specific person**: an informal organizer running a Saturday social
  out of a group chat, with no club platform, no volunteer, no spare tablet and probably no
  printer. Not an established club with a name, a logo and a system it already runs on —
  that segment wants On Deck embedded in what they have, wearing their branding, and it is a
  different product and deferred.
- **The problem to lead with is the board**, confirmed first-hand: the marker board or the
  tray of name chips, and the one person maintaining it all night. Not the booking, not the
  money, not chasing forty people in a chat.
- **It is free and the page says so.** No testimonials, no user counts, no invented history.
- **The demo is the evidence**, because it is the only evidence there is.

**Open questions.**
1. Where?
   ➡️ Open, and worth ten minutes rather than none. The Juice Bros audience is the one
   channel this project owns and the one place the brand is already trusted, which argues
   for the podcast and its socials first. Beyond that: r/Pickleball and the Toronto/GTA
   pickleball Facebook groups, where the organizer described above actually posts. Cold
   outreach to club accounts is a different and worse motion; skip it.
2. What is the ask?
   ➡️ "Try the demo," not "sign up." The funnel separates `od_demo_finished` from
   `od_club_intent` precisely so that the demo can be the whole ask and still teach
   something. Asking for a signup up front collapses the two numbers that need to stay
   apart.
3. Does it say where On Deck came from?
   ➡️ Recommended yes, briefly, as slice 5 settled: built for a real club that ran real
   socials, ready a few weeks after that club ended. It is true, it explains the absence of
   users without apologising for it, and it is a better story than silence.
4. How long before reading the counters?
   ➡️ Open. Long enough that a zero means something. A week of a post sitting in one
   subreddit is not a result; it is not a sample either.
5. What if nobody bites?
   ➡️ The useful version of this question is *which counter is zero.* Nobody opening the
   demo is a distribution problem and says nothing about the product. Demos opened and
   finished with no `od_club_intent` is the product failing to convince. Intent with no
   Club created is friction in signup. Those three have opposite fixes, which is the entire
   reason #524 shipped before this row.

### OD-0′ · A real session, run by somebody else

**Rewritten 2026-09-12, and inverted.** This was the fixed point the entire doc was
sequenced around: a booked Saturday with TO Pickleball Club, gating every other On Deck
row. It will not happen. The club is not running On Deck tonight, and it is finishing
afterwards. Everything the original section planned for — the runbook, the observer, the
retro, the capture list — needed an organizer running the app in a room, and there is no
longer one to run it.

**What that cost, stated plainly**, so no row below quietly assumes otherwise:

- **No event log.** OD-6 slice 1's demo goes back to a synthetic night, as originally
  specced. Reverted below.
- **No Session Summary.** OD-5's recap image has nothing to design against and returns to
  row 18 (row 16, then row 15, before earlier renumbers; moved again in the 2026-09-18
  seventh pass when every unstarted On Deck row dropped to the bottom of the table). The
  landing page has no real numbers to show and will not get any until somebody else runs a
  night.
- **No photographs of the app in a room**, which is what a landing page for a live-events
  product wants most and can fake least.
- **No retro**, and therefore no calibration for OD-1 through OD-5. They are guesses, and
  the doc should keep calling them guesses rather than letting the word wear off.
- **No observed organizer.** Vanessa was the nearest thing to a stranger this project was
  ever going to watch use the software, which was worth more than any of the above.

**What survives.** One thing, and only if you are in that room tonight anyway as a person
rather than as a developer: **which part of running the social is the part nobody wants?**
The club is ending because exactly one person was willing to do the work and nobody will
take it on. On Deck reduces the night-of work — the queue, the calling, the board — and
does nothing about booking the venue, collecting money, or chasing forty people in a group
chat. If the unwanted part is the night-of chaos, On Deck is aimed correctly. If it is the
admin around it, On Deck is solving the half that was never the bottleneck. That is a
conversation with two or three regulars, it needs no software running, and it is the last
first-hand evidence this project will get for a while. It is worth more than the rest of
the list combined now that the rest of the list is unavailable.

**Size:** not code. **Blocked by:** ~~OD-6, and then~~ **OD-A (row 14), and then** a
stranger's choice (2026-09-18 — OD-6 shipped, so the first half of this is now done and the
gate moved down to telling somebody; OD-A itself moved to the bottom of the table the same
day for lack of an audience, which pushes this row's earliest start date out with it, not
because the gating logic changed). **Gates:** OD-1 through OD-5.

**What changed on 2026-09-18.** This section reads as though a first outside session is a
thing to be waited for. It no longer is, quite: an organizer can now find the demo, play a
night, create a Club and be walked through their first Saturday without a conversation. The
distance between here and a real session run by somebody else is one post, one person who
reads it and one Saturday. That is still three things and any of them can fail, but none of
them requires a venue, a favour or a relationship, which is what made this unreachable a
week ago. Question 4 below — *if a stranger does run one, how do we hear about it?* — is
also answered now: `od_first_session_started` and `od_first_session_closed` (#524).

**Claim, unchanged and now unreachable on our own.** One live session produces a better
next-steps list than anything written here. The Session Summary already captures the
numbers, the reader shipped in #469, and none of it has ever had a real night to read.

**Open questions — this is a fresh frontier, and the old checklist is void.**

1. Is waiting for a stranger the only path to a first session?
   ➡️ No — **Juice Bros can run its own social night, and should.** A pickleball podcast
   with an audience, in the city, running a social under the brand: it costs a venue
   booking and an evening, it is ordinary podcast content besides, and the app gets used in
   a real room.

   **But it is worth being exact about what that buys, because it is only half.** A night
   we run ourselves produces *artifacts* and no *evidence*:

   - **Artifacts, all of them real and all of them currently missing:** a genuine event
     log for slice 1's demo instead of an authored one, real Session Summary numbers for
     slice 5, photographs of the board in a room, and a first genuine load of the Floor,
     Display and Kiosk with fifty people and no author-shaped usage pattern. Every one of
     these is a thing the doc above records as permanently lost. They are not lost.
   - **Evidence about onboarding: none.** The person running it built it. He knows what a
     Club needs, what the Volunteer Link is for, when to hit Last Call, and what the board
     means, because he decided all of it. Watching him succeed measures nothing that is
     actually uncertain. **The test is guaranteed to pass, which is exactly why it proves
     nothing**, and the trap is that a smooth night reads as "onboarding is fine."

   So it is worth running for the artifacts, and it must not be allowed to answer question
   2 below.

   **Not now, though** (decided 2026-09-12). Booking a venue and filling a room is far
   enough out that sequencing OD-6 around it would mean sequencing around a date that does
   not exist, which is the exact mistake the third pass of this doc was written to stop
   repeating. It came out of the table and stays here as a standing option. The artifacts
   it would buy are real; slice 1 authors its event log and slice 5 tells the truth about
   having no numbers, and both get revised if a night ever happens.
2. Then what *does* produce onboarding evidence, short of a stranger?
   ➡️ **A proxy stranger, and this is the cheap one nobody has scheduled.** What was
   lost when the club dropped out was not "a session" — it was *a non-author using the
   software*. That part is replaceable for the price of an afternoon: hand On Deck to
   someone who plays pickleball, has never seen it, and did not build it, and ask them to
   create a Club and run a night. No venue, no fifty players, no booking — a laptop, a
   phone and the dev console's simulated players (#351). **Say nothing while they do it.**
   Every question they ask out loud is a line of copy slice 2 or slice 4 is missing.

   **Declined as described, 2026-09-12.** Handing the app to someone and watching in
   silence is not a thing this project wants to do: it spends a favour, it is awkward for
   both people, and a staged session where someone knows they are being studied is not
   obviously the honest signal it promises to be. The gap it was aimed at is real and stays
   open, so the question becomes *what closes it without staging anything*:

   ➡️ **Instrument the funnel instead of observing a person.** If the first real signup
   is going to be the first non-author use of this software, then the thing that matters is
   being able to see what they did — demo opened, demo finished, Club created, Session
   started, Session closed — rather than being told. That is question 9 of OD-6, it needs
   no favours, it works on strangers rather than friends, and it is the difference between
   learning from the first ten signups and learning from none of them. It is a weaker
   instrument than watching a face, and it is the one that actually fits how this gets
   used. Build it into the release rather than after it.
3. What is the blind spot?
   ➡️ **That the author knows how to run it.** Every judgement in OD-6 about what a
   create-a-Club form needs, what the first-night kit should say, and what the landing page
   has to explain is being made by the one person on earth for whom none of it is
   necessary. That is not a reason to stop — it is the normal condition of building a
   product — but it is a reason to prefer convention over intuition in slice 2, to write
   slice 4's checklist for someone who has never seen a queue app, and to treat "obviously
   they'll understand X" as the exact sentence to go and check. Question 2 is how to check
   it cheaply.
4. If a stranger does run one, how do we hear about it?
   ➡️ Open. Today nothing tells us a Session happened. The Summary row exists; nobody is
   notified. OD-6 question 9's analytics is the cheap version.
5. Does the first outside session need us in the room?
   ➡️ Open, and worth deciding before offering. Being there produces far better evidence
   and makes the product look like it needs a founder present, which is exactly the thing
   ADR 0005 says it must not.

### OD-1 · Venue resilience

**Size:** S now, was M. **Blocked by:** a second club existing (re-gated 2026-09-12 — the
retro alone can no longer decide which failure modes are real, because one night at one
venue is one sample and there is no second one coming from us).

**Split 2026-09-12.** Questions 3 and 4 below left this initiative for OD-6. They were
filed here as venue resilience, but multiple owners per Club and auto-closing a forgotten
Session are not things a venue teaches you — they are the conditions under which it is
safe to hand the app to a club we do not control. Questions 1 and 2, what the surfaces do
when the connection drops, stay here and stay genuinely usage-gated.

**Claim.** Gym wifi drops, the Organizer's phone dies, someone leaves early. The fold over
an append-only log already makes recovery cheap; the surfaces need to say what's happening
instead of going blank.

**Already decided.**
- The log is the truth; nothing is cached as separate mutable state (mirrors Pickle Point
  Pal's persistence rule).
- An open Session and its log are readable without an account (ADR 0006).

**Open questions.**
1. What does the Display or Kiosk show when the connection drops?
   ➡️ The last folded state, unchanged, with a quiet "reconnecting since 8:14" line.
   Never a blank board, never a spinner replacing names.
2. Does the Kiosk accept taps while offline?
   ➡️ No. Buttons disabled with "back online in a moment." Queuing Kiosk events locally
   and replaying risks conflicting with a Volunteer's phone on cellular. Volunteer phones
   keep working.
3. ~~Organizer's phone dies: handoff token, or multiple Organizers per Club?~~ **Moved to
   OD-6** (2026-09-12). The answer is unchanged — multiple owners per Club — but it is a
   precondition of self-serve, not a finding from a venue.
4. ~~Session left open overnight?~~ **Moved to OD-6** (2026-09-12). Same answer:
   auto-close after N hours of no events, Summary computed as if Last Call fired at the
   last event. Same reason: `on_deck_clubs_one_per_owner` plus one open Session per Club
   means a forgotten Session silently blocks a club's next night, and a club we do not
   run has nobody to notice.

### OD-2 · Announce turnovers out loud

**Size:** S–M. **Blocked by:** a second club running (re-gated 2026-09-12). Tonight can show whether players miss their call; it cannot show whether speech synthesis survives somebody else's gym.

**Claim.** A Display in a loud gym with names in a list still means people miss their call.
A chime plus browser speech synthesis replaces the volunteer's voice at zero cost and fits
ADR 0005 (the app never requires a volunteer) exactly.

**Already decided.** The Display and Kiosk stay the primary surface; the opt-in push (#260)
is a courtesy on top. Announce is another courtesy, not a replacement.

**Open questions.**
1. Which surface speaks?
   ➡️ The Kiosk by default (it's by the courts), the Display opt-in. Per-Session toggle
   in Tonight controls; Club default.
2. What is said?
   ➡️ Chime, then "Court 5: Adrian L, Daven W, Sam K, Priya R." Names exactly as entered.
   Court assignments only; On Deck foursomes stay visual (they're already gathering).
3. Fallback when speech synthesis is unavailable or blocked (autoplay policy)?
   ➡️ Chime only, and the toggle explains that a tap on the tablet is needed once to
   unlock audio.

### OD-3 · Player wait bands

**Size:** M. **Blocked by:** a second club running (re-gated 2026-09-12). Tonight's Summary gives one wait distribution, which is a sample rather than a calibration — bands tuned to one club's court count and turnout would be fitted to noise.

**Claim.** "How long until I'm up?" is the question every Player asks a Volunteer. Match Me
is windowed (ADR 0004) so there is no strict position, but bands are honest and reduce the
hovering-at-the-desk problem the open-play articles all complain about.

**Already decided.** Wait Time is the fairness anchor; no exact position is ever shown
because the window makes it a lie.

**Open questions.**
1. What are the bands?
   ➡️ "On deck" (already committed), "up soon" (inside the selection window), "a few games
   out" (outside it), with a rough minutes estimate derived from tonight's median Game
   length times games ahead divided by courts.
2. Where?
   ➡️ The Player's own phone screen (queue status), nowhere on the Display.

### OD-4 · TV layout for the Display

**Size:** M. **Blocked by:** a second club running (re-gated 2026-09-12), and specifically one with a TV or projector. Ours does not settle that.

**Claim.** Most gyms have a TV or projector. The current Display is a dense
walk-up-and-read tablet list (DESIGN.md). A ten-feet-away screen needs a different layout,
not a bigger font.

**Already decided.** The "substitution board" visual world in `on-deck/DESIGN.md` applies.
Orange is LIVE only, blue is on deck, everything waiting is graphite.

**Open questions.**
1. Layout?
   ➡️ Courts as large tiles across the top, the two On Deck foursomes as a fixed band,
   the Queue paged eight at a time rotating every ten seconds with a page indicator.
2. How is it selected?
   ➡️ A separate route or a `layout` param on the existing Display, chosen from the
   Session's links panel. No auto-detection.

### OD-5 · Shareable recap image

**Size:** S–M. **Blocked by:** a real session (OD-0′). **Re-blocked 2026-09-12** — it was briefly the one row tonight unblocked, on the strength of tonight producing one real Summary. Tonight produces none. The argument for it survives intact for whenever a first session does happen: a recap the club posts itself is the cheapest distribution On Deck has, and it renders the same numbers the landing page wants. The reader
shipped in #469 is what a recap image would be cropped out of, so this is now a
design job on top of something that exists rather than a build from nothing.

**Claim.** "Tonight: 58 players, 112 games, average wait 14 minutes" as an image the club
posts to Instagram is free distribution for the club and for Juice Bros, generated from
numbers already kept.

**Already decided.** Aggregate only, no Player names (ADR 0001, Session Summary discards
the roster).

**Open questions.**
1. Generated where?
   ➡️ Client-side from the Summary (canvas), Web Share on mobile, download on desktop.
   Juice Bros mark in the corner, club name in the title.
2. Who can generate it?
   ➡️ The Organizer, from the closed Session's page.

### OD-6 · The adoption release — shipped

**Shipped 2026-09-14 to 2026-09-18** (#512; tickets #514 to #524). Row 5.

**Read #512, not this section.** Everything below was written between 2026-09-04 and
2026-09-12, before the grilling session that specced it, and that session reopened enough
of it that leaving this as the record would mislead. #512 carries the problem statement,
the 43 user stories, the implementation decisions and the four supersessions listed in
**Shipped, and where it went** above — co-owners cut, the one-release rule dropped, the
target user narrowed to an informal organizer running a Saturday social out of a group
chat, and the problem confirmed as the marker board rather than the admin. The durable
reasoning lives in `on-deck/PROGRESS.md`, the ADRs (0008 is the funnel), and the code.

Kept below because rows 9 onward still reference it, and because the questions that turned
out to matter are a useful record of which prior guesses held:

**Promoted to row 5 and rescoped on 2026-09-12**, when TO Pickleball Club's last night
made this the gate. It was organizer adoption as an eventual nicety; it is now the only
initiative that can produce a second On Deck session anywhere.

**Size:** L, shipped as one release. **Blocked by:** nothing. **Gates:** every remaining
On Deck initiative.

**The rule that had to go.** This section used to say *"Don't onboard a second real club
until at least two sessions have run."* That was written assuming our own club kept
running, so the two sessions would arrive on their own. They will not. Left in place the
rule is self-locking — no second club until two sessions, and no second session without a
second club — so it is deleted rather than amended. The caution behind it was real and
survives in a smaller form: the first outside club should be one we can reach by phone,
not an anonymous signup we never hear from.

**Why one release rather than the old slice trickle.** The slices were ordered demo →
self-serve → kit → landing, each shippable alone. That ordering assumed time to iterate
against a running club. What it produces instead is a half-open front door: demo without
self-serve lets an organizer get interested and then hit "created by hand, contact us";
self-serve without the demo asks someone to sign up for a thing they have never seen run.
Either half alone converts nobody, so the release is the unit.

**Who this is for, stated once because every slice depends on it** (2026-09-12):
**a stranger running their own social night.** Not us, not a club we know, not a warm
intro — there are none. That is a positioning decision and it has a sharp consequence for
how the release is designed: the author's own fluency with On Deck is a liability here
rather than an asset. He knows what a Club needs, what the Volunteer Link is for, when to
hit Last Call and what the board means, because he decided all of it, and none of that
knowledge transfers to the person this release is aimed at. Prefer convention over
intuition in slice 2, write slice 4 for someone who has never seen a queue app, and treat
"obviously they'll understand X" as a flag rather than a conclusion. With no staged
walkthrough scheduled (OD-0′ question 2), the correction has to come from instrumentation
after the fact rather than observation before it — which makes question 9 below, the demo
funnel, load-bearing rather than optional.

**Claim.** Today an organizer can't evaluate On Deck, can't start it, and can't put it on
the wall without emailing us. The landing page's only real CTA is "Talk to us"
(`sections/hero.tsx`, `sections/stays-social.tsx`), a signed-in organizer with no Club
hits "On Deck clubs are created by hand for now" (`home/page.tsx`), and there is no way to
see it work without a venue and 50 people. The gap is not features — the app is
feature-complete and shipped every issue from #238 to #351.

**Already decided.**
- Free, and say so plainly on the landing page.
- The demo is client-only: the real Floor, Display, and Kiosk components folding a canned
  event log of a 40-player night in the browser. No sign-in, no database, no abuse
  surface. The dev console (#351) is the precedent for simulated players; the demo does
  not touch it or the DB.
- `on_deck_clubs` keeps no direct write grants; creation goes through an RPC mirroring
  `on_deck_update_club_defaults`.
- **One Club per owner stays; one owner per Club does not** (clarified 2026-09-12, when
  slice 2b arrived). These were conflated because `on_deck_clubs_one_per_owner` enforces
  the first and, as a plain unique index on the owner column, accidentally enforces the
  second. A person still runs at most one Club. A Club needs more than one person able to
  open its night, which is a schema change (an owners join table, or a second column) and
  wants an ADR.
- Co-organizers are additional owners per Club, invited by email. **Whether that is
  instead of a handoff is reopened, mildly** (2026-09-12 — see question 10). It was decided
  against "the Organizer's phone died," where a co-owner plausibly already exists; it is
  weaker against "the Organizer is gone for good," where nobody thought to add one in
  advance. Note the limit, because the first draft of question 10 overstated it: neither
  feature would have saved our own club, which ended for want of anyone willing to run it
  rather than for want of a second `owner_id`.

**Slices, all in one release.** Ticket them as vertical slices with blocking edges as
usual; the release is what ships, not each slice.

1. **Demo night.** Public route, no auth. Organizer taps "Game done" and watches the
   board move; can switch between Floor, Display, and Kiosk views of the same demo state.
   ~~Seed it from tonight's real event log.~~ **Reverted 2026-09-12** — there is no real
   log, so this is the canned 40-player night as originally specced. Two things follow.
   The log has to be *authored*, which means someone deciding what a plausible night looks
   like without ever having watched one; build it from the Match Me selection rules rather
   than from intuition, so it is at least internally honest. And this slice stops being
   marketing: **it is the only end-to-end exercise of the Floor, Display and Kiosk folding
   a full night that will ever have existed, including for us.** Whatever it turns up is
   the closest thing to a first session this project has. Treat a bug found here as a real
   bug, not a demo bug.
2. **Self-serve Club creation.** Two required fields: club name, court count. Venue
   defaults to the club name, group cap to 4, Floor Mode to hybrid, all editable in
   settings. Lands on home with Start ready. Replaces the "created by hand" panel in
   `src/app/on-deck/home/page.tsx`.
2b. **Co-owners, and the forgotten-Session auto-close** — both moved here from OD-1
   (questions 3 and 4) on 2026-09-12. Not polish: `on_deck_clubs_one_per_owner` plus a
   Volunteer Link that cannot start a Session means a self-serve club has exactly one
   person on earth who can open its night, and one open Session per Club means a night
   nobody closed silently blocks the next one. Tonight demonstrates the first half at our
   own club, where we can walk over and fix it. At someone else's club it is a dead
   evening and a support email. Ships with self-serve or self-serve ships a trap.
3. ~~**Print-ready Club QR sign.**~~ **Shipped 2026-09-08** (#463, PR #466). Landed as
   specced, plus two things the spec did not anticipate: the sheet is drawn once at paper
   proportions so the print stylesheet restates no sizes, and the code is served as a file
   at `/on-deck/c/<clubId>/qr.svg` and `qr.png` for a print shop or a group chat. Written
   up in `on-deck/PROGRESS.md`; not restated here.
4. **First-night kit on home.** A four-item checklist with state (print the sign, decide
   on a Kiosk tablet or skip it, share the Volunteer Link, tell your players) that
   disappears after the first closed Session, plus a "tell your players" paragraph to
   copy for the club chat.
5. **Landing page flip.** Primary CTA "Try a demo night," secondary "Set up your club."
   A short "when things go wrong" section (board stays up offline, volunteers can add or
   pause anyone by hand, undo). Replace the hardcoded TO Pickleball Club section with the
   ~~real Session Summary numbers and photographs from tonight.~~ **There are none**
   (2026-09-12) and there will be none until a stranger runs a night, so this slice has to
   solve a harder problem than it was written for: **an adoption page for a product with no
   users, that does not lie about having any.** The club section cannot be updated, it has
   to go — row 4 did that part on 2026-09-13, immediately and separately. What stands in its
   place is an open question rather than a decided answer: probably the demo itself as the
   evidence ("here is a night, play with it"), plus the honest version of where this came
   from, which is that it was built for a real club that ran real socials and the app was
   ready a few weeks after the club ended. Said plainly that is a better story than a
   fabricated testimonial, and it is the only true one available.

**Open questions.**
1. Does the demo play itself, or wait for taps?
   ➡️ Waits for taps, with a "let it run" toggle that fires a Game done every few seconds.
   An organizer wants to feel the turnover, then watch the night unfold.
2. Can the Club draft start on the landing page before sign-in?
   ➡️ Yes, if cheap: collect name and courts, carry them through sign-in the way Booking
   Buddy carries the invite token. Otherwise the create screen is the first thing after
   sign-in and that's fine.
3. Who generates the QR?
   ➡️ *Settled by what shipped:* server-side, via the `qrcode` package already in the
   tree. The concern behind the recommended answer was "no external service", and a
   local draw satisfies it — nothing leaks the Club id to a third party either way, and
   server-side means no client JS has to run for the sheet to render or print.
4. Co-organizer invite: by email, or a link?
   ➡️ Email. It's a standing role, not a night-of thing like the Volunteer Link.
5. Where does the "tell your players" copy live long-term?
   ➡️ On home under the checklist, and again on the closed-Session page for the next
   week's post.

**New questions, and the real frontier for this grill** (added 2026-09-12 — the five
above were written when this was a nicety, and none of them is the hard part any more):

6. Who is the first outside club, concretely?
   ➡️ **Nobody, as of 2026-09-12.** Asked and answered the hard way: our own club is
   ending and no one is taking it over, so there is no successor, no warm hand-off, and no
   second club in the building. **OD-6 ships into a cold market**, and that settles the
   shape of the release rather than leaving it to taste — with no warm lead there is no
   version of this where an organizer is walked through signup by us, so the demo is not
   an optional nicety on top of self-serve, it is the only thing standing where a
   conversation used to. This is the strongest argument for the one-release call above.
   The old "don't onboard a second club until two sessions have run" caution is not just
   self-locking, it is moot: there is nobody to withhold.
7. Does a Club created by a stranger need anything our hand-seeded one didn't?
   ➡️ **Nobody knows, and now nobody will until one exists** (2026-09-12). This was to be
   answered by watching Vanessa, the nearest thing to a stranger organizer this project
   was going to observe; she is not using the app. The hand-seeded Club is therefore the
   only Club that has ever existed and it was created by a SQL insert, which tells us
   nothing about what a create form needs. Design slice 2 from the Club defaults the
   schema already requires and expect to be wrong about at least one field.
8. What stops a public create-a-Club RPC from being an abuse surface?
   ➡️ Open. One Club per owner is already a natural rate limit of one, sign-in is
   required, and a Club with no Session costs nothing but a row. Probably sufficient;
   worth five minutes rather than zero, since this is the first write path in either app
   that an unvouched account can reach.
9. Does the demo need its own retro loop?
   ➡️ **Yes, and it ships inside the release rather than after it** (upgraded
   2026-09-12, when the staged walkthrough came off the table — OD-0′ question 2). This was
   filed as cheap-to-defer back when a real club and an observed organizer were going to
   supply the evidence. Neither exists. With nobody being watched and nobody to ask, the
   funnel is the only instrument left: demo opened, demo finished, Club created, Session
   started, Session closed. Five counters. Without them the first ten signups teach
   nothing, and there is no second source. `bb_first_slot`-style analytics is the
   precedent, and ADR 0014's onboarding funnel is the shape to copy.

   Deferring this is the one deferral in the release that cannot be recovered later:
   analytics added in month two cannot see month one.
10. **Does a Club outlive the organizer who created it?** Added 2026-09-12, and the
    sharpest question here. **Corrected the same day**, once the reason was known: the
    first draft read the club's ending as evidence that organizers burn out of organizing,
    which would have made this a question about retention. It is not that. She has visa
    trouble and is going home. The club is not unhealthy and the app did not fail her.

    **Corrected again, same day, and this one is a retraction.** The draft above this
    argued that a working club was about to be killed by a schema — that
    `on_deck_clubs_one_per_owner` welds a Club to one person, so a healthy room dies when
    that person leaves. It read well and it is not true of this club. **Nobody is taking
    the club over** (capture item 7). Co-ownership would have had nobody to be, and a
    transfer path would have had nowhere to transfer to. The schema is not what ended this
    club, and claiming it was would be flattering the product at the cost of the actual
    lesson.

    The actual lesson is harder. **At this club, exactly one person was willing to do the
    work, and when she left there was no second.** That is not a database constraint, it is
    the shape of the market: the scarce thing is not clubs, venues or players, it is people
    willing to organize. On Deck's addressable unit is that person, and they are rarer than
    "rec clubs in Toronto" makes them sound.

    Which cuts both ways, and the doc should hold both. Against: a funnel aimed at
    organizers is narrower than one aimed at clubs, and OD-6's demo-to-signup numbers will
    show it. For: if the binding constraint on a club existing is that organizing is too
    much work for anyone to volunteer for, then a tool that removes some of that work is
    aimed at exactly the right problem — and a club folding for want of a willing organizer
    is the strongest possible statement of the problem. **Capture item 7b decides which
    reading is right**, because it asks which part of the work is the part nobody wanted.

    Slice 2b survives all of this, on its original and more modest grounds: a phone dies, a
    volunteer is sick, an organizer is away for a weekend. That is worth building. It is
    not a rescue for a club nobody wants to run, and it should not be sold to this grill as
    one. The reopened handoff-versus-co-owner question stays open on the same modest
    footing — nobody adds a co-owner before they need one — and not on the strength of a
    club this feature could not have saved.

---

## Round Robin Generator

The brief in `briefs/juice-bros-round-robin-brief.md` is adopted as the baseline: lookup
tables plus randomized greedy with a cost function, the Scorer's verdict as proof, print as a
first-class output, "the grid is the interface" design direction, no database in v1. The
initiatives below sequence it and add what the brief is missing.

**Out of scope for the whole tool** (decided in conversation, don't grill):
king of the court, elimination brackets seeded off pool standings, accounts, chat, native
app. Live score sync across phones is v2 (RR-5) and gated on real usage. Pools *without*
the bracket — several independent round robins sharing one court set, no seeding, no
playoff — is in scope; see RR-6.

**Cross-cutting decisions.**
- Product name is **Match Mixer**, route `/tools/match-mixer`. Trades a weak SEO slug
  for consistency with `/tools/pickle-point-pal`; the page title, H1, and body copy carry
  "pickleball round robin generator" for search instead. Glossary and ADRs live at
  `match-mixer/CONTEXT.md` and `match-mixer/docs/adr/` (settled in `/grill-with-docs`,
  see PR #386) — read that before touching RR-2 onward, its terms supersede the ones
  below.
- RR-1 is **not** event-sourced, despite `reduceMatch` and `reduceSession` being the
  house pattern elsewhere. Config (roster, courts, rounds, seed) is plain state; Schedule
  is a pure, deterministic function of it — nothing is committed yet, so there is nothing
  for a log to record. The event log begins in RR-2, above a *locked* schedule (now
  called a **Mixer**, not a Session — see the context map's collision note). ADR 0001
  has the reasoning.
- Precomputed tables are keyed on **`(n, courts)`**, not `n` alone — the brief's keying
  seats 8 players on a 1-court schedule that was really built for 2. Each table is a full
  whist tournament (n−1 rounds, every pairing exactly once) and is served truncated to
  the requested round count, since any leading prefix is still perfectly balanced. ADR
  0002 has the proof sketch.
- Engine lives in a relative-imports-only module so `node --test` can run it (see the
  node-test-no-path-aliases note in memory and Pickle Point Pal's `lib/scoring/` rule).
- Tools are dev-led (Booking Buddy precedent). Design via Impeccable; don't gate on Figma.
  **The target is `match-mixer/DESIGN.md`, not the brief** (changed 2026-09-12). The brief's
  "the grid is the interface" direction was superseded on 2026-09-09 when the tool became
  The Board (#482 to #489): the surface is a physical board with material, print is a
  demotion of it, and a new surface extends that world rather than proposing another.

### RR-1 · Engine + plain output — shipped

**Shipped 2026-09-07.** Specced as #389, ticketed #393 to #397, all closed, plus #441
(RR-1.6, clear the roster with undo) added while building. Live at `/tools/match-mixer`.

The eight settled items that used to be restated here are gone, because every one of them
now has a home that is enforced rather than described: the glossary and the cut-surface
record in [match-mixer/CONTEXT.md](../match-mixer/CONTEXT.md), the visual world in
[match-mixer/DESIGN.md](../match-mixer/DESIGN.md), the table keying in
[ADR 0002](../match-mixer/docs/adr/0002-precomputed-tables-are-whist-prefixes.md), the
non-event-sourced Config in
[ADR 0001](../match-mixer/docs/adr/0001-config-and-schedule-are-not-event-sourced.md), and
the rest in the engine itself. Read those before RR-2, RR-4 or RR-6; they supersede both
this section and the brief.

**Four facts the rows below still reason from**, kept here because they are cross-referenced:

1. **Tables are keyed on `(n, courts)`, not `n`**, and exist only where `courts === n / 4`.
   Anything else — fewer courts, `n` not divisible by 4, more rounds than a table holds —
   falls through to the greedy generator, seeded from the table's prefix counts when one
   exists. This is the fallback rule RR-6 inherits per pool.
2. **The roster floor is 4 and the ceiling is 32.** Above 32 the greedy search gets slow;
   below 4 there is no game. Since RR-6 both limits are per pool (ADR 0004), with
   `min(32 × pools, 64)` overall, because both reasons for the cap are reasons about one
   rotation and a rotation is now a pool.
3. **Do not paste a schedule in from the brief.** Its published n=8 table partners
   correctly but has players 0 and 1 facing each other six times — it scores 20 under the
   Scorer, not 0. Every table is validated by `schedule.test.ts` at full length and at
   every prefix. The warning is on the data in
   `src/components/apps/match-mixer/lib/engine/tables.ts`, which is where it will actually
   be read.
4. **Adding or amending a Table requires bumping `GENERATOR_VERSION`** in
   `lib/persistence/share-link.ts`, or a Share Link stops reproducing the board it named
   (#494).

**Three recommended answers above that did not survive building**, recorded so nothing
reasons from the superseded version:

- Item 5's "no generate button in the critical path" is wrong. #395 shipped as *draw on a
  button, not a keystroke*: the consequence line still updates live, the grid renders on
  an explicit press. It is now the Draw magnet, the only red fill on the surface
  (DESIGN.md).
- The partner matrix is **cut** (#477). Coverage in the summary line and a repeat boxed on
  the pair in the round it happens in stand in its place. CONTEXT.md says why, and says
  not to reintroduce it under another name.
- **Print is a demotion of the board, not the constraint that shapes it** (#482 to #489).
  The brief's "the grid is the interface" direction is superseded by DESIGN.md. Item 8's
  framing — print as the way a club actually uses this — is the half that stayed true; the
  part where print drives the markup is the half that did not.

### RR-2 · Courtside mode

**Size:** L. **Blocked by:** nothing. RR-1 is done, and RR-6, which it was ordered behind
on 2026-09-08 so it would be built once against the pooled shape instead of twice, shipped
2026-09-24. Row 8.

**The shape it builds on**, as shipped (ADR 0004): the generator returns a list of pools,
each its own Schedule off its own sub-roster, with its own Scorer and Bye accounting.
Courts are fixed per pool for the night and the Round count is global, so Round 3 is one
moment in the building across every pool. That makes a round lock naturally global, which
is the answer the reordering was protecting. Standings are per pool, since there is no
verdict for the night and no seeding across pools.

**Claim.** This is what separates best from good: the round timer keeps the phone open on
the bench, scores and standings make people come back, and late arrivals are the thing
every other generator gets wrong and the reason organizers give up and freehand it.

**Already decided.**
- Event log (cross-cutting). Locked rounds never reshuffle.
- Standings tiebreak: wins, then point differential, then head-to-head.
- Never auto-advance a round (Pickle Point Pal's "a ref needs a beat" precedent).

**Open questions.**
1. Round timer?
   ➡️ Per-round duration in config (default off; common presets 12 and 15 minutes). Timer
   state as events with timestamps, derived on tick like Pickle Point Pal's timeout clock,
   so a refresh doesn't lose it. Chime at zero. Wake lock while a round runs.
2. Score entry interaction?
   ➡️ Tap a game, a numeric keypad sheet, two scores, done. No text fields. Scores are
   optional per game; standings compute over what's entered.
3. Late arrival?
   ➡️ "Add player" mid-session appends to the roster, marks them absent for locked rounds
   (counted as byes for fairness), and regenerates only unlocked rounds seeded from the
   current partner, opponent, and bye counts. Undoable.
4. Early departure?
   ➡️ "Mark as left" from round r onward. Same regeneration. If a court would go short,
   the round drops a game rather than playing three.
5. When does a round lock?
   ➡️ Explicit "next round" tap by the organizer. Entering all scores does not lock.
6. Late arrival and early departure on a pooled board? (Added 2026-09-24, now that pools
   exist.)
   ➡️ Regenerate only the affected pool; the others' unlocked rounds do not move. On a
   dealt board the organizer picks the pool on "Add player" rather than the deal
   re-running, because a re-deal reshuffles everybody. A declared board already has an
   answer: the name goes under a `---`. Courts stay fixed for the night even if a pool
   can now fill one more, since a court is where people walk (ADR 0004).

### RR-3 · Share, roster memory, find-me, print — shipped

**Complete 2026-09-10**, across two initiatives. Roster memory (#396, plus clear-with-undo
in #441) and print (#397) landed early inside RR-1. The share link and find-me were specced
as #490 and ticketed #491 to #495: one reader for untrusted Config (#491), a link that
carries the board (#492), an address bar that never claims to be a board it isn't (#493), a
link minted before a generator change saying so (#494), and find-me (#495).

This was row 3, taken deliberately because it was the only remaining row both fully decided
and half a day. It did what the slot was for: it closed before the night rather than
sitting open across it.

**Three things that still govern rows below.**

1. **The URL encodes Config, not the Schedule** — seed, roster, courts, rounds, toggles —
   and regenerates deterministically. Scores stay out of the URL; RR-5 is where they get a
   backend, if ever.
2. **An absent field reads as its default**, which is what makes RR-6 cheap: a link minted
   today has no Pool Count, reads as `1`, and keeps working after pools land. The
   encoder was built with that in mind rather than retrofitted.
3. **A link that can no longer reproduce its board says so** (#494, via
   `GENERATOR_VERSION`). Any table change is therefore a visible event, not a silent one.
   This used to say RR-4 and RR-6 both owe it a bump. Neither did: both shipped with
   `GENERATOR_VERSION` still at 1. An absent Pool count is one pool and draws the board it
   always drew, because Pool A keeps the raw Seed and a one-pool Config does no deal at all
   (ADR 0004). `unchanged-boards.test.ts` holds that line with twelve links minted before
   pools existed.

### RR-4 · Constraint toggles (#391, shipped 2026-09-20)

**Size:** M. **Blocked by:** RR-1. Independent of RR-2 and RR-3. Shipped as #543
(fixed partners and the Format row), #544 (singles) and #545 (mixed doubles).
`match-mixer/CONTEXT.md` is the authority on what these are now, not this section.

**Claim.** Four toggles that each unlock a common format without turning the tool into a
mode picker: fixed partners, singles, skill balance, mixed doubles.

**What shipped instead: three, and not as four of a kind.** Skill balance was cut rather
than deferred. A lopsided skill pairing is transient — over eight rounds everybody
partners everybody, so it comes out in the wash — and that is exactly the argument mixed
doubles cannot make, since no amount of rotating turns two `M`s on one side into one of
each. So mixed doubles became a *hard constraint* inside rotating's seating and skill
balance got no cost term at all. Reopening it needs a new argument, not this section.

The "four toggles" framing also did not survive. Three of the four are not Formats
(ADR 0003): the row holds rotating, fixed partners and singles, and mixed doubles is a
checkbox that appears under rotating alone.

**Already decided.**
- Fixed partners and singles are separate generators (circle method), not cost terms.
  ✅ Both are, and they share one circle construction (`lib/engine/circle.ts`).
- ~~Skill balance and mixed doubles are cost-function terms on the rotating generator.~~
  Wrong on both counts: skill balance is gone, and mixed doubles is a hard constraint.
- No king of the court, no brackets. ✅ Still out of scope.

**Open questions**, as answered by the build.
1. How are toggles presented?
   ➡️ One "format" row above the textarea: rotating partners (default), fixed partners,
   singles, with mixed doubles a checkbox indented under rotating and cleared when the
   row moves off it.
2. Skill input?
   ➡️ Moot — skill balance is cut. The line-annotation mechanism it wanted got built for
   the marker anyway, so a future skill term would inherit a working parse.
3. Mixed doubles input?
   ➡️ An optional M/F marker on the line ("Sam M"), read **only while the box is
   ticked** — reading it unconditionally deletes the last initial from a roster that uses
   one to tell two Sarahs apart, and only for those two letters. Hard constraint, with
   two refusals that carry the arithmetic: how many lines are short of a marker, and what
   the counts cannot fill.

### RR-5 · Live score sync (v2, gated)

**Size:** L. **Blocked by:** RR-2, RR-3, and real usage of v1. Do not start before there
is evidence that organizers use scores.

**Claim.** The one feature that justifies a backend: everyone on the court sees the same
standings from their own phone.

**Already decided.**
- No accounts. An anonymous organizer token like On Deck's Volunteer Link model.
- Supabase, scoped to this tool's routes, same posture as Booking Buddy and On Deck.

**Open questions.** Not yet. Grill this only when it's next.

### RR-6 · Pools — shipped

**Complete 2026-09-24.** Grilled 2026-09-23 into ADRs 0004 and 0005 (#555), specced as
#392, ticketed #552 (the split and the board, PR #556), #553 (the Roster declares the
pools, PR #557) and #554 (reading a pooled board, PR #558). Live at `/tools/match-mixer`.

`match-mixer/CONTEXT.md` (**Pool**, plus the Roster, Config, Court, Round, Scorer, Share
Link, Find-me and Selection entries it amended), `DESIGN.md` (the Pool band) and the two
ADRs are the authority now. What follows is the grilled plan as it stood before building,
kept because RR-2 reasons from it. It built as written, with three additions:

- **The Impeccable pass happened inside 6.1.** Summary lines stack where the one line
  always sat, each opening on its pool's name. The band header is a vinyl strip with the
  name knocked out of it, and the name is sticky along the scroller's edge so a band
  scrolled half off keeps it. Banded fields hold each Game at a plate's width and let the
  scroller take the overflow rather than wrapping names onto three lines.
- **Headers win, visibly.** When the Roster declares pools, the Pool count control goes
  quiet and disabled and says the Roster set the split. A declared split is taken exactly
  as typed and never rebalanced.
- **6.3 was mostly already there.** Global-index Selections, the Pool count in the board
  identity and the other bands dimming all fell out of 6.1 and 6.2. What 6.3 added was the
  find-me line naming the pool first, and the CONTEXT.md entries for behaviour nobody had
  written down.

**Why it went ahead of RR-2.** Pools are not a feature layered on a Schedule, they change what a
Schedule *is*: one Schedule per Round becomes one per pool per Round, each with its own
Scorer and Bye accounting. RR-2 then builds an event log, a round lock, and standings on
top of a Schedule. Ordered RR-2 first, either courtside mode gets built once against a
single-pool shape and again after, or pools land as a second-class thing the lock does
not understand — a locked Round would have to mean "locked in Pool A," which is a
migration of the event log, not a new field. Ordered this way, RR-2 is built once against
the final shape. The cost of the swap is that courtside mode waits; the thing that makes
that affordable is that RR-2 is gated on nothing but attention, and no organizer is
waiting on it because nobody has used the tool on a Saturday yet.

Against RR-4 the order was genuinely free — each pool runs whichever Format is selected —
and it resolved itself: RR-4 shipped first, on 2026-09-19 to 2026-09-20, so it was built
on a Format row that already exists. What that costs here is that pools have three
Formats to run per pool rather than one, plus the mixed-doubles constraint; what it buys
is that none of them is a question this milestone has to answer.

**Claim.** A club night is often several simultaneous mini round robins sharing one set of
courts (a 4.0 group and a 3.0 group, or just too many people for one shared rotation) —
not a tournament. No seeding, no standings that feed a playoff; each pool is a complete,
self-contained round robin that happens to share courts and a printout with the others.

**Grilled 2026-09-23.** The durable record is `match-mixer/docs/adr/0004` (the engine
shape) and `0005` (who is in which pool), with **Pool** in `match-mixer/CONTEXT.md` (under
"Not built yet" at the time). This section is the summary; those are the authority. Four of the
"already decided" lines this section used to carry did not survive the pass, and they are
marked below so nobody builds from an old copy of the issue.

**Who is in which pool.** *Reversed:* assignment was going to be random off the Seed,
which cannot produce the 4.0 group and 3.0 group the claim above opens with. Now there are
two mechanisms. `---` lines in the roster box declare pools, optionally labelled
(`--- 4.0`); with none, a **Pool count** deals the Roster at random off the Seed and a
redraw deals again. Headers win when both are present. **Keep this split** writes the
current deal into the box as bare `---` lines so the organizer can move a name across. A
blank line is not a divider, because `parseRoster` drops them and chat pastes are full of
them. The deal deals the Format's own unit: Pairings in fixed partners, `M` and `F` as
separate queues under mixed doubles, Players otherwise.

**Courts.** *Reversed:* the remainder court was going to rotate between pools each Round.
Now allocation is fixed for the night: one court each, then each spare to whichever pool
sits out the most, capped at what it can fill. A court is where people walk, and a
rotating remainder also made every pool's column count change by Round. Fewer courts than
pools is refused; more than the pools can fill is not, and the board says which stand
empty. `Game.court` is rewritten to the real court number, so two pools never both say
court 1.

**Engine shape.** One layer above `generateSchedule` partitions, allocates, calls it once
per pool with the pool's own sub-roster, and returns a list of pools. The generator, the
Tables, the Scorer, the Itinerary and the grid never hear the word, which is what makes
every Format and mixed doubles work per pool for free and lets a pool of 8 on 2 courts get
the real n=8 Table. Pool A keeps the raw Seed, other pools derive theirs, and a one-pool
Config does no deal at all. That is what leaves `GENERATOR_VERSION` at 1.

**Limits and refusals.** 4 to 32 Players per pool, `min(32 × pools, 64)` overall. The
too-many message stops refusing and starts pointing: *40 names is more than one rotation
holds. Split into 2 pools or more.* Any pool's refusal refuses the whole board, naming the
pool, including a `---` on an odd boundary in fixed partners.

**Rounds.** One global count, as before. The default is the shortest pool's natural
length, capped at eight, which keeps the invariant that the default board never asks for
forced repeats. The consequence line names the pool that set it.

**Reading it.** Each pool has its own summary line off its own Scorer and there is no
verdict for the night. Find-me names the pool first in words and holds back the other
pools' bands. A Selection stays a global Roster index; the Pool count joins the board
identity.

**Layout.** *Reversed:* stacked sections, one per pool. Fixed courts and a shared Round
count make the night one table, so it is **one field with a column band per pool**, courts
in order across it. On a phone, where the grid already shows one Round at a time, Round 3
shows every court in the building instead of appearing once per pool. Print stays pure
CSS and goes landscape past `WIDE_BOARD_COURTS`; the cost, named on purpose, is that one
sheet carries every pool and a group cannot be handed its own page. The Impeccable
pass this line asked for (how a band reads when half of it is scrolled off, and where the
per-pool summary lines sit) happened inside 6.1; see the top of this section.

**Naming.** *Reversed:* "Pool A/B/C, not editable in v1". The label rides on the `---`
line, since the organizer is already typing the line it belongs on. Unlabelled pools keep
their letter.

**Transport.** The Pool count is the eighth number-line field, absent reading as one.
Headers travel inside the roster block under the checksum. A link never turns a dealt
board into a declared one.

**Tickets**, all closed.
- **RR-6.1 The split and the board.** Pool count in Config and link, the deal, court
  allocation, the pool layer, the banded field, per-pool summaries, limits, refusals,
  landscape print. The link ships here, not later: a pooled board that shares as a
  one-pool board is worse than no pools.
- **RR-6.2 The Roster declares the pools.** `---` and labels, Keep this split, the
  precedence rule, headers round-tripping through a link. After 6.1.
- **RR-6.3 Reading a pooled board.** The pool in the find-me line, band treatment,
  Selection identity. After 6.1, independent of 6.2. A banded board already dims
  correctly by accident; this makes it deliberate.

---

## What this doc does not decide

- Anything about Pickle Point Pal beyond the voice score calling idea (feature, not app;
  spec it separately if wanted).
- The coaching tools (match charting, shot decision trainer, practice plan builder, video
  comparison). They were discussed as the direction after these three. The one hook into
  this plan, RR-2's old bye-line question ("you're on scores for Court 2"), was cut on
  2026-09-06, so nothing here touches them now.
- Monetization. PRODUCT.md keeps that question open and nothing here should hard-code an
  answer.
