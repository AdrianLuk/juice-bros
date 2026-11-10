-- Team Tally: a night runs up to 52 Teams (was 14).
--
-- Flights are lettered A to Z, two Teams each, so 52 is the format's ceiling.
--
--   team_tally_teams.position         0 to 51 (was 0 to 13)
--   team_tally_matchups.number        1 to 26 (was 1 to 7)
--   team_tally_matchups.flight_letter A to Z (was A to G)
--   team_tally_save_event             accepts 4 to 52 Teams (was 4 to 14)
--
-- team_tally_seed_flights already letters Flights with chr(64 + number), so
-- it needs no change.

-- The old checks were declared inline, so their names were generated. Drop
-- them by what they check, not by name.
do $$
declare
  v_con record;
begin
  for v_con in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'c'
      and array_length(c.conkey, 1) = 1
      and (
        (c.conrelid = 'public.team_tally_teams'::regclass and a.attname = 'position')
        or (c.conrelid = 'public.team_tally_matchups'::regclass and a.attname in ('number', 'flight_letter'))
      )
  loop
    execute format('alter table %s drop constraint %I', v_con.tbl, v_con.conname);
  end loop;
end;
$$;

alter table public.team_tally_teams
  add constraint team_tally_teams_position_check check (position between 0 and 51);

alter table public.team_tally_matchups
  add constraint team_tally_matchups_number_check check (number between 1 and 26),
  add constraint team_tally_matchups_flight_letter_check
    check (flight_letter ~ '^[A-Z]$');

-- ---------------------------------------------------------------------------
-- The setup form's save: the same as 20261010120000's, with the new ceiling.
-- ---------------------------------------------------------------------------

