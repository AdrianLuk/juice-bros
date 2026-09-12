# Next steps: Booking Buddy, On Deck, Round Robin Generator

Status: planning input, not committed scope. Written 2026-09-04. **Third pass 2026-09-12,
the morning of the night itself.** Rows 1 to 3 are all shipped, OD-0 is tonight, and the
pre-night ordering rules the last two passes spent most of their length arguing toward
expire when it starts. Shipped initiatives are pointers now rather than copies: their
decisions live in ADRs, CONTEXT files and code comments, and this doc says where instead
of restating them. See **Shipped, and where it went** below.

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

Third pass, 2026-09-12. The two previous passes both sequenced around the booked Saturday,
and the whole point of that sequencing is that it is now spent: **OD-0 is tonight.**

The pre-night rules did their job and are recorded once, in the past tense, so this
section stops growing a new layer every time it is touched. They were: build only what the
night needs; let nothing be in flight across Saturday. Together they picked rows 1 and 3
and kept rows 6 onward out. What they leave behind is the one rule that has not expired:

- **The retro reorders everything below row 5.** Rows 6 onward are guesses until it
  exists. They were ordered *after* it on purpose, and the way to get this table wrong now
  is to start one because it is specced and the night is over but the retro isn't written.

For today specifically: nothing new starts. Print the sign, run the night, write the
retro. Rows 4 and 5 are the whole day.

✅ means shipped to master; a blank cell means not started.

