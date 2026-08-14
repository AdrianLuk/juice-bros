# Slot's Booking is optional

Booking Buddy needs to replace WhatsApp-style "who can make X date, yes or no" polls, which happen *before* anyone has reserved a court — but Slot was originally designed to always require a Booking (a real facility reservation), which can't represent that pre-booking phase.

**Decision**: Booking is optional on Slot. A Slot can exist as a bare proposal (date/time only, no Org/court) accepting Responses, then have one or more Bookings attached later once a court is actually reserved — it's the same record throughout, with no separate Poll or Event entity promoted at any stage.

**Why**: Consistent with the existing rule that a Slot never changes identity as it moves through its lifecycle (see [../../CONTEXT.md](../../CONTEXT.md)), and avoids "conversion" logic between a lightweight poll and a real event.

## Consequences

Capacity is only enforceable once a Booking is attached. "Yes" Responses collected during the bare-proposal phase can end up exceeding a later-attached Booking's capacity — this is surfaced to the organizer as an over-capacity signal to resolve manually (e.g. book a second court), not handled by an automatic waitlist.