create or replace function public.team_tally_save_event(
  p_event_id uuid,
  p_name text,
  p_event_date date,
  p_teams jsonb,
  p_matchups jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_team_count int := jsonb_array_length(coalesce(p_teams, '[]'::jsonb));
  v_matchup_count int := jsonb_array_length(coalesce(p_matchups, '[]'::jsonb));
  v_team jsonb;
  v_team_id uuid;
  v_team_ids uuid[] := '{}';
  v_matchup jsonb;
  v_matchup_id uuid;
  v_kept_matchups uuid[] := '{}';
  v_red uuid;
  v_blue uuid;
  v_red_index int;
  v_blue_index int;
  v_flipped boolean;
begin
  if v_team_count < 4 or v_team_count > 52 or v_team_count % 2 <> 0 then
    raise exception 'a Team Event needs an even number of Teams, 4 to 52'
      using errcode = '22023';
  end if;

  if v_matchup_count <> v_team_count / 2
     or (select count(distinct pair.team_index::int)
         from jsonb_array_elements(p_matchups) as m (matchup),
              lateral (values (m.matchup ->> 'red'), (m.matchup ->> 'blue')) as pair (team_index))
        <> v_team_count then
    raise exception 'every Team plays in exactly one opening Matchup'
      using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.team_tally_events (name, event_date)
    values (btrim(p_name), p_event_date)
    returning id into v_event_id;
  else
    -- Under the caller's RLS: another User's Team Event is not found here.
    if exists (
      select 1 from public.team_tally_events e
      where e.id = p_event_id
        and (e.status <> 'opening' or exists (
          select 1 from public.team_tally_games g
          join public.team_tally_matchups m on m.id = g.matchup_id
          where m.event_id = e.id and g.red_score is not null))
    ) then
      raise exception 'Play has started, so the setup is set. Rosters change from the Score Links now.'
        using errcode = '22023';
    end if;

    update public.team_tally_events
    set name = btrim(p_name), event_date = p_event_date, updated_at = now()
    where id = p_event_id
    returning id into v_event_id;

    if v_event_id is null then
      raise exception 'Team Event not found' using errcode = 'P0002';
    end if;
  end if;

  -- Teams, in setup order. A known id keeps its row (and its Score Link).
  for i in 0 .. v_team_count - 1 loop
    v_team := p_teams -> i;
    v_team_id := null;

    if nullif(v_team ->> 'id', '') is not null then
      update public.team_tally_teams
      set position = i,
          nickname = nullif(btrim(coalesce(v_team ->> 'nickname', '')), ''),
          home_court = btrim(v_team ->> 'homeCourt')
      where id = (v_team ->> 'id')::uuid and event_id = v_event_id
      returning id into v_team_id;
    end if;

    if v_team_id is null then
      insert into public.team_tally_teams (event_id, position, nickname, home_court)
      values (
        v_event_id, i,
        nullif(btrim(coalesce(v_team ->> 'nickname', '')), ''),
        btrim(v_team ->> 'homeCourt')
      )
      returning id into v_team_id;
    end if;

    insert into public.team_tally_player_slots (team_id, position, name)
    values
      (v_team_id, 'captain', btrim(v_team ->> 'captain')),
      (v_team_id, 'A', btrim(v_team ->> 'slotA')),
      (v_team_id, 'B', btrim(v_team ->> 'slotB')),
      (v_team_id, 'C', btrim(v_team ->> 'slotC'))
    on conflict (team_id, position) do update set name = excluded.name;

    v_team_ids := v_team_ids || v_team_id;
  end loop;

  -- A Team left out of the form is gone, and its Matchups with it.
  delete from public.team_tally_teams
  where event_id = v_event_id and not (id = any (v_team_ids));

  -- Opening Matchups, in MATCH order. The court pair is the two home courts.
  for i in 0 .. v_matchup_count - 1 loop
    v_matchup := p_matchups -> i;
    v_red_index := (v_matchup ->> 'red')::int;
    v_blue_index := (v_matchup ->> 'blue')::int;

    if v_red_index is null or v_blue_index is null
       or v_red_index not between 0 and v_team_count - 1
       or v_blue_index not between 0 and v_team_count - 1 then
      raise exception 'Matchup % names a Team that is not in this Team Event', i + 1
        using errcode = '22023';
    end if;

    v_red := v_team_ids[v_red_index + 1];
    v_blue := v_team_ids[v_blue_index + 1];

    select id, red_team_id = v_blue
    into v_matchup_id, v_flipped
    from public.team_tally_matchups
    where event_id = v_event_id
      and stage = 'opening'
      and ((red_team_id = v_red and blue_team_id = v_blue)
        or (red_team_id = v_blue and blue_team_id = v_red));

    if v_matchup_id is not null then
      update public.team_tally_matchups
      set number = i + 1,
          red_team_id = v_red,
          blue_team_id = v_blue,
          court_one = (select home_court from public.team_tally_teams where id = v_red),
          court_two = (select home_court from public.team_tally_teams where id = v_blue)
      where id = v_matchup_id;

      -- Same two Teams printed the other way round: their scores swap sides.
      if v_flipped then
        update public.team_tally_games
        set red_score = blue_score, blue_score = red_score
        where matchup_id = v_matchup_id;
      end if;
    else
      insert into public.team_tally_matchups
        (event_id, stage, number, court_one, court_two, red_team_id, blue_team_id)
      values (
        v_event_id, 'opening', i + 1,
        (select home_court from public.team_tally_teams where id = v_red),
        (select home_court from public.team_tally_teams where id = v_blue),
        v_red, v_blue
      )
      returning id into v_matchup_id;

      insert into public.team_tally_games (matchup_id, round, kind)
      select v_matchup_id, round, kind
      from generate_series(1, 3) as round,
           unnest(array['captains', 'teammates']) as kind;
    end if;

    v_kept_matchups := v_kept_matchups || v_matchup_id;
  end loop;

  delete from public.team_tally_matchups
  where event_id = v_event_id
    and stage = 'opening'
    and not (id = any (v_kept_matchups));

  return v_event_id;
end;
$$;
