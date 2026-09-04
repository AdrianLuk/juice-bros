# Next steps: Booking Buddy, On Deck, Round Robin Generator

Status: planning input, not committed scope. Written 2026-09-04.

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

The apps don't block each other, so alternate to keep momentum and let real usage inform
the next step.

| Order | Initiative | Why here |
|---|---|---|
| 1 | RR-1 Engine + plain output | Ships something new in a weekend, starts the SEO clock |
| 2 | OD-0 Run a real Saturday | Not code. Everything else in On Deck waits on this |
| 3 | BB-1 Recurring games | The retention lever that has been the top of the roadmap for two docs |
| 4 | RR-2 Courtside mode | Turns the generator into the thing that stays open on the bench |
| 5 | BB-2 Visibility default on accept | Cheap, removes the biggest onboarding cliff |
| 6 | OD-1 Venue resilience | Informed by what broke on Saturday |
| 7 | BB-3 Slot Link as the growth surface | Needs BB-1 to have a "next week" to hook onto |
| 8 | RR-3 Share, roster memory, print | Completes v1 of the generator |
| 9 | OD-2 Announce turnovers | Cheapest big win for a self-serve session |
| 10 | BB-4 Copy for group chat | Small, high-use |
| 11 | BB-5 Booker jobs + countdown | The moat, and the roadmap already has most of the spec |
| 12 | OD-3 Wait bands, OD-4 TV Display, OD-5 Recap image | Polish informed by two or three real sessions |
| 13 | RR-4 Constraint toggles | Fixed partners, singles, skill balance, mixed doubles |
| 14 | BB-6 PWA + push | Makes every time-sensitive nudge above actually land |

If only one thing per app ships this month: RR-1, OD-0, BB-1.

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

### BB-2 · Visibility defaults to `calendar` on accept

