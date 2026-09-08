-- Pruning a seen feed event (issue #452) — no schema change, only two
-- descriptions catching up with what the table does and, in one clause, being
-- corrected outright.
--
-- `org_feed_events` has described itself as "pruned as events age past" since
-- it was created, here and in CONTEXT.md and in ADR-0019, and nothing pruned
-- it. The only deletes were the whole-feed purges when a Facility's feed URL
-- changes or is cleared. What the table actually had was rail 2 of the
-- cancellation diff, which *skips* a past-dated vanished UID rather than
-- deleting its row — a different thing wearing the same word. So the table
-- grew one row per VEVENT a feed had ever shown, per feed, for good.
--
-- The sharp end of that was the reason given here for the table's existence:
-- that pruning is "why it is its own table rather than part of write-once
-- processed_messages". The separation is right and the reason was not. What
-- actually separates them is that `processed_messages` records a *decision*,
-- once, and is granted only select and insert to prove it, while this table
-- records every event a feed has *shown* — decided or not — and rewrites the
-- row in place as the answer changes: `pending` becomes `imported` or
-- `dismissed`, `booking_id` is set and nulled, `last_seen_at` bumps every
-- sync. A write-once ledger keyed on an opaque message id has nowhere to put
-- a `starts_at`, a `sequence`, or a row that means "seen, undecided", which
-- are the three things the diff runs on.
--
-- The prune is now real. `pruneExpiredFeedEvents` (`feed-events.ts`) runs once
-- per "Sync facilities" run, ahead of the review's own read, and deletes a row
-- once both its reservation and our last sight of it are 90 days past. Two
-- conditions rather than one because `starts_at` is not the reservation's
-- start on every row — a confirm or dismiss whose form carried no readable
-- `starts_at` records the epoch — and forgetting one of those would re-offer
-- an event the User had already settled.
--
-- Nothing reads a row this deletes: the review drops a past-dated event before
-- it consults this table, and rail 2 only flags a vanished UID whose start is
-- still in the future. The one place the count of rows is load-bearing is rail
-- 4's proportional trigger, which measures a sync's cancellations against
-- every `imported`, Booking-linked row on file — a quarter of retention keeps
-- that denominator moving slowly while still bounding the table.

comment on table public.org_feed_events is
  'Per-feed seen-event history for the Calendar Feed cancellation diff (issue '
  '#293 / spec #288). One row per (owner, Org, VEVENT UID) — every event the '
  'feed has shown, decided or not. Its own table rather than part of '
  'write-once processed_messages because that store records a decision once '
  'and is granted only select and insert, where this one is rewritten in place '
  'as the answer changes (pending -> imported/dismissed, booking_id set and '
  'nulled, last_seen_at bumped every sync) and carries the starts_at and '
  'sequence the diff runs on. Rows are deleted when a sync prunes one whose '
  'reservation and last sighting are both 90 days past (issue #452), when a '
  'Facility''s feed URL changes or is cleared, or by cascade when the Org or '
  'the User goes.';

comment on column public.org_feed_events.starts_at is
  'The event''s start instant. Read by the cancellation diff''s in-window '
  'check — a vanished event only counts if its start is still in the future — '
  'and, paired with last_seen_at, by the sync''s age-out prune (issue #452). '
  'Rewritten from the parsed event on every sync that offers or links the '
  'event, and frozen once the row is dismissed; a confirm or dismiss whose '
  'form carried no readable value records the epoch, which is why the prune '
  'does not key on this column alone.';
