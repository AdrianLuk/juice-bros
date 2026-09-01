# Booking Buddy: Differentiating from Pickleball Game Maker

Status: exploratory roadmap, not committed scope. Written 2026-09-01.

Companion to [profiles-and-loop-roadmap.md](profiles-and-loop-roadmap.md) — that doc
deepens the core loop from the inside; this one frames the same work against a real
competitor and picks the fights worth having.

## The competitor

**Pickleball Game Maker** (Pickleball.com) — native iOS/Android, free download, organizer
pays $4.99–$19.99/mo. Center of gravity: discovering players you don't know and running
structured on-court sessions.

- Player network: search strangers by DUPR / age / gender / location, contact import,
  friend groups with in-app chat
- Game creation: singles/doubles/skinny singles, one-time or recurring, RSVP tracking,
  in-game chat, AI voice agent
- Organized-play engine: Round Robin, Scramble, King of the Court, DUPR rating sessions —
  rounds, rotating partners, leaderboards, standings
- Score recording + DUPR submission, head-to-head records, player stats
- Court discovery: map with distance, court count, amenities, pricing, "contact the
  facility" link
- Weather (wind, rain chance)

What it does **not** do: integrate with any facility reservation system. Court discovery
ends at a phone number. It assumes open play or that someone already holds the court.

## The wedge

Game Maker gets you games and players you don't have yet. Booking Buddy gets your
existing crew onto a court that's hard to book.

| | Game Maker | Booking Buddy |
|---|---|---|
| Core job | Find games/players, run league-style sessions | Get your existing crew onto a real court |
| Social model | Public discovery, cold matchmaking | Mutual connections only, no directory (ADR 0004) |
| Court reservation | Ignored (contact link only) | The whole point: real bookings, booking windows, CourtReserve email import |
| On-court formats | Deep (RR, Scramble, KotC, scoring, DUPR) | None |
| Platform | Native mobile, push | Web, email, guest RSVP by link, no install |
| Monetization | Organizer subscription | Free (funnel to the Juice Bros brand) |

Game Maker is a network + tournament-desk product. Booking Buddy is a logistics product.
A straight fight on their turf (network effects, an install base, Pickleball.com
distribution) is unwinnable for a solo dev. The turf they explicitly skipped is winnable.

---

## Track A — Own the court-reservation problem (the moat)

Game Maker's court feature ends at a phone number. No competition here.

### A1. CourtReserve iCal import path · medium · *see ADR 0002*

A second import route alongside the Gmail OAuth path (ADR 0009). CourtReserve publishes a
per-member iCal feed that needs no facility cooperation and no paid facility plan — ADR
0002 anticipated it before ADR 0009 took the Gmail route instead. Adding it back widens
the "my real reservations just show up" story that Game Maker has no answer to at all.

Shape: the User pastes their personal CourtReserve iCal URL onto an Org (or account-wide,
like the Mailbox Link). A cron fetch parses `VEVENT`s into the same **Import Candidate**
review pipeline (`reviewCourtReserveEmails` is already a pure function over parsed items —
the iCal parser feeds the same `ReviewItem` union). Cancellations show as feed deletions
rather than cancellation emails, so the netting logic needs an "event vanished from feed"
case. **This is the first thing to build.**

### A2. Designated bookers + court-target assignments · medium · *roadmap 2D*

