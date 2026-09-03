---
Status: accepted
---

# Consolidating an Import Candidate that arrives from both import sources

Extends [ADR-0009](0009-email-sync-via-gmail-oauth.md) and
[ADR-0019](0019-calendar-feed-second-import-source.md); supersedes neither. Both
still stand: an import source produces **Import Candidates** on a review screen
the User confirms before anything becomes a real Booking, and a Booking still
has no unconfirmed state.

This ADR records how the two independent import sources — the Mailbox Link
(ADR-0009) and the Calendar Feed (ADR-0019) — are reconciled on the review
screen when they both describe the same reservation (issue #348).

## Why

A User with a Mailbox Link *and* a Calendar Feed configured for the same
facility gets one real reservation shown **twice** on the unified "Sync
bookings" screen (#336): one `import` `ReviewItem` from the email parser,
carrying the Player(s) and the Details name, and one `CalendarFeedReviewItem`
from the feed parser, carrying neither (a real member feed has no player data —
`courtreserve-feed.ts`) and a thinner court label — the feed's `DESCRIPTION` is
`"Court #5"` where the email's Court(s) section is `"Court #5 - Hard"`.

ADR-0019 already added a **confirm-time duplicate guard** so confirming both
cards can't create two Bookings. That covers correctness; it does nothing for
the review experience — the User still reads, and acts on, the same booking
twice, and the "confirm one, watch the other turn into a silent no-op" flow is
confusing.

The two review lists can't be de-duplicated with `isDuplicateBooking`'s
four-field key (Org + court + date + start): the two sources genuinely disagree
on court text, and that disagreement is the whole reason a cross-source match
needs its own rule.

## Decisions

- **Merge into one card, don't just hide the duplicate.** The consolidated
  card takes the richer field from each side — Player(s), Details name and the
  fuller court label from the email; the VEVENT UID, `SEQUENCE` and `starts_at`
  from the feed — so nothing the User would want is lost. A "keep one, drop the
  other" dedupe would drop the players (if the feed card won) or the feed's
  cancellation-tracking identity (if the email card won).

- **Match on Org + date + start time, not court.** The same identity
  `matchCancellationToBooking` already uses, and for the same reason: court
  text is the field the two sources disagree on. An email `import` item pairs
  with a feed candidate when `email.matchedOrgId === feed.orgId` and the date
  and start time are equal.

- **Refuse to guess, the same way the rest of the feature does.** An email
  `import` item whose facility name didn't resolve to an Org
  (`matchedOrgId === null`) is **not** merged — there's no Org to key on, and
  guessing "same facility" from a date/time alone across a User's whole Org set
  is the kind of over-reach ADR-0011 and `matchCancellationToBooking` both
  avoid. It stays a separate card; picking the facility on it is the existing
  fallback. Likewise, if more than one candidate on *either* side shares one
  Org + date + start-time key (two courts booked for one group at the same
  time), none of that group is merged.

- **A `matchedOrgId === null` email import is a known, accepted gap.** In
  practice a configured feed means the Org exists and `matchOrgByName`
  normalises the two names to the same string, so the common case has a matched
  Org. The rare unmatched case shows two cards; the cost is one extra dismiss,
  not a wrong Booking.

- **The merge runs client-side, in `SyncBookingsSection`.** That is the one
  place both source lists are in hand at once — the two Server Actions
  (`syncFromEmail`, `syncFacilityFeeds`) stay independent, as ADR-0019 requires.
  `mergeImportCandidates` (`merge-import-candidates.ts`) is a pure function,
  `node --test`-covered, alias-free — same discipline as
  `import-candidate-shaping.ts`.

- **Confirming the merged card settles both sources.** `confirmMergedCandidate`
  (`actions/email-sync.ts`) is the union of `confirmImportCandidate` and
  `confirmFeedCandidate`: one `parseNewBooking`, the same confirm-time
  duplicate guard, one `insertValidatedBooking` (the email path — it carries
  the players), then **both** a `processed_messages` row and an `imported`
  `org_feed_events` row tied to that Booking. Dismissing writes a settled row
  on each side. It lives in `email-sync.ts` because it needs that module's
  private email-sync allowlist gate and provider resolution for the
  `processed_messages` row.

- **`reviewCalendarFeed` re-affirms an already-imported UID by UID, before the
  court match.** The merged Booking is saved with the email's richer court
  label (`"#5 - Hard"`), which the feed's own `"#5"` will never court-match on
  the next sync — so without this the reservation would be re-offered as a
  fresh import every time. A feed event whose UID is already an `imported`,
  Booking-linked seen row (and whose Booking still exists) is now auto-linked
  on sight. This also fixes the latent case of a feed whose court wording
  drifts over time. If the linked Booking was deleted, it falls through to
  normal matching and is correctly re-offered.

## Consequences

- The `org_feed_events` upsert (row shape + `owner_id,org_id,uid` conflict key)
  moved into a plain `feed-events.ts` module taking the Supabase client, so the
  merged confirm and `actions/calendar-feed.ts` share one implementation — a
  `"use server"` file can't export a non-action helper.
- One new analytics event, `bb_sync_merged_import` — a consolidated confirm is
  neither a pure email nor a pure feed import, so it gets its own event rather
  than double-firing both families' `_import` events.
- CONTEXT.md's **Import Candidate** entry records the consolidation.
