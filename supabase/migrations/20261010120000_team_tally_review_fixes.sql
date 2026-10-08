-- Team Tally: fixes from the PR #629 review (spec #621).
--
--   team_tally_save_event          one Matchup per Team compared as numbers,
--                                  and the setup is set once play has started
--   team_tally_write_dreambreaker  refused once the night is finished
--   team_tally_seed_keys           Seeding's sort key per Team (internal), so
--                                  "level on every count" has one definition
--   team_tally_seed_order          now reads its key from seed_keys
--   team_tally_organizer_put_ahead the Organizer's call on a tie across a
--                                  Flight line, after the Flights are placed
--   grants                         every function's EXECUTE spelled out for
--                                  public, anon and authenticated
--
-- The earlier Team Tally migrations stay as written; everything here replaces
-- or adds.

-- ---------------------------------------------------------------------------
-- The setup form's save
-- ---------------------------------------------------------------------------

/**
 * #622's save, with two changes:
 *
 *   * the one-Matchup-per-Team backstop compares Team indexes as numbers, so
 *     "0" and "00" are one Team;
 *   * an edit is refused once play has started (any Game has a score, or the
 *     Flights are placed). Re-pairing would delete Matchups with their Games,
 *     and Flights with them; from then on a roster changes from the Score
 *     Links, where a scored Round's slot stays put.
 */
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
  if v_team_count < 4 or v_team_count > 14 or v_team_count % 2 <> 0 then
    raise exception 'a Team Event needs an even number of Teams, 4 to 14'
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

-- ---------------------------------------------------------------------------
-- The Dreambreaker, once the night is over
-- ---------------------------------------------------------------------------

/**
 * #624's Dreambreaker write, now refused once the Team Event has finished,
 * like every score and roster write: an opening Matchup left open by Seed now
 * could otherwise still change its winner after the night ended. Internal.
 */
