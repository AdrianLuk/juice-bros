-- Dismissed reservation (issue #437) — the slot a User said no to on the
-- "Sync bookings" review screen, recorded once so **both** import sources
-- honour the decision.
--
-- Why a new table rather than columns on `processed_messages`: the two sources
-- settle in two different stores. Dismissing an email writes a
-- `processed_messages` row, dismissing a feed candidate writes an
-- `org_feed_events` row, and neither review reads the other's. A confirmed
-- candidate self-heals from that because it leaves a Booking behind and #432
-- taught both sources to recognise a Booking across their differing court text
-- ("#9 - Hard" from the email, "#9" from the feed). A *dismissed* one leaves
-- nothing to recognise — `processed_messages` stores an opaque provider
-- message id and no slot at all — so the feed re-offered the same reservation
-- stripped of the Players the email carried, and the email re-offered a
-- reservation already dismissed from the feed.
--
-- Hanging the slot off `processed_messages` would have fixed one direction
-- only: `org_feed_events` has no court and no wall-clock slot, so the feed
-- could never record a dismissal the email side would recognise. One shared
-- table both sources write and both reviews read makes the rule symmetric and
-- keeps the identity in exactly one place.
--
-- The stored slot is wall-clock (`slot_date` + `slot_start_time` in the Org's
-- own zone) rather than an instant, because that is what the cross-source
-- identity compares — `isSameReservation` in `import-candidate-shaping.ts`,
-- the same Org + date + start + court-number key the duplicate check and the
-- feed auto-link use. Court is kept as the source's own raw text; the
-- comparison normalises it to a court *number* at read time, so the email's
-- "#9 - Hard" and the feed's "#9" agree without either being rewritten here.
--
-- Write-once, exactly like `processed_messages`: a dismissal is a decision
-- recorded and never revisited, and there is no "un-dismiss" through this
-- table. Dismissing a *cancellation* candidate writes nothing here — that
-- means "keep the Booking", not "I don't want this reservation".

create table public.dismissed_reservations (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized off `org_id`'s owner, same trade `bookings` / `org_feed_events`
  -- already make: RLS becomes a column comparison instead of a subquery.
  -- `assert_dismissed_reservation_coherent` below keeps the two in step.
  owner_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  -- The reservation's own wall clock in the Org's zone — `YYYY-MM-DD` and
  -- 24-hour `HH:MM`, the shape both reviews already compare candidates on.
  slot_date date not null,
  slot_start_time time not null,
  -- The dismissing source's own court text, verbatim and unnormalised. Null
  -- when that source named no court (a facility that doesn't label courts, or
  -- a court list too long for `court_label` that went to notes instead) — a
  -- null matches any court in the slot, the same deliberate looseness
  -- `isSameReservation` documents.
  court_label text,
  dismissed_at timestamptz not null default now()
);

comment on table public.dismissed_reservations is
  'A reservation the User dismissed on the Sync bookings review screen (issue '
  '#437), recorded as its Org + wall-clock slot + court so the *other* import '
  'source honours the dismissal too. Write-once; no un-dismiss. Rows are '
  'compared with isSameReservation (import-candidate-shaping.ts), which reads '
  'the court by number, so the two sources'' differing court text still agrees.';

-- Deliberately no uniqueness. The two sources write the same slot with
-- different court text ("#9 - Hard" against "#9"), so a unique key could not
-- dedupe them anyway — the reviews match by court *number* at read time
-- instead. A second row for a slot already dismissed is harmless: the read is
-- a filter, not a count.

-- What both reviews read: one User's dismissals at one Org. Also the
-- referencing side of the `orgs` cascade, which Postgres does not index for
-- you — without it, deleting one Facility scans the whole table.
create index dismissed_reservations_owner_org
  on public.dismissed_reservations (owner_id, org_id);

create index dismissed_reservations_org_id
  on public.dismissed_reservations (org_id);

-- A dismissal belongs to the same User as the Org it names. RLS covers none of
-- this — the write is on a table the User may write, and the policy only
-- checks `owner_id`, not whose Org `org_id` names. Same shape and reasoning as
-- `assert_org_feed_event_coherent` / `assert_booking_coherent`.
create function public.assert_dismissed_reservation_coherent()
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
    raise exception 'a dismissed_reservations row can only sit under one of your own orgs'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger dismissed_reservations_coherent
  before insert on public.dismissed_reservations
  for each row execute function public.assert_dismissed_reservation_coherent();

-- Row Level Security: the coarse net (ADR 0003) — "this is mine" and that is
-- the whole rule, matching `processed_messages` and `org_feed_events`.
alter table public.dismissed_reservations enable row level security;

create policy "a User sees only their own dismissed reservations"
  on public.dismissed_reservations for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Automatic table exposure is off on this project, so the grant is explicit.
-- No update, no delete: a dismissal is recorded once and never revisited,
-- the same posture `processed_messages` takes. Rows leave only by cascade,
-- when the Org or the User goes.
grant select, insert on public.dismissed_reservations to authenticated;