**Size:** S–M. **Blocked by:** nothing. **Needs:** `/grill-with-docs` (an ADR; this
changes the default of ADR 0007's lattice, not the lattice).

**Claim.** Two people accept a Connection and then see nothing until someone sets up a
Friend Group or an override. For a friend-group app, that is the biggest onboarding cliff
in the product. The lattice is correct for privacy and wrong as a default.

**Already decided.**
- The lattice (ADR 0007) stays. This is the default, not the model.
- Per-friend overrides and Groups keep working exactly as they do.

**Open questions.**
1. What does accept grant?
   ➡️ `calendar` (Slots and Availability Windows), symmetric, on accept. Stated in one
   line on the accept screen and in the Connection Request Email: "you'll both see each
   other's games and availability, change any time."
2. Retroactively widen existing Connections?
   ➡️ No. Offer a one-time dismissible banner on the Friends page: "share your calendar
   with all your current friends" as a single action.
3. What happens to the Groups page and the Visibility picker?
   ➡️ Keep both. Drop Groups from the primary nav, link it from Friends under an
   "advanced" affordance. The picker moves from "set up to see anything" to "restrict
   someone."
4. Does the Onboarding modal change?
   ➡️ Yes, remove any step that exists only because the default was `none`.

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
matters. Every code initiative below is gated on OD-0.

**Frozen for now:**
- Playing Style (deferred in the spec; Session Summaries decide whether the mismatch
  complaint is real).
- Scoring, results, anything cross-week (ADR 0001, ADR 0002).
- Team assignment inside a Foursome (ADR 0003).

### OD-0 · Run a real Saturday

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
3. After: pull the Session Summary (attendance, games, utilization, wait distribution,
   longest wait, skill mix). Write the retro: what broke, what people asked, what the
   volunteers would change.

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

**Size:** S–M. **Blocked by:** OD-0 (need one real Summary to design against).

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

### OD-6 · Self-serve Club creation

**Size:** M. **Blocked by:** OD-0 and at least one more real session. Don't onboard a
second club onto something that has run once.

**Claim.** Clubs are seeded by hand. The second tenant should create their own.

**Open questions.**
1. Flow?
   ➡️ Sign in → "Create your club" (name, venue, courts, group cap, Floor Mode) → printable
   Club QR page. Nothing else.
2. Abuse?
   ➡️ Ignore for now. One Club per account until someone asks.

---

## Round Robin Generator

The brief in `briefs/juice-bros-round-robin-brief.md` is adopted as the baseline: lookup
tables plus randomized greedy with a cost function, the partner matrix as proof, print as a
first-class output, "the grid is the interface" design direction, no database in v1. The
initiatives below sequence it and add what the brief is missing.

**Out of scope for the whole tool** (decided in conversation, don't grill):
king of the court, pools into brackets, accounts, chat, native app. Live score sync across
phones is v2 (RR-5) and gated on real usage.

**Cross-cutting decisions.**
- Event log from day one, even in RR-1. Roster, config, generate, lock round, score,
  arrive, leave are all events folded by a pure reducer, same as `reduceMatch` and
  `reduceSession`. Undo is dropping the last event. This is what makes RR-2's late
  arrivals cheap instead of a rewrite.
- Engine lives in a relative-imports-only module so `node --test` can run it (see the
  node-test-no-path-aliases note in memory and Pickle Point Pal's `lib/scoring/` rule).
- Route `/tools/round-robin`, catalogued in `src/data/apps.ts`, PWA plumbing like Pickle
  Point Pal once RR-2 lands.
- Tools are dev-led (Booking Buddy precedent). Design via Impeccable against the brief's
  direction; don't gate on Figma.

### RR-1 · Engine + plain output

**Size:** M (a weekend). **Blocked by:** nothing. **Needs:** `/grill-with-docs` (new
context: a `round-robin/CONTEXT.md` glossary for Roster, Round, Game, Bye, Lock, and the
product name).

**Claim.** Steps 1 through 4 of the brief. If the algorithm is right, a plain table is
already useful to a club. Ship that before polishing. Starts the SEO clock.

**Already decided.** Brief sections 1, 2, 3 (options), 6 (build order). Rotating partners
is the default and the v1 algorithm. Paste-a-list entry, one name per line.

**Open questions.**
1. Product name?
   ➡️ Pick during the grill. Whatever it is, the page title and H1 carry "pickleball round
   robin generator" for search.
2. Which precomputed tables ship in RR-1?
   ➡️ n = 8, 12, 16. Validate each with the scorer before trusting it. Everything else
   goes through the greedy generator.
3. Defaults for courts and rounds?
   ➡️ Courts = floor(n/4), editable. Rounds = enough for every player to partner everyone
   once where the math allows, capped at 10, editable. The live line under the textarea
   shows the consequence: "8 players, 2 courts, 7 rounds, everyone partners everyone once."
4. Min and max players?
   ➡️ 4 to 32. Above 32 the greedy search gets slow and nobody runs a 40-person rotating
   round robin on one schedule.
5. Zero-state?
   ➡️ The textarea is the first screen, with placeholder names. The schedule renders
   below it as you type. No wizard, no steps, no "generate" button in the critical path
   (keep one for re-seeding).
6. What does the stats line say?
   ➡️ Partner repeats, max opponent repeats, bye spread. The partner matrix renders at the
   bottom from RR-1, not later; it's the proof and it's cheap.

### RR-2 · Courtside mode

**Size:** L. **Blocked by:** RR-1.

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
6. The bye line?
   ➡️ "Sitting out: Sam. You're on scores for Court 2." One line, rotating the job among
   byes. On brand, and it's the on-ramp to a future match-charting tool.

### RR-3 · Share, roster memory, find-me, print

**Size:** M. **Blocked by:** RR-1 (RR-2 not required, but ship after it if close).

**Claim.** Completes v1. The share link puts the Juice Bros name in front of the whole
group every week; roster memory is the second-biggest reason an organizer comes back;
print is how half of rec centres still run this.

**Already decided.**
- The URL encodes the seed and config (players, courts, rounds, toggles), not the
  schedule. Regenerate deterministically. Scores are not in the URL in v1.
- Print stylesheet: black on white, hairlines, page breaks per round and per scorecard,
  no orange (brief section 4).

**Open questions.**
1. URL encoding?
   ➡️ Compressed JSON in one query param. Cap the name list so the link stays under
   2,000 characters; beyond that, fall back to a "names too long to share" message.
2. Roster memory?
   ➡️ Last five rosters in localStorage, "load last time" as the first affordance on a
   return visit, with a tap to remove the absent. No account, ever.
3. Find-me?
   ➡️ Tap any name and everything else dims; the name sticks in localStorage on that
   device. One tap to clear.
4. Per-player cards?
   ➡️ Yes, as a print view and as the find-me state on a phone ("You're on Court 2 in
   rounds 1, 3, 4, 6. Sitting out round 5.").

### RR-4 · Constraint toggles

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

---

## What this doc does not decide

- Anything about Pickle Point Pal beyond the voice score calling idea (feature, not app;
  spec it separately if wanted).
- The coaching tools (match charting, shot decision trainer, practice plan builder, video
  comparison). They were discussed as the direction after these three; the match charting
  hook (RR-2 Q6) is the only place they touch this plan.
- Monetization. PRODUCT.md keeps that question open and nothing here should hard-code an
  answer.
