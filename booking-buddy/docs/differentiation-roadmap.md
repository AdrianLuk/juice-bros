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

### A2. Designated booker + "I'll book it" claim · small · *roadmap 2D*

On a bare-proposal Slot, one responder claims the booking job. Others see "Daven's
booking it" and stand down. When a Booking attaches, yes-responders get a "booked ✓ —
Court 3" ping. Kills the double-book and the dropped ball. Builds on the Booking Reminder
and the pure-planner cron pattern.

### A3. Booking-window countdown on the dashboard · small

The Org already carries a Booking Window. Surface it as a live countdown ("Vaughan opens
in 3h 12m"). Pair with A2: "…opens in 3h 12m — you're booking."

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
3. **A2 + A3** — designated booker + countdown
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
