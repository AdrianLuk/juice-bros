# No facility-platform API integration for Bookings

The original brief considered pulling bookings automatically from third-party facility platforms like CourtReserve. Research found CourtReserve's API is organization/club-level only — it requires the *facility* to be on a paid plan and issue API keys — with no member-facing OAuth path for a consumer app to pull just one user's own reservations; other platforms surveyed (PlayByPoint, Skedda) show the same shape. CourtReserve does offer a documented per-member iCal feed export, which doesn't require facility cooperation.

**Decision**: Org and Booking data is entered manually by the User in v1. No CourtReserve or other facility-platform API integration.

**Why**: No free, member-scoped API exists on any platform surveyed; a real integration would require the facility's cooperation and likely payment, which isn't worth it to ship v1. Manual entry is unblocked today.

**Status**: proposed for v1; revisit for a later phase via the CourtReserve iCal feed approach, which needs no facility partnership or payment.
