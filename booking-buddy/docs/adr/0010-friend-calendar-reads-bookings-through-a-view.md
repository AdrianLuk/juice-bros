---
Status: accepted
---

# Friend calendar reads Bookings through a narrow view, not `bookings` itself

Phase 4's `orgs`/`bookings` migration states its access rule in its own comment: "Neither `orgs` nor `bookings` is friend-visible. A Booking reaches a friend only through a Slot it has been attached to." That held all the way through Phase 6 (`slot_bookings` copies a Booking's `format` for Capacity, but never facility, court, or time) — a friend has never been able to learn *where* or *when* an owner is booked, only *how many courts*.

The friend calendar (issue #61) needs exactly that: a Connection with `open_time` Visibility should see the owner's busy time with a facility name, independent of whether any Slot exists at all. That's a second, standing read path into `bookings`, not a Slot-shaped one.

**Decision**: Add `public.friend_visible_bookings`, a `security definer` view (the same non-`security_invoker` posture `slot_booking_windows` already established) exposing only `booking_id`/`owner_id`/`starts_at`/`ends_at`/`facility_name` — never `court_label`, and never a raw `bookings` or `orgs` row. Its `where` clause embeds `has_open_time_visibility(owner_id, auth.uid())`, the same function `availability_windows`'s read policy already uses, so the view adds no new predicate logic — it's a projection of an existing grant onto a table that grant didn't reach before. `facility_name` mirrors `orgDisplayName`'s own resolution (hand-typed name, else the cached Place's, else "Facility details unavailable") computed in SQL so the view can stand alone without handing the caller `orgs`/`place_cache` rows to resolve it themselves.

**Considered Options**:
- Extend `slot_bookings`'s pattern — give every Booking an implicit "Slot" so the existing Slot-visibility path covers it. Rejected: invents a fake Slot for every plain Booking, conflating two things CONTEXT.md is deliberate about keeping separate (a Slot is "the friend-facing unit," a Booking is a reservation that may never be proposed to anyone).
- A `security_invoker` view, or exposing `bookings`/`orgs` to `authenticated` more broadly and letting RLS do the filtering directly on those tables. Rejected: RLS on `bookings`/`orgs` is deliberately still pure ownership (Phase 4's own coarse net) and any number of other reads assume that; loosening it there to serve one narrow friend-facing projection would widen the blast radius of every other query against those tables, not just this one.

**Consequences**: `bookings`/`orgs` stay owner-only exactly as Phase 4 left them — this view is additive, built on top, not a change to their own RLS. Phase 4's "a Booking reaches a friend only through a Slot" is no longer literally true; the friend calendar is the one deliberate exception, and it's a read-only, five-column one. A friend with `open_time` Visibility now sees an owner's busy time regardless of Slot involvement, matching CONTEXT.md's own Availability Window entry ("a Booking... always wins and reads as busy") rather than requiring a Slot to exist first.