**Seen in the wild.** The crew's WhatsApp thread already runs this by hand: the organizer
posts "help book tomorrow morning at VP Sept 10 7–9pm?" followed by a list — "Adrian Luk —
Court 8, Daven Wong — Court 9, Eugenia Jon — Court 2" — or splits a bigger group into
fours, one court per group ("Group 1: Ivan try court 3, Brian try court 4, Mark try court
1…"). Facilities cap reservations at one court per account and it's first-come the instant
the Booking Window opens, so the only way a group of twelve lands three courts is to have
three people all booking in parallel at open. Names can be placeholders ("Aaliyah
(Placeholder)") — the job gets assigned before the person is locked in. And a chunk of
those 7am jobs just don't happen: the person sleeps in, or never sees the message. The
group absorbs it (someone else grabs a court, or they play with fewer) and nobody makes a
thing of it — the tool should behave the same way.

The bare "one responder claims it, others stand down" claim is the small end of a range,
not the whole thing. What A2 needs:

- **Booker jobs on a Slot — one, or several.** A job is a User *or* a free-text name, an
  optional target court label, and an optional target Org. One job is the simple case:
  someone claims "I'll book it" and nothing else changes (this is roadmap 2D as written).
  Several jobs is the fan-out above — three people each targeting a court because one
  account can't hold three reservations. Same record either way; the count is just how
  many the organizer created. A target is a hint for the human racing the facility site,
  not a reservation — BB still books nothing itself (ADR 0002 holds).
- **Slot division seeds the multi-job case.** Reuse the gender/size division logic: N
  yes-responders → ⌈N/4⌉ courts → that many booker jobs, pre-labelled "Group 1 / Court ?",
  for the organizer to drop names and court numbers onto. A one-court Slot just seeds one
  job.
- **Countdown is per-booker.** A3's "Vaughan opens in 3h 12m" line reads "…— you're on
  Court 3" for an assigned booker and "…— Adrian, Daven, Eugenia are booking" for everyone
  else.
- **The target court is where you start, not what you have to come back with.** In practice
  a booker opens the facility site, finds Court 3 gone, tries Court 7, gets it — or fails
  their own target and grabs whatever's free, which might be a court that was someone
  else's target. That's not a mistake to flag; it's the job working. So: the target only
  seeds the "got it" form and the countdown line; the booker records the court they
  *actually* landed, any court, with no "that wasn't yours" friction. The assignments exist
  to spread people across the site at open, not to bind anyone to one court.
- **Live count so improvising doesn't overshoot.** Because bookers wander off-target, the
  Slot needs a running "3 of 3 courts booked — you can stop" (and the inverse, "still need
  one, grab anything"). A booker mid-scramble checks it before locking a fourth court
  nobody needs. If an extra court lands anyway, that's the existing over-Capacity signal
  for the organizer to resolve (keep it for rotation, or cancel it), not an error state —
  same as an over-capacity Response (see Capacity, ADR 0001).
- **Nobody-woke-up is the expected case, not the edge case.** Booking windows open at 7 or
  8am. People sleep through them — routinely, not exceptionally — and that's fine; the
  design has to absorb it structurally instead of leaning on the person to not fail. Two
  mechanisms:
  - **Cover, don't assign 1:1.** A court target can carry more than one booker — a primary
    plus one or two on cover. Whoever's awake at open grabs it and marks it booked; the
    rest see "Court 3 — got it, thanks" and go back to sleep. An early window just gets
    more cover per court. No single person is a point of failure, so no single person is
    "the one who blew it."
  - **Open jobs, not just named ones.** A job can sit unassigned — "Court 4 needs someone"
    — and any yes-responder can claim it from the Slot the moment they wake up and see it
    still open. The Slot is a shared board, not a rota with your name against a task you
    might miss.
- **Job states, once the window's open:**
  - **booked** — a booker taps "got it" and sets the court they actually landed (prefilled
    to the target, freely changed); a real Booking attaches. Yes-responders get the "booked
    ✓ — Court 8" ping against the real court, not the planned one.
  - **couldn't get one** — a booker taps it (courts gone, site crashed). Explicit, opt-in
    — never inferred.
  - **still open** — no word yet. This is the neutral resting state, not an accusation. BB
    can't tell "asleep" from "booked it, didn't tap", so it never narrates either. At most
    it sends *the assigned booker only* a soft, private nudge ("Vaughan's open — Court 3
    still needs grabbing if you're up"), and surfaces the job to other awake responders as
    claimable. It never posts "Adrian didn't book" to the group, and never tells the
    organizer someone "flaked".
  - **reassigned** — organizer or a responder picks up a still-open court. The Slot frames
    it as "Court 4 still needs a booker", not "covering for X". Original job just closes
    quietly.
- **Reconcile on the courts actually held, not the plan.** The Slot rolls up the real
  Bookings — courts 7, 8, 2 when the plan said 3, 4, 1 is a complete success, count and
  Capacity intact. Partial success is also a normal end state: 3 of 4 courts landed →
  Capacity is 12, not 16, and the organizer sees it spelled out as a group without a court
  ("Court 1 group — 4 people, no spot yet") with the claim/reassign action attached.
  Stated as a gap to close, not a person to chase.
- **No booking-side reliability signal, ever.** C3's flake read is about *showing up to
  play*; missing a 7am booking window is not the same thing and must not feed anything —
  no score, no history, no "usually misses" hint to the organizer. A "skip me for early
  windows" preference on the User is the only memory here, and it's self-set.
- **Stand-down still works.** Non-booker responders see "Adrian + 2 others are booking" and
  leave it alone — the double-book this kills is now a *group* each grabbing a random court
  instead of their assigned one, or two people both jumping the same still-open job.

Builds on the Booking Reminder, the pure-planner cron pattern (the soft post-open nudge is
just another planned send), multi-Booking-per-Slot and the derived-not-stored Capacity
with its over-capacity signal (both already modelled — see Booking, Capacity), and the
Slot division logic.

### A3. Booking-window countdown on the dashboard · small

The Org already carries a Booking Window. Surface it as a live countdown ("Vaughan opens
in 3h 12m"). Pair with A2: "…opens in 3h 12m — you're on Court 3."

### A4. Crowd-sourced booking-window facts at the Place level · medium

Today every User re-enters "opens 7 days out at 8am" per Org. Promote it to a shared fact
on the Google **Place**, so adding that facility inherits the window. A real data asset
Game Maker can't copy — they don't model reservations. Needs a moderation-light story
(last-editor-wins, or a confirm count).

---

## Track B — Standing games (retention, "why open it between games")

### B1. Recurring / standing games · large · *roadmap 2A*

"Tuesday 8pm every week." Auto-posts the next instance N days out, carries the regulars,
pings for RSVP. The single biggest retention lever, and also table-stakes parity with
Game Maker. Build before profiles.

### B2. Proactive "who's in?" nudge · small · *roadmap 2B*

When 3+ connected friends have overlapping `looking` windows and nobody's posted a Game,
nudge one of them. Reuses the entire reminder stack. This is the answer to "a reason to
open the app between games" — scheduling intelligence, not a feed.

### B3. Standing-group availability digest · small · *roadmap 2E*

Weekly email per Friend Group: "here's when the Tuesday crew is free next week." Reuses
Find a time aggregation + reminder delivery.

### B4. Regulars & history · small · *roadmap 2C*

Derive from past Slots + **Players**: "Your Tuesday crew — Daven (14 games), Sam (11)."
Pure aggregation, no new writes. Also the honest foundation for a group-scoped feed later.

---

## Track C — Money & reliability (friend-group pain Game Maker ignores)

### C1. Cost splitting · medium

Per-Booking cost, split across the Players who actually showed (already tracked separately
from RSVPs). "Who's paid" state. One-tap payment-request message to paste into the group
chat. Nobody wants to chase $7 e-transfers; Game Maker does nothing here.

### C2. Waitlist auto-fill · medium

Confirmed game hits Capacity, someone flips to no → promote a maybe / ping the group that
a spot opened. The Capacity model already gives the ceiling.

### C3. Flake-aware read (organizer-private) · small

The data model already separates "said yes" (Response) from "was on court" (Player).
Derive a quiet reliability signal for the organizer only. Never expose it to the group.

---

## Track D — Distribution

### D1. Seed Toronto facility data · ongoing, not code

Fill in booking windows for every Toronto facility already modelled. Get the local rec
scene using BB as the default, then expand city by city. Coordination tools win on local
density, not national breadth — the place a solo dev with a local podcast brand beats a
national app.

### D2. PWA + web push · medium

Closes most of the mobile gap without an app-store install wall. Makes the time-sensitive
nudges (A2, A3, B2) actually land. The email/guest-link model is already a distribution
advantage against an install wall; push is the missing piece.

---

## Sequence

1. **A1** — CourtReserve iCal import *(current target)*
2. **B1** — recurring games
3. **A2 + A3** — designated bookers + countdown
4. **B2 + B4** — nudges + regulars
5. **C1** — cost splitting
6. **D2** — PWA push
7. **A4** — crowd-sourced booking windows, once there are users to source it
8. **B3, C2, C3** — as the annoyances surface in real use

D1 runs in parallel with all of it.

---

## Explicitly out of scope

- **DUPR matchmaking / stranger discovery** — their moat, and ADR 0004 says BB is not a
  directory. Read-only DUPR *display* only (roadmap Part 3), never the graph.
- **On-court format engine** (Round Robin, Scramble, King of the Court, live scoring,
  standings) — a whole separate product and their core competency. Let a group open Game
  Maker for that hour; BB got them the court.
- **Freeform chat** — the group already has one. Structured Response comments + organizer
  updates on a Slot cover the real need without competing with WhatsApp.
- **Native mobile app + AI voice agent** — cost sinks. A PWA closes the gap.

## Sources

- Pickleball Game Maker — <https://pickleballgamemaker.com/>
- Game Maker on the App Store — <https://apps.apple.com/us/app/game-maker-pickleball/id6749895657>
- How to Download the Game Maker App, Pickleball.com — <https://pickleball.com/docs/en/article/how-to-download-game-maker-app>
- Game Maker on Google Play — <https://play.google.com/store/apps/details?id=com.pickleballgamemaker>
