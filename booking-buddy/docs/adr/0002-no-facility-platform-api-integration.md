# No facility-platform API integration for Bookings

The original brief considered pulling bookings automatically from third-party facility platforms like CourtReserve. Research found CourtReserve's API is organization/club-level only — it requires the *facility* to be on a paid plan and issue API keys — with no member-facing OAuth path for a consumer app to pull just one user's own reservations; other platforms surveyed (PlayByPoint, Skedda) show the same shape. CourtReserve does offer a documented per-member iCal feed export, which doesn't require facility cooperation.

**Decision**: Org and Booking data is entered manually by the User in v1. No CourtReserve or other facility-platform API integration.

**Why**: No free, member-scoped API exists on any platform surveyed; a real integration would require the facility's cooperation and likely payment, which isn't worth it to ship v1. Manual entry is unblocked today.

**Status**: proposed for v1; the direct facility-platform API integration ruled out here still stands. Revisited via two paths, neither an API: [ADR-0009](0009-email-sync-via-gmail-oauth.md) reads the User's own inbox for CourtReserve confirmation/cancellation mail, and [ADR-0019](0019-calendar-feed-second-import-source.md) takes the per-member iCal feed this ADR originally anticipated — as a second import source alongside the email path, with a feed-diff mechanism supplying the cancellation signal the feed lacks on its own.
