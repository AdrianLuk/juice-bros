-- Standing Games (spec #576, issue #577; ADR 0023). An organizer-only
-- template for a game that repeats weekly ("Tuesday 8pm, every week") which
-- posts one plain Slot per week ahead of time. Recurrence lives here alone:
-- every Slot it posts is an ordinary `slots` row, read by RLS, capacity, the
-- reminder planners, the friend calendar, Find a time and Slot Links exactly
-- as any other Slot is. None of those change in this migration.
--
-- Three pieces:
--   * `standing_games` — the template. Owner-only: friends never see it.
--   * `standing_game_weeks` — one row per (Standing Game, game date) the
--     template has dealt with. Its unique key is what makes posting
--     idempotent (a cron rerun, or the cron racing the creation action, posts
--     a week at most once), and because the row outlives its Slot it is also
--     where a skipped week is remembered (#578) so it is never posted again.
--   * `slots.standing_game_id` — a nullable pointer back from a posted Slot,
--     for the UI only (the "Every Tuesday" chip, the Weekly games row's next
--     game). No policy or helper reads it.
--
-- Posting goes through `post_standing_game_week`, one transaction that
-- records the week and inserts its Slot, so a Slot the `slots_not_in_the_past`
-- trigger refuses leaves no week recorded behind it.
--
-- Re-runnable: every statement is `if not exists` / `or replace` or guarded.

create table if not exists public.standing_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- 0 = Sunday … 6 = Saturday, Postgres `extract(dow …)` and JS `getUTCDay`.
  weekday smallint not null,
  -- Whole hours on the wall clock of `time_zone`, the same hour grid every
  -- Slot is posted on. An end at or before the start crosses midnight.
  start_hour smallint not null,
  end_hour smallint not null,
  -- The Intended Org's zone when one is set, else the app's Toronto fallback
  -- (`DEFAULT_HAND_NAMED_TIME_ZONE`). Kept as a zone, never an offset, so 8pm
  -- stays 8pm across daylight saving.
  time_zone text not null,
  division text not null default 'open',
  intended_org_id uuid references public.orgs (id) on delete set null,
  notes text,
  rotation_buffer integer not null default 0,
  reminder_offset_minutes integer not null default 60,
  -- Set once by End. There is no restart: an ended Standing Game posts nothing
  -- ever again, and its already-posted Slots stay as real games.
  ended_at timestamptz,
  created_at timestamptz not null default now(),

  constraint standing_game_weekday_range check (weekday between 0 and 6),
  constraint standing_game_hours_range check (start_hour between 0 and 23 and end_hour between 0 and 23),
  constraint standing_game_not_zero_length check (start_hour <> end_hour),
  constraint standing_game_division check (division in ('open', 'mixed', 'mens', 'womens')),
  -- Mirrors `slot_notes_length` (NOTES_MAX_LENGTH in slots.ts).
  constraint standing_game_notes_length check (notes is null or char_length(notes) <= 500),
  constraint standing_game_rotation_buffer_not_negative check (rotation_buffer >= 0),
  constraint standing_game_reminder_offset_range check (reminder_offset_minutes between 0 and 10080)
);

comment on table public.standing_games is
  'An organizer''s template for a game that repeats weekly (CONTEXT.md, ADR 0023). Posts one plain Slot per week ahead of time via post_standing_game_week. Owner-only; friends only ever see the Slots it posts.';

create index if not exists standing_games_owner on public.standing_games (owner_id, created_at);

-- Same unknown-zone guard `slots` has; the function only reads `new.time_zone`.
drop trigger if exists standing_games_time_zone_known on public.standing_games;
create trigger standing_games_time_zone_known
  before insert or update on public.standing_games
  for each row execute function public.assert_slot_time_zone_known();

/**
 * A Standing Game's Intended Org, if set, must be the owner's own, the same
 * rule `assert_slot_intended_org_coherent` holds a Slot to (and which every
 * Slot this posts is checked against again on insert).
 */
create or replace function public.assert_standing_game_intended_org_coherent()
returns trigger
language plpgsql
as $$
begin
  if new.intended_org_id is not null and not exists (
    select 1 from public.orgs o
    where o.id = new.intended_org_id and o.owner_id = new.owner_id
  ) then
    raise exception 'a standing game''s intended org must belong to the same owner'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists standing_games_intended_org_coherent on public.standing_games;
create trigger standing_games_intended_org_coherent
  before insert or update on public.standing_games
  for each row execute function public.assert_standing_game_intended_org_coherent();

alter table public.standing_games enable row level security;

drop policy if exists "a User reads only their own standing games" on public.standing_games;
create policy "a User reads only their own standing games"
  on public.standing_games for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "a User creates only their own standing games" on public.standing_games;
create policy "a User creates only their own standing games"
  on public.standing_games for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "a User updates only their own standing games" on public.standing_games;
create policy "a User updates only their own standing games"
  on public.standing_games for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- No delete path in the app (End is an update), but an owner removing their
-- own row hurts nothing: its posted Slots stay, `standing_game_id` nulls.
drop policy if exists "a User deletes only their own standing games" on public.standing_games;
create policy "a User deletes only their own standing games"
  on public.standing_games for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.standing_games to authenticated;
grant select on public.standing_games to service_role;

create table if not exists public.standing_game_weeks (
  id uuid primary key default gen_random_uuid(),
  standing_game_id uuid not null references public.standing_games (id) on delete cascade,
  -- The game's calendar date on the Standing Game's own wall clock.
  game_date date not null,
  -- The Slot posted for this week. Null once that Slot is deleted (or for a
  -- week skipped before it was posted, #578); the row itself stays, so the
  -- week is never posted again.
  slot_id uuid references public.slots (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint standing_game_weeks_once unique (standing_game_id, game_date)
);

comment on table public.standing_game_weeks is
  'One row per (Standing Game, game date) already dealt with. The unique key makes posting idempotent; the row outlives its Slot so a week is never posted twice. Owner-readable.';

alter table public.standing_game_weeks enable row level security;

drop policy if exists "a User reads the weeks of their own standing games" on public.standing_game_weeks;
create policy "a User reads the weeks of their own standing games"
  on public.standing_game_weeks for select
  to authenticated
  using (
    exists (
      select 1 from public.standing_games sg
      where sg.id = standing_game_id and sg.owner_id = (select auth.uid())
    )
  );

-- Written only through `post_standing_game_week` (security definer) for now.
grant select on public.standing_game_weeks to authenticated;
grant select on public.standing_game_weeks to service_role;

alter table public.slots
  add column if not exists standing_game_id uuid references public.standing_games (id) on delete set null;

comment on column public.slots.standing_game_id is
  'The Standing Game that posted this Slot, if any. UI only (the "Every Tuesday" chip, Weekly games'' next game): no RLS policy or helper reads it, so a posted Slot is a plain Slot in every rule (ADR 0023).';

create index if not exists slots_standing_game on public.slots (standing_game_id, proposed_start)
  where standing_game_id is not null;

/**
 * What the posting cron reads per Standing Game: the template's schedule plus
 * its Intended Org's Booking Window lead, which decides how far ahead a week
 * posts. A view for the same reason `slot_booking_windows` is one:
 * `service_role` has no grant on `orgs`, and this view's own grant list is the
 * access control. Runs as its owner, not `security_invoker`.
 */
create or replace view public.standing_game_schedules as
select
  sg.id,
  sg.owner_id,
  sg.weekday,
  sg.start_hour,
  sg.time_zone,
  sg.ended_at,
  o.booking_window_days_before
from public.standing_games sg
left join public.orgs o on o.id = sg.intended_org_id;

comment on view public.standing_game_schedules is
  'Each Standing Game''s schedule and its Intended Org''s Booking Window lead, for the posting cron. service_role-only.';

revoke all on public.standing_game_schedules from anon, authenticated;
grant select on public.standing_game_schedules to service_role;

/**
 * Posts one week of a Standing Game as a plain Slot, or does nothing if that
 * week is already recorded. Returns the new Slot's id, or null when there was
 * nothing to post (already posted or skipped, or the Standing Game has ended).
 *
 * One transaction: the week is recorded first, under the unique key, and only
 * the call that actually inserted it goes on to insert the Slot. A rerun of
 * the cron, or the cron racing the creation action, therefore posts a week at
 * most once without anyone reading first. If the Slot insert fails (the
 * `slots_not_in_the_past` trigger, say) the week's row rolls back with it.
 *
 * The Slot's instants are built the way `createSlot` builds them: a
 * wall-clock string carrying its zone, converted by Postgres, so 8pm is 8pm
 * on both sides of a daylight saving change. An end hour at or before the
 * start lands on the next day. It copies the template's time zone, division,
 * Intended Org, notes, rotation buffer and reminder offset, and nothing else:
 * no Bookings, Responses or Slot Link.
 *
 * Security definer so the cron (`service_role`, which holds no grants on
 * `slots`' triggers' tables) and the organizer's own session share one path.
 * The caller check: a signed-in caller must own the Standing Game; a caller
 * with no `auth.uid()` reaches here only as `service_role`, since `anon` has
 * no execute grant.
 */
create or replace function public.post_standing_game_week(
  target_standing_game uuid,
  target_game_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sg public.standing_games%rowtype;
  week_id uuid;
  new_slot_id uuid;
  start_clock text;
  end_clock text;
begin
  select * into sg from public.standing_games where id = target_standing_game;

  if not found then
    raise exception 'no such standing game' using errcode = 'no_data_found';
  end if;

  if (select auth.uid()) is not null and (select auth.uid()) <> sg.owner_id then
    raise exception 'not your standing game' using errcode = 'insufficient_privilege';
  end if;

  if sg.ended_at is not null then
    return null;
  end if;

  if extract(dow from target_game_date)::smallint <> sg.weekday then
    raise exception 'that date is not on this standing game''s day'
      using errcode = 'check_violation';
  end if;

  insert into public.standing_game_weeks (standing_game_id, game_date)
  values (sg.id, target_game_date)
  on conflict (standing_game_id, game_date) do nothing
  returning id into week_id;

  if week_id is null then
    return null;
  end if;

  start_clock := lpad(sg.start_hour::text, 2, '0') || ':00:00';
  end_clock := lpad(sg.end_hour::text, 2, '0') || ':00:00';

  insert into public.slots (
    owner_id,
    proposed_start,
    proposed_end,
    time_zone,
    division,
    intended_org_id,
    notes,
    rotation_buffer,
    reminder_offset_minutes,
    standing_game_id
  )
  values (
    sg.owner_id,
    (target_game_date::text || ' ' || start_clock || ' ' || sg.time_zone)::timestamptz,
    (
      (case when sg.end_hour <= sg.start_hour then target_game_date + 1 else target_game_date end)::text
      || ' ' || end_clock || ' ' || sg.time_zone
    )::timestamptz,
    sg.time_zone,
    sg.division,
    sg.intended_org_id,
    sg.notes,
    sg.rotation_buffer,
    sg.reminder_offset_minutes,
    sg.id
  )
  returning id into new_slot_id;

  update public.standing_game_weeks set slot_id = new_slot_id where id = week_id;

  return new_slot_id;
end;
$$;

revoke all on function public.post_standing_game_week(uuid, date) from public, anon;
grant execute on function public.post_standing_game_week(uuid, date) to authenticated, service_role;
