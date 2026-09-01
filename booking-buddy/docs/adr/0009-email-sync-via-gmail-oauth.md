---
Status: accepted
---

# Email sync for Bookings via Gmail OAuth

ADR-0002 ruled out facility-platform API integration for Bookings and flagged CourtReserve's per-member iCal feed as the eventual revisit path — not email. We're extending that decision instead of following it: a "Sync from Email" feature reads the User's own Gmail inbox (OAuth, `gmail.readonly`, one account-level Mailbox Link per User — see [CONTEXT.md](../../CONTEXT.md)) for CourtReserve confirmation/cancellation mail from `notifications@courtreserve.com`, on demand when the User clicks sync. Matches become Import Candidates on a review screen the User must confirm before anything becomes (or removes) a real Booking, preserving CONTEXT.md's existing rule that a Booking "represents a reservation that exists," with no new unconfirmed state on the Booking entity itself.

**Why**: an iCal feed only gives confirmed reservations, with no cancellation signal CourtReserve documents; email gives both confirmation and cancellation from mail the User already receives, at the cost of an OAuth integration ADR-0002 never evaluated.

**Considered Options**:
- CourtReserve per-member iCal feed (ADR-0002's flagged path) — simpler auth (a pasted URL, no OAuth), but no cancellation signal; passed over for the richer signal email gives.
- Forwarding address (User sets a Gmail filter forwarding CourtReserve mail to a dedicated inbound-parse address) — avoids Google's verification requirements entirely, but needs new inbound-email infrastructure (Postmark/SendGrid) this repo doesn't have yet. Revisit this if the OAuth tradeoff below proves too costly.
- Full Google OAuth verification (CASA security assessment, then annual reverification) — rejected as disproportionate cost for a friends-only hobby app.

**Consequences**: `gmail.readonly` is one of Google's Restricted Scopes. Staying in Google's "Testing" publishing status avoids the CASA assessment but caps the app at 100 users and expires refresh tokens every 7 days — the sync button must handle an expired Mailbox Link and prompt reconnect roughly weekly. If Booking Buddy ever needs more than 100 Gmail-linked Users, this ADR needs revisiting: either pursue verification, or fall back to the forwarding-address alternative above.

**Extended by [ADR-0018](0018-email-sync-microsoft-provider.md)**: Outlook /
Hotmail (personal Microsoft accounts) added as a second Mailbox Link provider.
The on-demand review-screen design here is unchanged; ADR-0018 records the
Microsoft-specific OAuth choices (`consumers` authority, `Mail.Read` scope,
refresh-token rotation) and notes that the app-side allowlist below stays
Gmail-only.

**Addendum — app-side allowlist**: Google's Testing-mode test-user list already blocks OAuth consent for anyone not added in Cloud Console, but that list isn't queryable by the app at runtime, so it can't drive what the Settings UI shows — every User would see "Connect Gmail" and a non-test-user would hit Google's own "app not verified" block screen instead of anything in-app. Decided: a second, app-controlled allowlist (server-only env var of approved Usernames or account emails, following the same optimistic-UI/authoritative-action-check shape as `verifySession`) gates both the Settings UI and the `connectGmail`/`syncFromEmail` actions themselves. Usernames were chosen over User ids for editability — Adrian recognizes `@benbackhand`, not a UUID, when hand-editing the list. `isEmailSyncAllowed` checks the session's Username (via `profiles`, same lookup `getOwnProfile` already does) and account email (via `verifySession`) against the same list, entry-by-entry — a friend can be added by whichever identifier Adrian actually has on hand, typically their email, since a Username usually isn't known until the friend signs up and shares it. The tradeoff: a Username is User-changeable (see CONTEXT.md), so a friend who renames theirs silently drops off a Username-based entry until it's updated by hand — accepted, since the allowlist is already hand-maintained and small; an email-based entry doesn't have this problem, since a User's account email isn't changeable through the app. This is deliberately a separate list from Google's test users, not a mirror of it — being added to one doesn't add you to the other, and both need updating by hand to bring a new friend onto the feature.