| Order | Done | Initiative | Why here |
|---|---|---|---|
| 1 | ✅ | OD-6 Printed Club QR sign (slice 3 only) | Shipped 2026-09-08 (#463, PR #466). `/on-deck/home/qr` is now the sign itself, printing on Letter and A4, plus two open routes serving the bare code as a file for a print shop or a group chat. Nothing now stands between the booked night and its checklist except printing one |
| 2 | ✅ | RR-1 remainder (#394 to #397, plus #441) | Shipped 2026-09-07. All five tickets closed, plus an unplanned sixth (RR-1.6, clear-the-roster with undo). Match Mixer is live at `/tools/match-mixer` |
| 3 | ✅ | RR-3 remainder — share URL and find-me | Shipped 2026-09-10. Specced as #490 and ticketed #491 to #495, all closed inside one day. RR-3 is now complete on all four counts: print and roster memory landed early inside RR-1, the share link and find-me landed here. It cleared the gap in front of the night exactly as the slot intended, and nothing was left in flight across Saturday |
| 4 |  | **OD-0 Run a real Saturday — tonight** | Not code. The fixed point everything above was timed against and everything below is informed by. The last blocker was a row, not a commit: the first Club is seeded by hand and only the owner's own login can open a night, which #487 recorded and closed out on 2026-09-09 |
| 5 |  | OD-0 retro in `on-deck/docs/` | The actual deliverable of the night, and the only thing that should be written tomorrow. Until it exists the night's value decays to anecdote and rows 6, 8, 9 and 15 stay guesses. #469 shipped the reader, so the Summary's numbers come off `/on-deck/home/summaries` rather than out of a SQL client |
| 6 |  | OD-1 Venue resilience | The first thing the retro can aim. Do not pre-empt it |
| 7 |  | BB-1 Recurring games | Unchanged in importance, the retention lever for two docs running. It waits only because it can't be rushed by a date and On Deck can — and because it is the one L on the table, which makes it the exact shape of work rule one says not to have in flight on Saturday. It starts after the retro is written, not before |
| 8 |  | OD-2 Announce turnovers | Cheapest big win for a self-serve session, and the retro will say whether it's the right one |
| 9 |  | OD-6 Demo night, self-serve Club, first-night kit, landing flip (slices 1, 2, 4, 5) | Correctly *after* the night: slice 5 needs real Session Summary numbers, and the rest is second-club work |
| 10 |  | RR-6 Pools (#392) | **Deliberately ahead of RR-2.** Pools change what a Schedule *is* — one Schedule per Round becomes one per pool per Round, with its own Scorer and Bye accounting — and RR-2 builds an event log, a round lock, and standings *on top of* a Schedule. In the other order, courtside mode gets built twice, or pools arrive as a second-class thing the lock doesn't understand. Still `needs-triage`: wants `/grill-with-docs` for the pool-assignment UI and validation copy, plus an Impeccable pass on the multi-board layout against `match-mixer/DESIGN.md`. That thinking costs no branch, so it can happen any time |
| 11 |  | RR-2 Courtside mode | Turns the generator into the thing that stays open on the bench. Unblocked since 2026-09-07, but now sits above the Schedule shape RR-6 settles rather than underneath it |
| 12 |  | BB-3 Slot Link as the growth surface | Needs BB-1 to have a "next week" to hook onto |
| 13 |  | BB-4 Copy for group chat | Small, high-use |
| 14 |  | RR-4 Constraint toggles (#391) | Fixed partners, singles, skill balance, mixed doubles. Filed and open, `needs-triage`. Genuinely orthogonal to RR-6 — each pool runs whichever Format is picked — so the order between the two is free, and it stays behind because a club night that needs two pools is more common than one that needs fixed partners |
| 15 |  | OD-3 Wait bands, OD-4 TV Display, OD-5 Recap image | Polish informed by two or three real sessions |
| 16 |  | BB-5 Booker jobs + countdown | The moat, and the roadmap already has most of the spec |
| 17 |  | BB-6 PWA + push | Makes every time-sensitive nudge above actually land |

No row sits outside the order.

If only one thing per app ships this month: RR-1, OD-0, BB-1. Two of the three are now
settled — RR-1 on 2026-09-07, and OD-0 tonight, whatever it turns up. That leaves **BB-1
as the month's only remaining goal**, and it is deliberately the first non-On-Deck row
after the retro. It is also the one L on the table, which is why it never fit in front of
the night and does fit after it.

Worth naming while the table is this clean: rows 1, 2 and 3 are the first stretch where
what got built and what this table said to build are the same list. The earlier passes
diagnosed the opposite, and the diagnosis is what fixed it.

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
  a Session means her login is the only thing in the world that can open tonight — which
  is the sharpest argument the repo has for the co-organizer question parked under OD-6.
- **Booking Buddy import/sync hardening, and marketing-site work** — roughly two full days
  across 2026-09-07 and 2026-09-08, none of it on this table, all of it closed. Itemised
  in git and in the issue list; not re-listed here.

**The lesson the log actually produced.** Of everything built between this doc being
written and 2026-09-07, only row 2 came from the table — the rest was marketing polish and
Booking Buddy sync work the table doesn't govern. Writing that down is what moved row 1:
it shipped the next day, and it was half a day's work, which is the more useful half. The
deadline-shaped row had been sitting behind work that felt more urgent because it was
already in flight.

The test that came out of it, and the one thing here worth carrying past tonight:
**does the night or the retro fail without it?** The sign passed. The reader passed. OD-1's
venue resilience did not, because nobody yet knows which failure modes are real, which is
precisely what tonight is for. After the retro the test retires with the night, and the
rule in its place is the plainer one already in the interleave: rows 6 onward are the
retro's to order.

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

Diagnosis: every issue in the spec shipped (#238 through #351, all closed). It is
feature-complete for v1 and has never run a real Saturday. That's the only gap that
matters. Every code initiative below is gated on OD-0, except OD-6's demo night and
sign, which need no real session and de-risk our own first night.

**Frozen for now:**
- Playing Style (deferred in the spec; Session Summaries decide whether the mismatch
  complaint is real).
- Scoring, results, anything cross-week (ADR 0001, ADR 0002).
- Team assignment inside a Foursome (ADR 0003).

### OD-0 · Run a real Saturday

**Tonight, 2026-09-12.** Both blockers are closed: the printed Club QR sign shipped
2026-09-08 (#463), and the Club row — the one that was never a commit — was seeded
2026-09-09 (#487), owned by Vanessa. Nothing in the repo or the database is holding this
up. What is left is physical: print the sheet, and check the code scans off paper at the
distance a player will actually stand. Neither can be verified from a test suite.

One operational fact worth having in hand before doors open, from #487: `on_deck_clubs`
enforces one owner per Club and a Volunteer Link deliberately cannot start a Session, so
**Vanessa's login is the only thing that can open tonight.** If that is awkward in
practice, it is the single most useful thing the retro can say, because it is the live
argument for the co-organizer question parked under OD-6 and OD-1 Q3.

**Size:** not code. **Blocked by:** nothing. **Gates:** every other OD initiative.

**Claim.** One live session with TO Pickleball Club will produce a better next-steps list
than anything written here. Session Summary already captures the numbers.

**Already decided.** Hybrid Floor Mode (volunteer links plus Kiosk). The Organizer keeps
override from their own phone. Undo covers mistaps.

**Checklist to grill into a runbook** (output: a short retro in `on-deck/docs/`):
1. Before: print the Club QR on a sign, charge a tablet for the Display or Kiosk, create
   the Session ahead of time from Club defaults, share the Volunteer Link in the volunteer
   WhatsApp, decide who is the backup Organizer.
2. During: one person only watches and writes down every question a Player asks and every
   place a Volunteer hesitates. Screenshot the board at three points in the night.
3. After: read the Session Summary at `/on-deck/home/summaries` (attendance, games,
   utilization, wait distribution, longest wait, skill mix) - a screen as of #469,
   where this used to mean a SQL query. Write the retro: what broke, what people
   asked, what the volunteers would change.

**Open questions.**
1. Which mode for night one?
   ➡️ Hybrid, with the Kiosk on a tablet by the courts and the Display on the snack table.
   Volunteers as the safety net, not the plan.
2. Do you tell players it's new?
   ➡️ Yes, one sentence on the QR sign. Lowers the bar for feedback.

### OD-1 · Venue resilience

**Size:** M. **Blocked by:** OD-0 (the retro decides which failure modes are real).
**Needs:** possibly an ADR if Club gains multiple owners.

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
3. Organizer's phone dies: handoff token, or multiple Organizers per Club?
   ➡️ Multiple owners per Club. Simpler than a handoff, and a backup Organizer is a
   standing role at a real club anyway. Glossary: Organizer becomes "a person who owns a
   Club," plural allowed.
4. Session left open overnight?
   ➡️ Auto-close after N hours of no events with the Summary computed as if Last Call had
   fired at the last event. Currently "one open per Club" is enforced, so a forgotten
   Session blocks next week.

### OD-2 · Announce turnovers out loud

**Size:** S–M. **Blocked by:** OD-0.

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

**Size:** M. **Blocked by:** OD-0 (the Summary's wait distribution calibrates the bands).

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

**Size:** M. **Blocked by:** OD-0.

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

**Size:** S–M. **Blocked by:** OD-0 (need one real Summary to design against). The reader
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

### OD-6 · Organizer adoption: demo night, self-serve Club, the sign

**Size:** L across four slices (each M or smaller), one of them now done. **Blocked by:**
nothing for the demo; OD-0 for the landing-page social proof. Don't onboard a *second* real club
until at least two sessions have run, but the path can be built now.

**Claim.** Today an organizer can't evaluate On Deck, can't start it, and can't put it on
the wall without emailing us. The landing page's only real CTA is "Talk to us," a signed-in
organizer with no Club hits "created by hand, contact us," the Club QR is a raw URL, and
there is no way to see it work without a venue and 50 people. The gap is not features.

**Already decided.**
- Free, and say so plainly on the landing page.
- The demo is client-only: the real Floor, Display, and Kiosk components folding a canned
  event log of a 40-player night in the browser. No sign-in, no database, no abuse
  surface. The dev console (#351) is the precedent for simulated players; the demo does
  not touch it or the DB.
- `on_deck_clubs` keeps no direct write grants; creation goes through an RPC mirroring
  `on_deck_update_club_defaults`. One Club per owner stays.
- Co-organizers are additional owners per Club (same call as OD-1 Q3), not a handoff.

**Slices, in order.**
1. **Demo night.** Public route, no auth. Organizer taps "Game done" and watches the
   board move; can switch between Floor, Display, and Kiosk views of the same demo state.
2. **Self-serve Club creation.** Two required fields: club name, court count. Venue
   defaults to the club name, group cap to 4, Floor Mode to hybrid, all editable in
   settings. Lands on home with Start ready.
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
   pause anyone by hand, undo). Replace the hardcoded TO Pickleball Club section with real
   Session Summary numbers after OD-0.

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
   below 4 there is no game. RR-6 validates against `players / poolCount` for the same
   reason.
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

**Size:** L. **Blocked by:** RR-1 (done). **Ordered behind RR-6** as of 2026-09-08 —
not blocked by it in the dependency sense, but built once against the per-pool Schedule
shape instead of twice. See RR-6 for the reasoning.

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
   RR-4 and RR-6 both change what a Config generates, so both owe this a bump.

### RR-4 · Constraint toggles (#391, open)

**Size:** M. **Blocked by:** RR-1. Independent of RR-2 and RR-3.

**Claim.** Four toggles that each unlock a common format without turning the tool into a
mode picker: fixed partners, singles, skill balance, mixed doubles.

**Already decided.**
- Fixed partners and singles are separate generators (circle method), not cost terms.
- Skill balance and mixed doubles are cost-function terms on the rotating generator.
- No king of the court, no brackets.

**Open questions.**
1. How are toggles presented?
   ➡️ One "format" row above the textarea: rotating partners (default), fixed partners,
   singles. Skill balance and mixed doubles are checkboxes that appear only for rotating.
2. Skill input?
   ➡️ An optional number after the name on the same line ("Sam 4.0"). Parsed, never a
   separate form. Balance means minimizing the team rating gap within a game.
3. Mixed doubles input?
   ➡️ An optional M/F marker on the line ("Sam M"). Hard constraint (each team is one of
   each) with a clear message when the counts don't allow it.

### RR-5 · Live score sync (v2, gated)

**Size:** L. **Blocked by:** RR-2, RR-3, and real usage of v1. Do not start before there
is evidence that organizers use scores.

**Claim.** The one feature that justifies a backend: everyone on the court sees the same
standings from their own phone.

**Already decided.**
- No accounts. An anonymous organizer token like On Deck's Volunteer Link model.
- Supabase, scoped to this tool's routes, same posture as Booking Buddy and On Deck.

**Open questions.** Not yet. Grill this only when it's next.

### RR-6 · Pools (#392, open)

**Size:** M. **Blocked by:** RR-1. Independent of RR-3; orthogonal to RR-4's Format
toggle (rotating, fixed-partner, and singles each run once per pool). **Row 10**, and
**ahead of RR-2** — the one non-obvious edge in this section, settled 2026-09-08.

**Why ahead of RR-2.** Pools are not a feature layered on a Schedule, they change what a
Schedule *is*: one Schedule per Round becomes one per pool per Round, each with its own
Scorer and Bye accounting. RR-2 then builds an event log, a round lock, and standings on
top of a Schedule. Ordered RR-2 first, either courtside mode gets built once against a
single-pool shape and again after, or pools land as a second-class thing the lock does
not understand — a locked Round would have to mean "locked in Pool A," which is a
migration of the event log, not a new field. Ordered this way, RR-2 is built once against
the final shape. The cost of the swap is that courtside mode waits; the thing that makes
that affordable is that RR-2 is gated on nothing but attention, and no organizer is
waiting on it because nobody has used the tool on a Saturday yet.

Against RR-4 the order is genuinely free — each pool runs whichever Format is selected —
so RR-4 stays where it was, behind this, on the plainer argument that a club night
splitting into a 4.0 and a 3.0 group is more common than one wanting fixed partners.

**Claim.** A club night is often several simultaneous mini round robins sharing one set of
courts (a 4.0 group and a 3.0 group, or just too many people for one shared rotation) —
not a tournament. No seeding, no standings that feed a playoff; each pool is a complete,
self-contained round robin that happens to share courts and a printout with the others.

**Already decided.**
- **Pool Count** joins Courts, Rounds, and Seed as a Config field. `1` (default) is
  today's behavior — nothing changes for the existing user. `>1` partitions the Roster.
- **Assignment is random, off the existing Seed** — no new input, no mandatory skill
  ratings. Consistent with the glossary's rule that Roster order "means nothing." As even
  a split as the numbers allow (13 players / 3 pools = 5/4/4); "regenerate" reshuffles
  pools the same way it reshuffles everything else today.
- **Courts split evenly across pools**, remainder rotating which pool gets the extra
  court each Round, rather than a per-pool courts field. One fewer input; matches the
  brief's "no wizard" posture.
- Each pool gets its own Schedule, Scorer, and Bye accounting — a Bye in Pool A has
  nothing to do with Pool B's balance. `match-mixer/CONTEXT.md`'s Scorer definition
  ("this context's definition of fair") now applies per pool, not globally.
- Bracket, seeding, and standings-across-pools stay out of scope per the note above —
  this is RR-6 exactly because it's the non-bracket half of "pools into brackets."

**Open questions.**
1. Round count when pools land on different natural table sizes?
   ➡️ Rounds stays one global Config field (a time slot across every court, per the
   existing Round definition) — organizers running pools side by side expect to call
   "next round" once for everyone. Each pool's own generator fills its slice of that
   Round from its own table/greedy search, same fallback rule RR-1 shipped (tables keyed
   on `(n, courts)`, greedy seeded from the table prefix otherwise).
2. Minimum players per pool?
   ➡️ 4, same floor as the whole-roster minimum today. Below that a pool is nothing but
   byes. Validate against `players / poolCount`, not just total players — 15 players
   into 4 pools quietly produces a pool of 3.
3. Print/on-screen layout with more than one grid?
   ➡️ Stacked sections (Pool A's grid, then Pool B's, each with its own summary line) over
   one interleaved grid — keeps RR-1's grid markup and print stylesheet almost unchanged.
   **Simplified 2026-09-09 (#477):** this used to have to decide one matrix per pool
   against one combined, and with the matrix gone there is nothing to duplicate.
   **Re-aimed 2026-09-12:** the surface is no longer a grid on a sheet, it is The Board
   (#482 to #489), so the open question is what a second pool *is* on that board — a second
   framed board, or a divided one — and print follows from the answer rather than setting
   it. Still wants an Impeccable pass, now against `match-mixer/DESIGN.md` and not the
   brief.
4. Naming?
   ➡️ Pool A/B/C…, not editable in v1. A rename field is a cheap follow-up, not a blocker.

---

## What this doc does not decide

- Anything about Pickle Point Pal beyond the voice score calling idea (feature, not app;
  spec it separately if wanted).
- The coaching tools (match charting, shot decision trainer, practice plan builder, video
  comparison). They were discussed as the direction after these three; the match charting
  hook (RR-2 Q6) is the only place they touch this plan.
- Monetization. PRODUCT.md keeps that question open and nothing here should hard-code an
  answer.
