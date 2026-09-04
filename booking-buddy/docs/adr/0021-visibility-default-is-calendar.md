---
Status: accepted
---

# Visibility defaults to `calendar`; the lattice floor is a per-User setting

[ADR 0007](0007-visibility-is-a-lattice-not-a-scale.md) models Visibility as two
independent grants and fixes the floor at nothing: *"A friend in no Group and with no
override sees nothing."* That floor is correct for privacy and wrong as a first-run
default. Two people accept a Connection and then see nothing about each other until one of
them builds a Friend Group or sets a per-friend override — and Friend Groups feed
*nothing else* in the app, so the whole "set up a group" step exists only to undo the
`none` default. For an app whose entire premise is coordinating games between friends who
have already connected, that is the biggest onboarding cliff in the product.

This ADR changes the default. It does not change the lattice.

## Decision

### A per-User setting, `calendar` by default

A new column `profiles.default_friend_visibility` (`visibility_level`, `not null`,
`default 'calendar'`) is the **floor** the resolver applies when a Connection has no
per-friend override and no qualifying Friend Group — replacing the hardcoded `none` base
case. `calendar` grants both Slots and Availability Windows, symmetric (each side's own
default governs what the other sees), effective the moment the Connection is accepted on
any of the three accept paths (Friends page, session-less `/connect/<token>`, first
signup through an Invite Link).

It is a live setting, not a stamp: lowering it later moves every friend who is still on
the default, and raising it re-opens them. This is the reason it is *not* implemented as a
trigger that writes a `visibility_overrides` row at accept time — that would overload
"override" (which the glossary reserves for an explicit per-friend exception and calls
"the only way to shut one person out"), would leave the picker's "use my default" with
nothing to fall back to, and would freeze each Connection at whatever the default was on
its accept day.

### Both resolvers learn the floor

- `resolveVisibility` / `resolveVisibilityByConnection`
  (`src/lib/booking-buddy/visibility.ts`) take the owner's `defaultLevel` and use it as
  the reduce seed instead of the implicit `none`. An explicit override still wins outright
  in both directions; Friend Group grants still union on top.
- The two SQL mirrors — `has_slot_visibility` and `has_open_time_visibility`
  (`SECURITY DEFINER`, the privacy boundary, [ADR 0004](0004-user-search-is-not-a-directory.md)-level
  scrutiny) — gain one branch inside the existing `coalesce(override_check, …)`: after the
  Friend Group `exists`, `or` a lookup of `profiles.default_friend_visibility` for the
  owner. Override-of-`none` still beats the default because the override subquery returns
  a non-null `false` and short-circuits the `coalesce`. `friend_visible_bookings` and the
  friend-calendar reads sit on these functions and inherit the change for free. pgTAP
  coverage in `supabase/tests/` is the acceptance bar for this part.

### Migration backfills everyone to `calendar`

Every existing `profiles` row is backfilled to `calendar`, not preserved at `none`. All
current accounts are the developer's own test accounts; there is no userbase whose
exposure could change under them, so the "preserve existing behaviour + one-time opt-in
banner" path (which the planning doc's first draft proposed) is scaffolding for a
situation that does not exist. If Booking Buddy has real users before a comparable default
change ships again, that change carries its own comms step.

### Friend Groups are demoted, their levels near-vestigial

Because grants only ever union and nothing sits above `calendar`, a Friend Group's
`default_visibility` now does nothing for a User on the `calendar` default — it only bites
for someone who has lowered their global default below `calendar`. Groups are kept intact
(the table, the resolver branch, the route) because BB-1 (recurring games) reuses them,
but:

- The **Groups pill is removed from `BbSectionNav`**; `/booking-buddy/groups` stays a
  working route reached by an "advanced" link on the Friends page. This continues
  [ADR 0016](0016-two-tier-app-navigation.md)'s two-tier nav — one section loses its
  second child — and is a consequence of this decision, not an independent nav call.
- The **per-friend visibility picker** (`friend-visibility.tsx`) is reframed from "set up
  what this person can see" to "limit what this person sees": the `clear` option is
  relabelled from "Use my group defaults" to "Use my default", and the level list reads
  restriction-first. No resolver change.

### The default is stated where consent happens

The one-liner *"you'll both see each other's games and availability, change any time"*
appears on the Connection Request Email, the `/connect/<token>` confirm page, and the
in-app Accept control. The Connection Accepted Email carries a shorter note back to the
requester. Nothing is added at request-send time. The new setting's control lives in a
section at the top of the Friends page.

## Consequences

- [ADR 0007](0007-visibility-is-a-lattice-not-a-scale.md)'s "sees nothing" consequence
  bullet is amended to point here.
- [ADR 0017](0017-connection-request-email-is-session-less.md)'s blast-radius argument
  ("accepting exposes nothing because Visibility defaults to `none`") no longer holds; its
  Consequences are amended. Session-less accept stays — a leaked Accept link now yields
  mutual `calendar` visibility with a named, removable Connection, judged an acceptable
  nuisance rather than a breach for a pickleball calendar. A sign-in gate on the link
  remains available if stakes ever rise.
- CONTEXT.md's **Visibility** entry loses "a friend in no Group and with no override sees
  nothing" and gains the per-User default; the **Friend Group** entry notes the levels
  only bite below the default.
- `visibilityLabel` copy is corrected from "Slots" to "games" to match the Slot → Game
  product rename (ADR 0016); a small independent cleanup carried by this work.
- The privacy page's "Bookings, Slots, and friends" section gains a sentence on the
  default.
- No new analytics event. BB-2 removes a drop-off point rather than adding a step;
  `bb_slot_first_response` rates are the success signal, observed not instrumented.
- The `visibility_level` enum is unchanged — all four values already exist (ADR 0007).
