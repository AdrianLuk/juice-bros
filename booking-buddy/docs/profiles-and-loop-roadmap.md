# Booking Buddy: Profiles + Deepening the Game-Organizing Loop

Status: exploratory roadmap, not committed scope. Written 2026-08-31.

## Framing

Booking Buddy can feel thin, and the instinct is to grow it into a pickleball social
network (profiles, highlight reels, DUPR, tournament results). The conclusion here: the
*profile + rating* half is a natural extension of what already exists; the *social
feed / highlight reel* half is a different product with a different moat (network
effects, an empty feed, content moderation, video infra) and it competes with
Instagram/TikTok where pickleball clips already live.

"Feels thin" usually means the core loop — a friend group gets a game together — isn't
deep yet, not that it needs a second product. Friend requests + tiny profiles feel like
80% of a social network, but the missing 20% (a reason to open the app when you're *not*
scheduling a game) is the entire hard part.

So: build profiles out and tie them to the scheduling decision, pour the rest of the
energy into deepening the game-organizing loop, and only revisit a feed (group-scoped,
no cold-start) if people start opening Booking Buddy between games.

Principle for every profile field: it earns its place only if it changes how a group
picks or balances a game.

---

## Part 1 — Profiles, tied to the scheduling decision

`profiles` today holds only `display_name`, `username`, `gender`, `invite_token`.

Everything below is self-reported and nullable, readable by Connections (mirror the
existing `friend_visible_*` RLS pattern), writable by self.

### Fields to add to `profiles`

| Field | Why it touches scheduling |
|---|---|
| `skill_self_rating` (2.0–5.0, 0.25 steps) | The balance signal available *now*, no dependency |
| `dupr_id`, `dupr_rating`, `dupr_verified`, `dupr_synced_at` | Verified rating later (Part 3); manual entry first |
| `play_hand`, `preferred_format` (singles/doubles/either) | Matchmaking + who to invite |
| `style_note` (short free text), `paddle` (free text) | Profile context; `paddle` also feeds the Gear-page brand angle |
| `avatar_url` (Supabase Storage) | Recognition in Connection list / Response rows / calendar popovers |

Plus a `profile_places` join table (`profile_id`, `place_id`, `role='home'`) — reuse the
**Place** entity and `place-search.tsx` so "courts I play at" shares Google Place
identity with Orgs. Home-court overlap is a real "invite this person" input.

### Where it surfaces (the "tie to scheduling" part)

1. **Connection list + Find a time picker** — rating + home-court chips inline, so
   picking who to intersect availability with is informed.
2. **Slot ("Game") detail, Response rows** — show each responder's rating; give the
   organizer a derived **rating-spread line** ("2.75–4.0, wide"), never stored, exactly
   like **Capacity** and the gender-aware signal. Signal, not a gate (consistent with
   ADR 0001).
3. **Rating band on a Slot** — optional min/max, rendered in the Game title, extends the
   existing **division** concept. Soft: a yes outside the band shows a flag, doesn't
   block.
4. **Propose-a-game flow** — sort/filter connections by rating proximity + shared home
   court.
5. **Profile route** `/booking-buddy/u/[username]` — Connection-gated with a thin "not
   connected" state (respect ADR 0004: not a directory).
6. **Balanced-teams helper** (after ratings land) — given N yes-responses, suggest two
   teams minimizing rating gap. Pure function on the Slot detail page.

### Build steps (one branch + PR each)

1. Migration: add the columns + RLS (Connection-readable, self-writable).
2. Extend `Profile` type + `getOwnProfile`; add `updateProfile` action following the
   `updateGender` shape (small, isolated).
3. Settings page: profile-edit section.
4. `profile_places` migration + picker (reuse `place-search.tsx`).
5. `/booking-buddy/u/[username]` route, Connection-gated.
6. Surface rating + home-court on Connection list and the Find a time picker.
7. Slot detail: rating column on Responses + derived spread line.
8. Optional rating band on Slot (title + soft flag).
9. Avatars: Storage bucket + upload + display everywhere a name renders.
10. Balanced-teams helper (pure fn + Slot detail UI) — after Part 3, or after step 1's
    manual rating.

Ship steps 1–3 (manual `skill_self_rating`) before touching DUPR at all.

---

## Part 2 — Deepening the game-organizing loop

Ordered by leverage.

### A. Recurring / standing games

"Tuesday 8pm, every week." A `slots.recurrence_rule` (or a `Recurring Slot` template)
that auto-posts the next instance N days out, carries the regulars, and pings them to
respond. Single biggest retention lever — turns a one-off coordination tool into a
weekly habit and gives people a reason to open the app between games.

