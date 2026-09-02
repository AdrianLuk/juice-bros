---
Status: accepted
---

# CourtReserve calendar feed as a second Booking-import source

Extends [ADR-0002](0002-no-facility-platform-api-integration.md) and
[ADR-0009](0009-email-sync-via-gmail-oauth.md) — it supersedes neither.
ADR-0002's ruling stands: no facility-platform **API** integration, because a
member-scoped API needs the facility's paid cooperation. A CourtReserve
per-member calendar feed is not an API — it is a pasted `.ics` URL the member
already owns, needing no OAuth and no facility plan — so it sits outside what
ADR-0002 ruled out, and is in fact the "eventual revisit path" ADR-0002 and
ADR-0009 both named. ADR-0009's design also stands unchanged: an import source
produces **Import Candidates** on a review screen the User must confirm before
anything becomes, removes, or edits a real Booking; a Booking still has no
unconfirmed state.

This ADR records the decisions specific to adding the calendar feed as a
**second, independent import source** alongside the Mailbox Link (spec #288).

## Why

A User who deletes or filters their CourtReserve confirmation mail, is on a mail
provider Booking Buddy can't read, or simply won't hand over inbox access has no
automatic import path today — they retype every Booking by hand, the exact
friction the import feature exists to remove. The calendar feed reaches all of
them: it is not behind `EMAIL_SYNC_ALLOWLIST` (that gate only manages Google's
100-user Testing cap and has no analogue for a pasted URL), and it needs nothing
from the facility.

ADR-0009 passed the feed over for the Gmail route on one specific ground: "a
feed has no cancellation signal." That objection is what the feed-diff
mechanism below resolves.

## Decisions

- **Per Org, not account-wide.** CourtReserve issues one feed per club, so a
  feed's natural scope already equals an Org's. A consequence used throughout
  the feature: a feed event never needs `matchOrgByName` — the owning Org is
  known. Stored as `orgs.calendar_feed_url`.

- **A second, independent source — not a `MailAdapter`.** The feed has no OAuth
  and no mailbox; it shares only the downstream — the Import Candidate concept,
  the `ReviewItem` union, and the review UI components (the shared shaping
  helpers were pulled into a pure module in #291). It does **not** share a sync
  button or a review section with email sync; the two stay visually separate
  ("Sync from Email" vs "Sync facilities"). *(Superseded by #336: once #280
  also landed, the two sync buttons and review sections were unified into one
  "Sync bookings" action + list. The sources stay independent underneath —
  two Server Actions, two analytics event families, per-source failure
  reporting — only the UI merged.)*

- **Encrypted-URL storage, reusing the Mailbox Link key.** The feed URL carries
  a private member token, so it is encrypted at rest with the same utility and
  the same key as `mailbox_links.encrypted_refresh_token`
  (`token-encryption.ts`, AES-256-GCM, `MAILBOX_LINK_ENCRYPTION_KEY`). No new
  key and no env-var rename — the key's role simply widens to cover a second
  secret of the same kind. The URL is never written to logs or surfaced in
  error text.

- **The feed-diff cancellation mechanism.** Each sync compares the feed against
  what it showed on the previous sync, tracked in a dedicated `org_feed_events`
  table (one mutable row per seen VEVENT UID, `last_seen_at` bumped each sync,
  rows pruned as events age past). A reservation that was in the feed and has
  since vanished, or now carries a cancelled status, and which maps to a logged
  future Booking, becomes a **cancellation candidate**. This works whichever
  way the Booking was created — feed import, email import, or hand entry —
  because every parsed event is auto-linked to a matching Booking on every sync.

- **`org_feed_events` is its own table, not an extension of
  `processed_messages`.** The processed-messages store is write-once by design
  (insert/select grants only, "recorded once and never revisited"). The feed
  diff needs the opposite: a mutable `last_seen_at` and active pruning. One
  table cannot serve both models.

- **Four safety rails on the cancellation diff**, so a narrowed, broken, or
  swapped feed cannot quietly gut a User's records:
  1. **Healthy-fetch gate** — a non-2xx response, a timeout, an unparseable
     body, or a body with zero `VEVENT`s yields a sync error and **no diff
     runs**. A CourtReserve outage never reads as "every reservation
     cancelled." The diff only ever runs off a clean parse with at least one
     event.
  2. **In-window only** — a previously-seen UID counts as "vanished" only if
     its start is still in the future *and* at or after the earliest event
     still present in the feed. An event whose start has passed since the last
     sync is pruned silently and never flagged — a Booking is a historical
     record.
  3. **Explicit cancelled status is unconditional** — an event still in the
     feed carrying a cancelled status produces a cancellation candidate
     regardless of rail 2. CourtReserve telling us directly is always
     respected.
  4. **Sanity cap** — a sync that would flag more than a small absolute number
     (≈3), or more than ~50% of an Org's feed-tracked Bookings, surfaces a
     "this feed looks wrong — check the URL" warning instead of the
     cancellation candidates.

- **On-demand only in v1.** A "Sync facilities" action the User triggers,
  mirroring email sync's model (folded into "Sync bookings" by #336). No cron. The consumer-side feed-refresh delay
  CourtReserve documents (hours for Google Calendar, minutes for Apple) does
  not affect Booking Buddy — it fetches the feed live each sync — but a
  very-recently-made or -cancelled reservation may not be in the feed yet; the
  on-demand model makes that the User's call to sync again later.

- **Feed candidates are `import` and `cancellation` only.** No `update`
  (`SEQUENCE`-bump) kind in v1 — a changed event that already matches a Booking
  is left alone, though its new sequence is still recorded.

## Consequences

- The server makes an outbound HTTPS request to a URL the User pasted, which
  needs SSRF hardening (CourtReserve host allowlist, `https:` only, redirects
  rejected, request timeout, response-size cap, no cookies or auth headers).
  The allowlist is widened by an optional `CALENDAR_FEED_ALLOWED_HOSTS` env
  var whose only purpose is pointing tests at a mock server — the same
  test-only host-override shape `GMAIL_API_BASE_URL` already carries, with the
  same accepted risk.
- The duplicate-Booking check, until now applied only when shaping the review
  list, also has to run inside the confirm action(s) — confirming an email
  candidate and then a feed candidate for the same slot must not create a
  second Booking.
- The `SUMMARY` / `LOCATION` / `DESCRIPTION` → court / format / name / players
  mapping was deferred until a real CourtReserve member feed had been captured,
  the same "verify once against reality" step ADR-0009 records the email parser
  needing (it was first built against a wrong guess). Finalised in #292 against
  a real Vaughan Pickleball feed.
