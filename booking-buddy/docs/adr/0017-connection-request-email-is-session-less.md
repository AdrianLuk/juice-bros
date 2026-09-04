---
Status: accepted
---

# The friend-request email's Accept / Decline links need no session

A friend request in Booking Buddy was silent (issue #228): the addressee only found it by visiting `/booking-buddy/friends`. Since a Connection is the precondition for every social feature — shared availability, Slot invites, Find a time — an unnoticed request is a dead end, most acutely in the cold-start case where someone signed up specifically because a friend asked them to. The fix is an email the moment a pending request is created, with **Accept** and **Decline** links that work in one click straight from the inbox.

The question this ADR settles: does clicking that link require the recipient to be signed in first?

**Decision**: No. The link is `/connect/<token>`, where `token` is a single-use `connection_request_links` row minted by an `after insert` trigger on `connections`. Opening the link needs no Supabase session; the token itself is the authorization, the same posture ADR 0003 and the Slot Link work (`/s/<token>`, `guest_rsvp_log`) already established for a comparable low-stakes action. `connection_request_links` is `service_role`-only — no `authenticated`/`anon` grant at all — so the whole Accept/Decline flow runs through admin-client Server Actions that check the token before touching a row, and the requester in particular can never read a token to accept on the addressee's behalf. The link's GET only ever *renders* a confirm page; the mutation is a POST, so an inbox link-prefetcher or mail scanner cannot act. The token is valid only while the request is `pending` and is burned (`consumed_at`) on first use.

**Considered Options**:
- **Require sign-in, then auto-apply the action.** Rejected as the default: the recipient may only ever have used Google or magic-link sign-in and hitting a password wall is friction on exactly the flow meant to remove it, and the invite-link cold-start recipient may have no habit of signing in at all. A sign-in gate can be layered on later without reworking the token, so this stays available if abuse ever justifies it.
- **A token column on `connections` itself** rather than a side table. Rejected: `connections`' select policy makes a row readable by *both* parties, so the requester could read the token and accept their own request — breaking the mutual-accept model. A `service_role`-only side table is the only place a token is safe.
- **Just link to the Friends page** (no one-click). Rejected by the issue: the point is to accept from the email.

**Consequences**: A leaked email (forwarded, compromised inbox) can accept or decline one friend request. The blast radius is bounded: accepting only *creates a Connection* with a known, named person whose identity is in the request, and the Connection can be removed at any time. `connections` now carries a trigger and a dependent `service_role`-only table; the trigger fires on every pending insert regardless of which of the three creation paths ran, matching the "database trigger, not app bookkeeping" reasoning the default-facility mark uses. The email reuses the Reminders delivery stack (Resend, `REMINDER_FROM_EMAIL`) and adds no new env var. It has its own `notification_preferences.connection_request_email_enabled` opt-out, independent of the two Reminder toggles.

## Amended by [ADR 0021](0021-visibility-default-is-calendar.md)

The original Consequences leaned on Visibility defaulting to `none`: *"accepting only creates a Connection — it exposes nothing on its own."* That is no longer true. Since ADR 0021, accepting a Connection also opens `calendar` visibility in both directions by default, so a leaked Accept link now hands the requester the acceptor's games and Availability Windows (and vice versa) until the Connection is removed.

This is judged an acceptable nuisance rather than a breach, and the link stays session-less: the exposed data is a pickleball calendar (games and free/busy blocks, never court labels or raw rows — issue #61), the requester is named in the email, the leak paths are low-likelihood, and the Connection is one tap to remove. The sign-in gate this ADR kept in reserve ("can be layered on later without reworking the token") remains the fix if Booking Buddy ever carries higher stakes.