### B. Proactive "who's in?" nudges

Already have `looking` Availability Windows, Find a time, and the reminder cron with its
pure planner-function pattern. Add a planner: when 3+ connected friends have overlapping
`looking` windows and nobody has posted a Game, nudge one of them — "You and 3 friends
are free Thursday night. Propose a game?" Reuses the entire reminder stack.

### C. Regulars & history

Derive from past Slots + Bookings' **Players**: "Your Tuesday crew — Daven (14 games),
Sam (11)…". Pure aggregation, no new writes. Also the honest foundation for any
*group-scoped* social feed later (social inside a group you're already in — no
cold-start).

### D. Court-booking handoff

The real friction in CONTEXT.md. The Booking Reminder already nudges the organizer when
the window opens; add an "I'll book it" claim action on a bare-proposal Slot so
responders know it's handled, plus a "booked ✓" ping to yes-responders. Stays manual
(ADR 0002 holds).

### E. Standing-group availability digest

Weekly email per Friend Group: "here's when the Tuesday crew is free next week." Reuses
the reminder stack + Find a time aggregation.

Suggested sequence: **A → B → C**, then **E**; **D** whenever the booking-handoff
annoyance surfaces in real use.

---

## Part 3 — DUPR partner API

### What it is (from the partner SDK + docs portal)

- **Auth:** OAuth `clientKey` / `clientSecret`, auto-refreshed tokens.
- **Base URLs:** UAT `https://uat.mydupr.com/api`, prod `https://api.dupr.com/api`.
- **Relevant endpoints:** get player rating(s) by DUPR ID; resolve DUPR ID from email;
  rating history (paginated); match search by player; user search (location / rating
  range / age); **webhook subscriptions for rating updates**; plus match-create and
  club/event management not needed yet.
- Full docs sit behind a `@dupr.com` / `@mydupr.com` login — available once approved as
  a partner.
- Existing partners: Pickleball.com, PickleHeads, PlaybyPoint, ScoreHolio, Swish,
  Reclub, PlayerU, etc.

### Steps to apply

1. **Create a DUPR account + a free Juice Bros DUPR Club.** Partner vetting expects you
   inside their ecosystem. Clubs cost nothing.
2. **Email the partnerships team** — start at `support@mydupr.com` (ask for
   partnerships) or the contact form on the Club Resources page
   (<https://www.dupr.com/club-resources>). Pitch: what Booking Buddy is, rough user
   volume, the *exact* endpoints needed (email→ID lookup, get rating, rating history,
   rating-update webhook), and that it's **read-only display, not redistributing
   data**.
3. **Review the partnership agreement / API terms.** Focus on the clauses about: how
   long a rating may be **cached**, **attribution** requirements ("Powered by DUPR"),
   whether a user's rating may be shown **to their Connections**, and data-deletion
   obligations.
4. **Build against UAT** with the sandbox `clientKey` / `clientSecret`.
5. **Verification flow in-app:** user enters DUPR email or ID in their profile → resolve
   the DUPR ID → store `dupr_id`, `dupr_rating`, `dupr_synced_at`, `dupr_verified=true`
   → subscribe to the rating-update webhook (or poll weekly).
6. **Request production credentials** after they review the integration.

### Costs

No publicly published API fee. DUPR Clubs are free; API partnerships are negotiated
case-by-case. For a small free consumer app the common outcome is no or nominal fee, but
get it in writing. When emailing, ask directly about: any integration or annual fee,
rate limits, minimum-volume requirements, revenue-share expectations. Don't build a
roadmap around a number until they've given one.

### Interim (ship regardless)

Manual `skill_self_rating` field plus an optional `dupr_id` rendered as a link to the
user's DUPR dashboard — zero dependency, works today, and the verified rating slots in
behind the same UI later.

---

## Sources

- DUPR Club Resources — <https://www.dupr.com/club-resources>
- DUPR Clubs (free) — <https://www.dupr.com/clubs>
- API Partner Integrations, DUPR Zendesk — <https://dupr.zendesk.com/hc/en-us/categories/32142598126740-API-Partner-Integrations>
- DUPR partner API SDK (GitHub, Info-Esportes/dupr-partner-api) — <https://github.com/Info-Esportes/dupr-partner-api>
- DUPR API docs portal — <https://api.dupr.gg/api-explorer?group=public>
- DUPR × Playbypoint API partner announcement — <https://www.linkedin.com/posts/dupr_welcoming-our-newest-api-partner-to-dupr-activity-7153447641278767106-tVG0>
