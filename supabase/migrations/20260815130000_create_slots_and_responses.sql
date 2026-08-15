-- A Slot is the friend-facing unit Connections see and respond to (see
-- CONTEXT.md, ADR 0001). It can exist with zero Bookings attached — a bare
-- proposal used to gauge interest before a court is reserved — and later have
-- one or more Bookings attached (issue #9), becoming a confirmed Slot. Only
-- the `slots` half of Phase 5 ships here; `slot_bookings` is issue #9's.
--
-- Like `availability_windows`, this is not a pure-ownership read policy: a
-- Slot is visible to the owner and to any Connection with at least `slots`
-- Visibility (CONTEXT.md's Visibility entry — `slots` or `calendar`, since
-- `calendar` is strictly more open). `has_slot_visibility` mirrors
-- `has_calendar_visibility`'s override-then-group-default precedence, but
-- checks "at least slots" rather than "exactly calendar", because `slots` is
-- not the top of `visibility_level`'s order. Nuanced precedence (per-friend
-- override beats most-permissive group default) still lives in application
-- code per ADR 0003 — this function is the SQL mirror of that chain, the same
-- deliberate exception Phase 4.5 already made, not a second copy invented
-- here. A Slot Link's token bypass (issue #10) is not part of this policy yet.

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  proposed_start timestamptz not null,
  proposed_end timestamptz not null,
  -- A bare-proposal Slot has no Org to read a clock off (unlike a Booking,
  -- issue #20), so it carries its own — same reason `bookings.time_zone` used
  -- to exist before that ticket moved it to `orgs`.
  time_zone text not null,
  rotation_buffer integer not null default 0,
  created_at timestamptz not null default now(),

  constraint slot_ends_after_start check (proposed_end > proposed_start),
  constraint slot_rotation_buffer_not_negative check (rotation_buffer >= 0)
);

comment on table public.slots is
  'The friend-facing proposal/game unit (see CONTEXT.md). Can exist with zero Bookings attached — a bare proposal. Visible to the owner and to Connections with at least slots-level Visibility.';

-- Every read is "mine" or "this owner's, soonest first" — the same shape as
-- `bookings_owner_starts_at`.
create index slots_owner_proposed_start
  on public.slots (owner_id, proposed_start);

/**
 * A zone Postgres doesn't recognise turns rendering wrong days after the
 * fact, not at write time — same rule `assert_org_time_zone_known` enforces,
 * copied rather than shared because there's no single table both belong to.
 */
create function public.assert_slot_time_zone_known()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names t where t.name = new.time_zone
  ) then
    raise exception 'unknown time zone %', new.time_zone
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger slots_time_zone_known
  before insert or update on public.slots
  for each row execute function public.assert_slot_time_zone_known();

/**
 * True when `viewer_user` has at least `slots`-level Visibility into
 * `owner_user`: an explicit override of `slots` or `calendar` wins outright
 * in either direction; otherwise any Friend Group of the owner's, containing
 * the connection, defaulting to `slots` or `calendar`, grants it.
 *
 * Security definer so this can be evaluated without the caller needing direct
 * select access to `friend_groups`/`visibility_overrides` — those stay
 * owner-only (Phase 3).
 */
create function public.has_slot_visibility(owner_user uuid, viewer_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select vo.level in ('slots', 'calendar')
      from public.connections c
      join public.visibility_overrides vo
        on vo.connection_id = c.id
       and vo.owner_id = owner_user
      where c.status = 'accepted'
        and (
          (c.requester_id = owner_user and c.addressee_id = viewer_user)
          or (c.requester_id = viewer_user and c.addressee_id = owner_user)
        )
    ),
    exists (
      select 1
      from public.connections c
      join public.friend_group_members fgm on fgm.connection_id = c.id
      join public.friend_groups fg
        on fg.id = fgm.group_id
       and fg.owner_id = owner_user
       and fg.default_visibility in ('slots', 'calendar')
      where c.status = 'accepted'
        and (
          (c.requester_id = owner_user and c.addressee_id = viewer_user)
          or (c.requester_id = viewer_user and c.addressee_id = owner_user)
        )
    )
  );
$$;

/** True when the acting User owns the Slot, or has at least slots Visibility into whoever does. */
create function public.can_access_slot(target_slot uuid, viewer_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.slots s
    where s.id = target_slot
      and (
        s.owner_id = viewer_user
        or public.has_slot_visibility(s.owner_id, viewer_user)
      )
  );
$$;

alter table public.slots enable row level security;

create policy "an owner or a slots-visible friend can read a slot"
  on public.slots for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.has_slot_visibility(owner_id, (select auth.uid()))
  );

create policy "a User creates only their own slots"
  on public.slots for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "a User updates only their own slots"
  on public.slots for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "a User deletes only their own slots"
  on public.slots for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.slots to authenticated;

-- A Response is a Connection's (or, from issue #10, a Guest's) yes/no/maybe
-- answer to a Slot (CONTEXT.md). `guest_name` and its RSVP path are not wired
-- up until issue #10 — the column ships now so the shape doesn't change under
-- that ticket, per the check constraint below.

create type public.response_answer as enum ('yes', 'no', 'maybe');

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  guest_name text,
  answer public.response_answer not null,
  created_at timestamptz not null default now(),

  constraint response_exactly_one_responder
    check ((user_id is not null) <> (guest_name is not null))
);

comment on table public.responses is
  'A Connection''s or Guest''s yes/no/maybe answer to a Slot. Exactly one of user_id/guest_name is set. Guest RSVPs are not writable yet — issue #10.';

create index responses_slot_id on public.responses (slot_id);

-- A signed-in User has one Response per Slot; responding again changes it in
-- place (`respondToSlot` upserts on this index) rather than accruing a
-- history. Not filtered to `where user_id is not null`: Postgres treats every
-- null as distinct for uniqueness, so this already imposes no limit on Guest
-- rows (`user_id` null) while still being a plain, non-partial index — which
-- is what lets `upsert(...).onConflict("slot_id,user_id")` name it as the
-- arbiter. A partial index needs its predicate repeated on the ON CONFLICT
-- clause itself, which supabase-js's upsert has no way to express.
create unique index responses_unique_user_per_slot
  on public.responses (slot_id, user_id);

alter table public.responses enable row level security;

-- Reads are as broad as the Slot itself: the Slot owner, the responder, and
-- anyone with slots Visibility into the Slot's owner can see who answered
-- what (CONTEXT.md: "Responses are visible to the Slot's owner and other
-- Connections with visibility").
create policy "responses are visible to whoever can see the slot"
  on public.responses for select
  to authenticated
  using (public.can_access_slot(slot_id, (select auth.uid())));

-- A signed-in User may only write their own Response, and only to a Slot they
-- can access — this is the coarse net `respondToSlot`'s "no visibility, no
-- response" guard relies on (Phase 6). Nuanced precedence still lives in
-- application code per ADR 0003; `can_access_slot` is its SQL mirror, the
-- same exception `has_slot_visibility` already is.
create policy "a User responds for themselves, to a slot they can access"
  on public.responses for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_access_slot(slot_id, (select auth.uid()))
  );

create policy "a User changes only their own response"
  on public.responses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.can_access_slot(slot_id, (select auth.uid()))
  );

grant select, insert, update on public.responses to authenticated;