create or replace function public.team_tally_write_dreambreaker(p_matchup_id uuid, p_winner_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matchup public.team_tally_matchups;
  v_red integer;
  v_blue integer;
  v_unscored integer;
begin
  select * into v_matchup from public.team_tally_matchups where id = p_matchup_id;

  if exists (
    select 1 from public.team_tally_events e
    where e.id = v_matchup.event_id and e.status = 'finished'
  ) then
    raise exception 'This Team Event has finished, so its scores are final.' using errcode = '22023';
  end if;
  if v_matchup.done_at is not null then
    raise exception 'This Matchup is done. Only the organizer can reopen it.' using errcode = '22023';
  end if;
  if p_winner_team_id is not null and p_winner_team_id not in (v_matchup.red_team_id, v_matchup.blue_team_id) then
    raise exception 'That Team isn''t in this Matchup.' using errcode = '22023';
  end if;

  select sum(red_score), sum(blue_score), count(*) filter (where red_score is null)
  into v_red, v_blue, v_unscored
  from public.team_tally_games where matchup_id = p_matchup_id;

  if p_winner_team_id is not null and (v_unscored > 0 or v_red is distinct from v_blue) then
    raise exception 'Only a tied Matchup plays a Dreambreaker.' using errcode = '22023';
  end if;

  update public.team_tally_matchups
  set dreambreaker_winner_id = p_winner_team_id
  where id = p_matchup_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seeding's key, once
-- ---------------------------------------------------------------------------

/**
 * Every Team of the Team Event with Seeding's sort key, before the
 * Organizer's order: Team score; point differential; the Matchup winner
 * within a pair level on both; Games won; the Matchup winner within a pair
 * level on all three. Two Teams with the same key are level on every count.
 * Mirrors src/lib/team-tally/seeding.ts. Internal.
 */
create function public.team_tally_seed_keys(p_event_id uuid)
returns table (
  team_id uuid,
  setup_position integer,
  team_score integer,
  diff integer,
  pair_first integer,
  games_won integer,
  pair_last integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with sides as (
    select t.id as team_id, t.position, m.id as matchup_id,
           t.id = m.red_team_id as is_red, m.dreambreaker_winner_id
    from public.team_tally_teams t
    join public.team_tally_matchups m
      on m.event_id = t.event_id and m.stage = 'opening' and t.id in (m.red_team_id, m.blue_team_id)
    where t.event_id = p_event_id
  ),
  totals as (
    select s.team_id, s.position, s.matchup_id, s.dreambreaker_winner_id,
      coalesce(sum(case when s.is_red then g.red_score else g.blue_score end), 0)::int as team_score,
      coalesce(sum(case when s.is_red then g.blue_score else g.red_score end), 0)::int as against,
      (count(*) filter (where case when s.is_red then g.red_score > g.blue_score else g.blue_score > g.red_score end))::int as games_won
    from sides s
    left join public.team_tally_games g on g.matchup_id = s.matchup_id and g.red_score is not null
    group by s.team_id, s.position, s.matchup_id, s.is_red, s.dreambreaker_winner_id
  ),
  keyed as (
    select tt.*, tt.team_score - tt.against as diff,
      case
        when tt.team_score > tt.against then 1
        when tt.team_score < tt.against then 0
        when tt.dreambreaker_winner_id = tt.team_id then 1
        else 0
      end as won
    from totals tt
  )
  select k.team_id, k.position::integer, k.team_score, k.diff,
    (case when count(*) over (partition by k.team_score, k.diff) = 2
           and count(*) over (partition by k.team_score, k.diff, k.matchup_id) = 2
       then k.won else 0 end)::integer,
    k.games_won,
    (case when count(*) over (partition by k.team_score, k.diff, k.games_won) = 2
           and count(*) over (partition by k.team_score, k.diff, k.games_won, k.matchup_id) = 2
       then k.won else 0 end)::integer
  from keyed k;
$$;

/** #624's Seeding, on the shared key; then the Organizer's order, then setup order. */
create or replace function public.team_tally_seed_order(p_event_id uuid)
returns table (team_id uuid, seed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select k.team_id,
    (row_number() over (
      order by k.team_score desc, k.diff desc, k.pair_first desc, k.games_won desc, k.pair_last desc,
        coalesce(array_position(e.tie_order, k.team_id) - 1, 1000 + k.setup_position)
    ))::integer as seed
  from public.team_tally_seed_keys(p_event_id) k
  cross join public.team_tally_events e
  where e.id = p_event_id;
$$;

-- ---------------------------------------------------------------------------
-- The Organizer's call on a tie, after the Flights are placed
-- ---------------------------------------------------------------------------

/**
 * Puts a Team ahead of the Team above it across a Flight line, after the
 * Flights are placed. The night seeds itself when the last opening Matchup
 * is done, so a tie on every count across a Flight line was placed in setup
 * order with nobody choosing; this is the Organizer's call on it.
 *
 * `p_team_id` must top its Flight (the red Team of Flight B or below) and be
 * level on every count with the bottom Team of the Flight above. The two
 * Teams change places, each Flight keeping its court pair, and the tie order
 * becomes the placed order, so the standings read the same way. Refused once
 * either Flight has a score.
 */
create function public.team_tally_organizer_put_ahead(p_event_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_lower public.team_tally_matchups;
  v_upper public.team_tally_matchups;
begin
  if not public.team_tally_owns_event(p_event_id) then
    raise exception 'Team Event not found' using errcode = 'P0002';
  end if;

  v_status := public.team_tally_lock_event(p_event_id);
  if v_status = 'opening' then
    raise exception 'The Flights aren''t placed yet.' using errcode = '22023';
  end if;
  if v_status = 'finished' then
    raise exception 'This Team Event has finished, so its scores are final.' using errcode = '22023';
  end if;

  select * into v_lower from public.team_tally_matchups
  where event_id = p_event_id and stage = 'flight' and red_team_id = p_team_id;
  if found then
    select * into v_upper from public.team_tally_matchups
    where event_id = p_event_id and stage = 'flight' and number = v_lower.number - 1;
  end if;

  if v_upper.id is null or (
    select (k.team_score, k.diff, k.pair_first, k.games_won, k.pair_last)
    from public.team_tally_seed_keys(p_event_id) k where k.team_id = p_team_id
  ) is distinct from (
    select (k.team_score, k.diff, k.pair_first, k.games_won, k.pair_last)
    from public.team_tally_seed_keys(p_event_id) k where k.team_id = v_upper.blue_team_id
  ) then
    raise exception 'That Team isn''t level on every count with the Team above it in the next Flight up.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.team_tally_games g
    where g.matchup_id in (v_lower.id, v_upper.id) and g.red_score is not null
  ) then
    raise exception 'A Flight has a score, so the Teams stay.' using errcode = '22023';
  end if;

  update public.team_tally_matchups set blue_team_id = p_team_id where id = v_upper.id;
  update public.team_tally_matchups set red_team_id = v_upper.blue_team_id where id = v_lower.id;

  update public.team_tally_events
  set tie_order = (
        select array_agg(side.team_id order by m.number, side.ord)
        from public.team_tally_matchups m,
             lateral (values (m.red_team_id, 1), (m.blue_team_id, 2)) as side (team_id, ord)
        where m.event_id = p_event_id and m.stage = 'flight'
      ),
      updated_at = now()
  where id = p_event_id;
end;
$$;

comment on function public.team_tally_organizer_put_ahead(uuid, uuid) is
  'The Organizer puts a Team ahead of one level on every count across a Flight line, after Seeding, until either Flight has a score (PR #629 review).';

-- ---------------------------------------------------------------------------
-- Grants, spelled out
-- ---------------------------------------------------------------------------

-- A hosted project can hand a new function to anon and authenticated by
-- default privileges, so `revoke ... from public` alone is not the whole
-- story. Take EXECUTE away from all three on every Team Tally function, then
-- give each entry point back to exactly the roles that call it.

do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'team\_tally\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_fn);
  end loop;
end;
$$;

-- Link holders (no account) and signed-in Users alike.
grant execute on function
  public.team_tally_public_event(text),
  public.team_tally_score_link_event(text),
  public.team_tally_score_game(text, uuid, integer, integer),
  public.team_tally_set_slots(text, text, text, text),
  public.team_tally_mark_done(text, uuid),
  public.team_tally_set_dreambreaker(text, uuid, uuid),
  -- Pure, and in team_tally_games' check constraint.
  public.team_tally_score_problem(integer, integer)
  to anon, authenticated;

-- The signed-in Organizer.
grant execute on function
  public.team_tally_save_event(uuid, text, date, jsonb, jsonb),
  -- Every Team Tally table's RLS policy asks it.
  public.team_tally_owns_event(uuid),
  public.team_tally_organizer_event(uuid),
  public.team_tally_organizer_score_game(uuid, integer, integer),
  public.team_tally_organizer_set_slots(uuid, text, text, text),
  public.team_tally_organizer_mark_done(uuid),
  public.team_tally_organizer_reopen(uuid),
  public.team_tally_organizer_set_dreambreaker(uuid, uuid),
  public.team_tally_organizer_seed_now(uuid),
  public.team_tally_organizer_set_tie_order(uuid, uuid[]),
  public.team_tally_organizer_swap_flight_courts(uuid, uuid),
  public.team_tally_organizer_put_ahead(uuid, uuid)
  to authenticated;

-- Everything else (team_tally_event_doc, _team_for_token, _team_in_matchup,
-- _write_score, _write_slots, _write_dreambreaker, _finish_matchup,
-- _seed_flights, _seed_order, _seed_keys, _lock_event, _done_problem,
-- _owns_matchup and the trigger functions) is internal: reached only from the
-- SECURITY DEFINER entry points above, or fired by a trigger.
