# An open Session is public to the venue

A Player joins On Deck by scanning the Club QR with no account, no sign-up, and
no auth session (ADR 0001, ADR 0005). Their phone, the snack-table Display, and
the courtside Kiosk all run the same `reduceSession` fold over the same event
log. So the log of a **currently-open Session**, and the Session row itself, are
readable by `anon` — enforced in RLS, not just left to application code.

A **closed** Session is not: once it closes, its roster is discarded and only an
anonymous Session Summary remains (ADR 0001), so there is nothing left for a
Player to read. The Club row, the Club's list of past Sessions, and every
operational **write** stay locked to the Organizer (and, later, to per-Session
Volunteer link tokens).

## Why this doesn't reopen Booking Buddy's Realtime problem

Booking Buddy keeps its coarse RLS net deliberately looser than its real
per-friend visibility rules and pushes the nuance into Server Actions, which is
why it can't expose Realtime safely (its ADR 0003). On Deck has no such gap for
an open Session: "everyone at the venue sees the whole board" *is* the rule, not
a coarsening of it. The event log carries only a first name plus last initial
and a self-declared Skill Level — the same facts already printed on the Display
tablet. There is no finer-grained view of an open Session being approximated, so
an `anon` read (and, later, an `anon` Realtime subscription) is the real
boundary, not a leak past one.

## Consequences

- The Club QR resolver and the live Session view are ordinary Server
  Components using the anon Supabase client — no `service_role` client, and no
  new authorization pattern.
- `on_deck_sessions` carries two SELECT policies rather than one OR'd
  predicate, so the `anon` path (`status = 'open'`) never reaches into
  `on_deck_clubs`, a table `anon` holds no grant on.
- The event log must never gain a column carrying anything the venue should
  not see. Playing Style (deferred past v1) is already marked "not shown
  publicly" for this reason.
