-- Team Tally: substitutes, reorders in the Flights, and a superadmin.
--
-- From the first real night:
--   team_tally_write_slots   a rename always saves (a substitute takes the
--                            same slot); a scored Round only pins its slot
--                            against a move, and only the Rounds of the
--                            Team's current Matchup count, so the opening
--                            Matchup's scores no longer freeze the Flight
--   team_tally_superadmins   accounts that act as the Organizer of every
--                            Team Event, to help another Organizer on the
--                            night. Meant for the site's owner alone, so no
--                            role can write it through the API; the one row
--                            is added by hand in the SQL editor (the repo is
--                            public, so the email stays out of it):
--                              insert into public.team_tally_superadmins (user_id)
--                              select id from auth.users where email = '...';
--   team_tally_owns_event    true for a superadmin too, so every policy and
--                            organizer function that asks it lets them in

-- ---------------------------------------------------------------------------
-- Superadmins
-- ---------------------------------------------------------------------------

create table public.team_tally_superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

comment on table public.team_tally_superadmins is
  'Accounts that act as the Organizer of every Team Event. No policies: only the SQL editor writes it, only team_tally_is_superadmin reads it.';

alter table public.team_tally_superadmins enable row level security;
revoke all on public.team_tally_superadmins from anon, authenticated;

/** True when the caller is a Team Tally superadmin. */
create function public.team_tally_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_tally_superadmins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.team_tally_is_superadmin() from public, anon;
-- The events policy below asks it.
grant execute on function public.team_tally_is_superadmin() to authenticated;

create or replace function public.team_tally_owns_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_tally_events
    where id = p_event_id
      and (owner_id = (select auth.uid()) or public.team_tally_is_superadmin())
  );
$$;

drop policy "Organizers manage their own Team Events" on public.team_tally_events;

create policy "Organizers manage their own Team Events"
  on public.team_tally_events for all to authenticated
  using (owner_id = (select auth.uid()) or (select public.team_tally_is_superadmin()))
  with check (owner_id = (select auth.uid()) or (select public.team_tally_is_superadmin()));

-- ---------------------------------------------------------------------------
-- Player slots: renames always save, moves pin to the current Matchup
-- ---------------------------------------------------------------------------

-- Mirrors src/lib/team-tally/roster.ts, message for message.
create or replace function public.team_tally_write_slots(
  p_team_id uuid,
  p_slot_a text,
  p_slot_b text,
  p_slot_c text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next text[] := array[btrim(coalesce(p_slot_a, '')), btrim(coalesce(p_slot_b, '')), btrim(coalesce(p_slot_c, ''))];
  v_letters text[] := array['A', 'B', 'C'];
  v_current text[];
  v_matchup public.team_tally_matchups;
begin
  if exists (
    select 1 from public.team_tally_teams t
    join public.team_tally_events e on e.id = t.event_id
    where t.id = p_team_id and e.status = 'finished'
  ) then
    raise exception 'This Team Event has finished, so its rosters are final.' using errcode = '22023';
  end if;

  -- The Team's current Matchup: its Flight once it has one, else its opening Matchup.
  select * into v_matchup
  from public.team_tally_matchups m
  where p_team_id in (m.red_team_id, m.blue_team_id)
  order by m.stage = 'flight' desc
  limit 1;

  if v_matchup.done_at is not null then
    raise exception 'This Team''s Matchup is done, so its roster is final.' using errcode = '22023';
  end if;

  for i in 1 .. 3 loop
    if v_next[i] = '' then
      raise exception 'Player % needs a name.', v_letters[i] using errcode = '22023';
    end if;
    if char_length(v_next[i]) > 80 then
      raise exception 'Player %''s name is too long.', v_letters[i] using errcode = '22023';
    end if;
  end loop;

  select array[
    (select btrim(name) from public.team_tally_player_slots where team_id = p_team_id and position = 'A'),
    (select btrim(name) from public.team_tally_player_slots where team_id = p_team_id and position = 'B'),
    (select btrim(name) from public.team_tally_player_slots where team_id = p_team_id and position = 'C')
  ] into v_current;

  -- A slot moved when it now holds a name one of its teammates held.
  for i in 1 .. 3 loop
    if v_current[i] is distinct from v_next[i]
      and exists (select 1 from generate_series(1, 3) j where j <> i and v_current[j] = v_next[i])
      and exists (
        select 1 from public.team_tally_games g
        where g.matchup_id = v_matchup.id and g.round = i and g.red_score is not null
      ) then
      raise exception 'Round % already has a score, so Player % stays %.', i, v_letters[i], v_current[i]
        using errcode = '22023';
    end if;
  end loop;

  for i in 1 .. 3 loop
    update public.team_tally_player_slots
    set name = v_next[i]
    where team_id = p_team_id and position = v_letters[i] and name is distinct from v_next[i];
  end loop;
end;
$$;
