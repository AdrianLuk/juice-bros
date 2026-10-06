-- Regulars and the Weekly Invite (spec #576, issue #579). A Standing Game's
-- Regulars are the organizer's own list of Connections told each time it
-- posts a Slot (CONTEXT.md's Regular and Weekly Invite entries).
--
-- Four pieces:
--   * `standing_game_regulars` — the list. Owner-managed under RLS; a
--     trigger holds every row to "an accepted Connection of the organizer,
--     never the organizer", whichever role writes it.
--   * a trigger on `responses` — a yes to one of the Standing Game's posted
--     Slots adds the answerer, from every path that writes a Response (the
--     Slot page today, the invite's answer links in #580). No and maybe never
--     remove anyone.
--   * a trigger on `connections` — ending a Connection takes each party off
--     the other's Regulars.
--   * `notification_preferences.weekly_invite_enabled` and
--     `weekly_invite_sends` — the "Weekly game invites" opt-in and the
--     sent-marker that makes a send happen at most once per Slot, User and
--     channel, exactly like `reminder_sends`.
--
-- Re-runnable: every statement is `if not exists` / `or replace` or guarded.

create table if not exists public.standing_game_regulars (
  standing_game_id uuid not null references public.standing_games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),

  primary key (standing_game_id, user_id)
);

comment on table public.standing_game_regulars is
  'A Standing Game''s Regulars: the organizer''s Connections who get its Weekly Invite (CONTEXT.md). Owner-managed; a yes to a posted Slot adds the answerer; ending the Connection removes them.';

create index if not exists standing_game_regulars_user on public.standing_game_regulars (user_id);

/** True when the two Users have an accepted Connection, whichever of them asked. */
create or replace function public.are_connected(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and (
        (c.requester_id = first_user and c.addressee_id = second_user)
        or (c.requester_id = second_user and c.addressee_id = first_user)
      )
  );
$$;

revoke all on function public.are_connected(uuid, uuid) from public, anon, authenticated;

/**
 * A Regular is one of the organizer's accepted Connections and never the
 * organizer. A trigger rather than a policy so it binds `service_role` and
 * the yes trigger below as well as the organizer's own session.
 */
create or replace function public.assert_regular_is_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organizer uuid;
begin
  select owner_id into organizer from public.standing_games where id = new.standing_game_id;

  if organizer = new.user_id or not public.are_connected(organizer, new.user_id) then
    raise exception 'a regular must be one of the organizer''s connections'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists standing_game_regulars_are_connections on public.standing_game_regulars;
create trigger standing_game_regulars_are_connections
  before insert or update on public.standing_game_regulars
  for each row execute function public.assert_regular_is_connection();

alter table public.standing_game_regulars enable row level security;

drop policy if exists "a User reads the regulars of their own standing games" on public.standing_game_regulars;
create policy "a User reads the regulars of their own standing games"
  on public.standing_game_regulars for select
  to authenticated
  using (
    exists (
      select 1 from public.standing_games sg
      where sg.id = standing_game_id and sg.owner_id = (select auth.uid())
    )
  );

drop policy if exists "a User adds regulars to their own standing games" on public.standing_game_regulars;
create policy "a User adds regulars to their own standing games"
  on public.standing_game_regulars for insert
  to authenticated
  with check (
    exists (
      select 1 from public.standing_games sg
      where sg.id = standing_game_id and sg.owner_id = (select auth.uid())
    )
  );

drop policy if exists "a User removes regulars from their own standing games" on public.standing_game_regulars;
create policy "a User removes regulars from their own standing games"
  on public.standing_game_regulars for delete
  to authenticated
  using (
    exists (
      select 1 from public.standing_games sg
      where sg.id = standing_game_id and sg.owner_id = (select auth.uid())
    )
  );

grant select, insert, delete on public.standing_game_regulars to authenticated;
-- The invite sender (the posting cron, and the creation action's `after()`)
-- reads every organizer's list at once.
grant select on public.standing_game_regulars to service_role;

/**
 * A yes to one of a Standing Game's posted Slots adds the answerer to its
 * Regulars, if they are the organizer's Connection (a Guest has no account;
 * a Slot Link visitor who isn't a friend can't be a Regular). Fires on every
 * write to `responses`, so no answering path has to remember it.
 *
 * Reads `slots.standing_game_id`, the one non-UI reader of that column:
 * joining a Standing Game's list is particular to a Standing Game's Slot by
 * definition, and nothing about the Slot itself changes (ADR 0023).
 */
create or replace function public.add_yes_answerer_to_regulars()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.answer <> 'yes' or new.user_id is null then
    return new;
  end if;

  insert into public.standing_game_regulars (standing_game_id, user_id)
  select s.standing_game_id, new.user_id
  from public.slots s
  where s.id = new.slot_id
    and s.standing_game_id is not null
    and s.owner_id <> new.user_id
    and public.are_connected(s.owner_id, new.user_id)
  on conflict (standing_game_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists responses_yes_joins_regulars on public.responses;
create trigger responses_yes_joins_regulars
  after insert or update of answer on public.responses
  for each row execute function public.add_yes_answerer_to_regulars();

/**
 * Ending a Connection (unfriending, or an accepted row going back to
 * anything else) takes each party off the other's Regulars.
 */
create or replace function public.remove_regulars_with_ended_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'accepted' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status = 'accepted' then
    return null;
  end if;

  delete from public.standing_game_regulars r
  using public.standing_games sg
  where sg.id = r.standing_game_id
    and (
      (sg.owner_id = old.requester_id and r.user_id = old.addressee_id)
      or (sg.owner_id = old.addressee_id and r.user_id = old.requester_id)
    );

  return null;
end;
$$;

drop trigger if exists connections_end_removes_regulars on public.connections;
create trigger connections_end_removes_regulars
  after delete or update of status on public.connections
  for each row execute function public.remove_regulars_with_ended_connection();

alter table public.notification_preferences
  add column if not exists weekly_invite_enabled boolean not null default true;

comment on column public.notification_preferences.weekly_invite_enabled is
  'Opt-in for the Weekly Invite (issue #579), both channels: off sends neither email nor push. Independent of email_enabled and booking_window_email_enabled; push also needs push_enabled.';

create table if not exists public.weekly_invite_sends (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),

  constraint weekly_invite_sends_unique_send unique (slot_id, user_id, channel)
);

comment on table public.weekly_invite_sends is
  'Sent-marker for Weekly Invites (issue #579), the same shape and posture as reminder_sends: a second send for the same Slot, User and channel is a duplicate insert, ignored. service_role-only.';

alter table public.weekly_invite_sends enable row level security;

-- No policies: default-deny for `authenticated`/`anon`, like `reminder_sends`.
grant select, insert on public.weekly_invite_sends to service_role;
