-- Calendar Feed storage (issue #293, spec #288, CONTEXT.md's Calendar Feed
-- entry) — the second Booking-import source alongside the Mailbox Link. A
-- Calendar Feed is a User's pasted CourtReserve per-club `.ics` URL, held per
-- Org, fetched on demand when the User hits "Sync facilities". This migration
-- is storage + nothing else: no code reads or writes either of these yet
-- (`reviewCalendarFeed` is PR 3, `syncFacilityFeed(s)` is PR 4).
--
-- Two pieces:
--
--   1. `orgs.calendar_feed_url` — the pasted URL, encrypted at rest the same
--      way `mailbox_links.encrypted_refresh_token` is (token-encryption.ts,
--      AES-256-GCM, the existing MAILBOX_LINK_ENCRYPTION_KEY — the key's role
--      simply widens to cover this too; no new key, no env-var rename). The URL
--      carries a private member token, so a database leak must not expose it in
--      plaintext (spec #288, user stories 31/32).
--
--   2. `org_feed_events` — the per-feed seen-event history the cancellation
--      diff runs against. A dedicated table rather than an extension of
--      `processed_messages`: that store is write-once by design (insert/select
--      grants only, "recorded once and never revisited"), whereas the feed diff
--      needs a mutable row — `last_seen_at` bumps on every sync — and pruning,
--      as rows drop when their event ages past. The two models would fight in
--      one table.

-- 1. The feed URL, on the Org it belongs to. Nullable: most Orgs never get one.
-- Holds ciphertext only — the "iv.authTag.ciphertext" string encryptRefreshToken
-- produces (see token-encryption.ts), never the raw URL, and never selected
-- into anything a client component reads; the app column-picks rather than
-- `select("*")`, the same discipline `mailbox_links.encrypted_refresh_token`
-- already gets. Clearing a feed is `set calendar_feed_url = null`, which the
-- clear action pairs with deleting that Org's `org_feed_events` rows (app-level,
-- so a re-pasted URL later starts from a clean slate rather than diffing
-- against stale history — spec #288, user story 25).
alter table public.orgs
  add column calendar_feed_url text;

comment on column public.orgs.calendar_feed_url is
  'The Org''s CourtReserve calendar-feed URL (issue #293 / spec #288), '
  'encrypted at rest with the same key and utility as '
  'mailbox_links.encrypted_refresh_token — see token-encryption.ts. Ciphertext '
  'only; null for an Org with no feed. Server-decrypted in server-only code, '
  'never selected into anything the browser reads.';

-- 2. The seen-event history, one row per (Org, VEVENT UID) the feed has ever
-- shown this User.
--
-- `owner_id` is denormalized off `org_id`'s owner on purpose — it makes the RLS
-- policy a column comparison rather than a subquery on every row, the same
-- trade `bookings` and `slot_bookings` already make. `assert_org_feed_event_coherent`
-- below is what keeps the two from drifting apart.
create table public.org_feed_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  -- The VEVENT UID, verbatim from the feed. Stable across syncs for one
  -- reservation, which is what lets a diff notice one vanish.
  uid text not null,
  -- The VEVENT SEQUENCE. Recorded so a later slice can notice a bumped event,
  -- but v1 does nothing with a change beyond keeping the new value.
  sequence int not null default 0,
  -- The event's start instant — for the cancellation-window check (a vanished
  -- event only counts if its start is still in the future) and for pruning
  -- (rows drop as events age past).
  starts_at timestamptz not null,
  -- pending  — seen in the feed, not yet matched to or imported as a Booking.
  -- imported — matched to an existing Booking (however that Booking was made)
  --            or confirmed into a new one; `booking_id` is set.
  -- dismissed — the User dismissed this event's Import Candidate; it stays
  --            dismissed on later syncs even though it's still in the feed.
  status text not null check (status in ('pending', 'imported', 'dismissed')),
  -- The Booking this event settled to, set when status = 'imported'. Provenance
  -- for the cancellation diff: `on delete set null` so deleting the Booking
  -- leaves the seen-event row (the event is still in the feed) but drops the
  -- stale link.
  booking_id uuid references public.bookings (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  -- Bumped to now() every sync the event is still present — a mutable column,
  -- which is the whole reason this isn't in `processed_messages`.
  last_seen_at timestamptz not null default now(),

  -- One row per reservation per feed. The backing index's leading
  -- (owner_id, org_id) columns also serve the per-Org sync read — loading
  -- everything this feed has shown before diffing the fresh fetch against it.
  constraint org_feed_events_owner_org_uid unique (owner_id, org_id, uid)
);

comment on table public.org_feed_events is
  'Per-feed seen-event history for the Calendar Feed cancellation diff (issue '
  '#293 / spec #288). One row per (owner, Org, VEVENT UID). Mutable '
  '(last_seen_at bumps each sync) and pruned as events age past — which is why '
  'it is its own table rather than part of write-once processed_messages.';

-- `org_id` is the referencing side of an `on delete cascade`, which Postgres
-- does not index for you: without it, clearing one Org (or its feed) scans the
-- whole table. The unique constraint's index can't serve this — org_id isn't
-- its leading column.
create index org_feed_events_org_id on public.org_feed_events (org_id);

-- Likewise the referencing side of `booking_id`'s `on delete set null`:
-- deleting a Booking has to find the rows pointing at it to null them out.
create index org_feed_events_booking_id on public.org_feed_events (booking_id);

-- A seen-event row belongs to the same User as the Org it sits under, and any
-- Booking it links to is that same User's, in that same Org. RLS covers none of
-- this — the write is on `org_feed_events`, a table the User may write, and the
-- policy only checks `owner_id`, not whose Org `org_id` names or whose Booking
-- `booking_id` points at. Same shape and reasoning as `assert_booking_coherent`.
-- Fires on update too, so a row can't be edited into a state the insert would
-- have refused (the `on delete set null` on `booking_id` arrives as an update
-- that nulls the column, which passes the `booking_id is not null` guard).
create function public.assert_org_feed_event_coherent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.orgs o
    where o.id = new.org_id
      and o.owner_id = new.owner_id
  ) then
    raise exception 'an org_feed_events row can only sit under one of your own orgs'
      using errcode = 'check_violation';
  end if;

  if new.booking_id is not null and not exists (
    select 1
    from public.bookings b
    where b.id = new.booking_id
      and b.owner_id = new.owner_id
      and b.org_id = new.org_id
  ) then
    raise exception 'a feed event can only be linked to one of your own Bookings in the same org'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger org_feed_events_coherent
  before insert or update on public.org_feed_events
  for each row execute function public.assert_org_feed_event_coherent();

-- Row Level Security: the coarse net (ADR 0003) — "this is mine" and that is
-- the whole rule, matching `mailbox_links` and `bookings`.
alter table public.org_feed_events enable row level security;

create policy "a User manages only their own feed events"
  on public.org_feed_events for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Automatic table exposure is off on this project, so the grant is explicit.
-- All four verbs: the sync upserts rows (insert + update last_seen_at/status),
-- the review reads them, and the clear-feed action deletes them.
grant select, insert, update, delete on public.org_feed_events to authenticated;
