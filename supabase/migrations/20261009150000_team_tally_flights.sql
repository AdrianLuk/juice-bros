-- Team Tally: Matchup done, Seeding and Flights (issue #624, spec #621).
--
-- The night moves from the opening round into Flights without anyone in
-- charge: either captain marks their Matchup done from the Score Link, and
-- when the last opening Matchup is done the Flights place themselves.
--
--   team_tally_matchups.done_at / done_by_team_id   Matchup done, and by whom
--   team_tally_matchups.dreambreaker_winner_id      who won a tied Matchup's
--                                                   Dreambreaker (no points)
--   team_tally_events.seeded_at                     when the Flights were placed
--   team_tally_events.tie_order                     the Organizer's order for
--                                                   Teams level on every count
--
--   team_tally_done_problem       why a Matchup can't be done yet, or null
--   team_tally_seed_order         Seeding, mirroring src/lib/team-tally/seeding.ts
--   team_tally_mark_done          a captain's Matchup done (and the Organizer's)
--   team_tally_set_dreambreaker   a captain records the Dreambreaker winner
--   team_tally_organizer_*        reopen, Seed now, swap Flight courts, tie order
--
-- Seeding happens exactly once. Every Matchup done, reopen and Seed now takes
-- the Team Event's row lock first, so two captains finishing the last two
-- Matchups at the same moment queue: the second sees the first's done and
-- places the Flights, and anything after sees status 'flights' and leaves
-- them be. The (event, stage, number) unique key backs that up.
--
-- Flights are rows like any Matchup (team-tally/docs/adr/0001): placed once,
-- they stay placed. A later opening correction re-sorts the standings, which
-- are computed on read; the Organizer's view says they moved.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.team_tally_matchups
  add column done_at timestamptz,
  add column done_by_team_id uuid references public.team_tally_teams (id) on delete set null,
  add column dreambreaker_winner_id uuid references public.team_tally_teams (id) on delete cascade,
  add constraint team_tally_matchups_done_by_side
    check (done_by_team_id is null or done_by_team_id in (red_team_id, blue_team_id)),
  add constraint team_tally_matchups_dreambreaker_side
    check (dreambreaker_winner_id is null or dreambreaker_winner_id in (red_team_id, blue_team_id));

comment on column public.team_tally_matchups.done_at is
  'Matchup done: when a captain (or the Organizer) said it is over. Locks its Games and its Teams'' slots until the Organizer reopens it (issue #624).';
comment on column public.team_tally_matchups.dreambreaker_winner_id is
  'Who won the Dreambreaker a tied Matchup played. Decides the winner only while the Team scores are level; its points never count.';

create index team_tally_matchups_done_by_idx on public.team_tally_matchups (done_by_team_id);
create index team_tally_matchups_dreambreaker_idx on public.team_tally_matchups (dreambreaker_winner_id);

alter table public.team_tally_events
  add column seeded_at timestamptz,
  add column tie_order uuid[] not null default '{}';

comment on column public.team_tally_events.tie_order is
  'Teams the Organizer has ordered for a Seeding tie on every count, first ahead. Teams not in it follow in setup order.';

-- ---------------------------------------------------------------------------
-- The document, now with Matchup done, the Dreambreaker and Seeding
-- ---------------------------------------------------------------------------

create or replace function public.team_tally_event_doc(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'date', e.event_date,
    'status', e.status,
    'seededAt', e.seeded_at,
    'tieOrder', to_jsonb(e.tie_order),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'nickname', t.nickname,
        'homeCourt', t.home_court,
        'captain', (select s.name from public.team_tally_player_slots s where s.team_id = t.id and s.position = 'captain'),
        'slotA', (select s.name from public.team_tally_player_slots s where s.team_id = t.id and s.position = 'A'),
        'slotB', (select s.name from public.team_tally_player_slots s where s.team_id = t.id and s.position = 'B'),
        'slotC', (select s.name from public.team_tally_player_slots s where s.team_id = t.id and s.position = 'C')
      ) order by t.position)
      from public.team_tally_teams t
      where t.event_id = e.id
    ), '[]'::jsonb),
    'matchups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'stage', m.stage,
        'number', m.number,
        'flightLetter', m.flight_letter,
        'courtPair', jsonb_build_array(m.court_one, m.court_two),
        'redTeamId', m.red_team_id,
        'blueTeamId', m.blue_team_id,
        'doneAt', m.done_at,
        'doneByTeamId', m.done_by_team_id,
        'dreambreakerWinnerId', m.dreambreaker_winner_id,
        'games', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', g.id,
            'round', g.round,
            'kind', g.kind,
            'redScore', g.red_score,
            'blueScore', g.blue_score,
            'lastEditedByKind', g.last_edited_by_kind,
            'lastEditedByTeamId', g.last_edited_by_team_id
          ) order by g.round, g.kind)
          from public.team_tally_games g
          where g.matchup_id = m.id
        ), '[]'::jsonb)
      ) order by m.stage = 'flight', m.number)
      from public.team_tally_matchups m
      where m.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.team_tally_events e
  where e.id = p_event_id;
$$;

-- ---------------------------------------------------------------------------
-- A done Matchup is locked: the backstop under every write path
-- ---------------------------------------------------------------------------

/**
 * Refuses a score change on a done Matchup's Game, whoever makes it, the
 * Organizer's direct table access included. The Organizer reopens first.
 */
create function public.team_tally_games_done_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.team_tally_matchups m
    where m.id = new.matchup_id and m.done_at is not null
  ) then
    raise exception 'This Matchup is done. Only the organizer can reopen it.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.team_tally_games_done_lock() from public;

create trigger team_tally_games_done_lock
  before update on public.team_tally_games
  for each row
  when (old.red_score is distinct from new.red_score or old.blue_score is distinct from new.blue_score)
  execute function public.team_tally_games_done_lock();

/**
 * Refuses a slot rename while the Team's current Matchup (its Flight once it
 * has one, else its opening Matchup) is done.
 */
create function public.team_tally_player_slots_done_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select m.done_at is not null
    from public.team_tally_matchups m
    where new.team_id in (m.red_team_id, m.blue_team_id)
    order by m.stage = 'flight' desc
    limit 1
  ) then
    raise exception 'This Team''s Matchup is done, so its roster is final.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.team_tally_player_slots_done_lock() from public;

create trigger team_tally_player_slots_done_lock
  before update on public.team_tally_player_slots
  for each row
  when (old.name is distinct from new.name)
  execute function public.team_tally_player_slots_done_lock();

-- write_slots checks the done lock before the scored-Round pin, so a captain
-- hears why the whole roster is closed rather than about one slot.
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
  v_current text;
begin
  if exists (
    select 1 from public.team_tally_teams t
    join public.team_tally_events e on e.id = t.event_id
    where t.id = p_team_id and e.status = 'finished'
  ) then
    raise exception 'This Team Event has finished, so its rosters are final.' using errcode = '22023';
  end if;

  if (
    select m.done_at is not null
    from public.team_tally_matchups m
    where p_team_id in (m.red_team_id, m.blue_team_id)
    order by m.stage = 'flight' desc
    limit 1
  ) then
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

  for i in 1 .. 3 loop
    select btrim(name) into v_current
    from public.team_tally_player_slots
    where team_id = p_team_id and position = v_letters[i];

    if v_current is distinct from v_next[i] and exists (
      select 1
      from public.team_tally_games g
      join public.team_tally_matchups m on m.id = g.matchup_id
      where p_team_id in (m.red_team_id, m.blue_team_id)
        and g.round = i
        and g.red_score is not null
    ) then
      raise exception 'Round % already has a score, so Player % stays %.', i, v_letters[i], v_current
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

-- ---------------------------------------------------------------------------
-- Matchup done
-- ---------------------------------------------------------------------------

/**
 * Why this Matchup can't be marked done yet, or null when it can: all six
 * Games need a score, and a tie needs its Dreambreaker winner. Mirrors
 * src/lib/team-tally/matchup-done.ts, message for message.
 */
create function public.team_tally_done_problem(p_matchup_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_matchup public.team_tally_matchups;
  v_missing record;
  v_red integer;
  v_blue integer;
begin
  select * into v_matchup from public.team_tally_matchups where id = p_matchup_id;
  if v_matchup.done_at is not null then
    return 'This Matchup is already done.';
  end if;

  select r.round, k.kind into v_missing
  from generate_series(1, 3) as r (round)
  cross join (values ('captains'), ('teammates')) as k (kind)
  where not exists (
    select 1 from public.team_tally_games g
    where g.matchup_id = p_matchup_id and g.round = r.round and g.kind = k.kind and g.red_score is not null
  )
  order by r.round, k.kind
  limit 1;

  if found then
    return format('Round %s''s %s game has no score yet.', v_missing.round,
      case v_missing.kind when 'captains' then 'captains''' else 'teammates''' end);
  end if;

  select sum(red_score), sum(blue_score) into v_red, v_blue
  from public.team_tally_games where matchup_id = p_matchup_id;

  if v_red = v_blue and v_matchup.dreambreaker_winner_id is null then
    return format('Tied %s-%s. Record who won the Dreambreaker first.', v_red, v_blue);
  end if;
  return null;
end;
$$;

revoke all on function public.team_tally_done_problem(uuid) from public;

-- ---------------------------------------------------------------------------
-- Seeding
-- ---------------------------------------------------------------------------

/**
 * Every Team of the Team Event with its seed, 1 and up, from the opening
 * round as it stands. The same sort key as src/lib/team-tally/seeding.ts:
 * Team score; point differential; the Matchup winner within a pair level on
 * both (two Teams that played each other); Games won; the Matchup winner
 * within a pair level on all three; the Organizer's tie order; setup order.
 */
create function public.team_tally_seed_order(p_event_id uuid)
returns table (team_id uuid, seed integer)
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
  ),
  paired as (
    select k.*,
      case when count(*) over (partition by k.team_score, k.diff) = 2
            and count(*) over (partition by k.team_score, k.diff, k.matchup_id) = 2
        then k.won else 0 end as pair_first,
      case when count(*) over (partition by k.team_score, k.diff, k.games_won) = 2
            and count(*) over (partition by k.team_score, k.diff, k.games_won, k.matchup_id) = 2
        then k.won else 0 end as pair_last
    from keyed k
  )
  select p.team_id,
    (row_number() over (
      order by p.team_score desc, p.diff desc, p.pair_first desc, p.games_won desc, p.pair_last desc,
        coalesce(array_position(e.tie_order, p.team_id) - 1, 1000 + p.position)
    ))::integer as seed
  from paired p
  cross join public.team_tally_events e
  where e.id = p_event_id;
$$;

revoke all on function public.team_tally_seed_order(uuid) from public;

/**
 * Places the Flights: seeds 1 and 2 are Flight A on Match 1's court pair,
 * 3 and 4 Flight B on Match 2's, and so on, the higher seed red and on the
 * pair's first court. Internal: the caller holds the Team Event's row lock
 * and has checked it is still in its opening round.
 */
create function public.team_tally_seed_flights(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid[];
  v_opening record;
  v_matchup_id uuid;
begin
  select array_agg(o.team_id order by o.seed) into v_order
  from public.team_tally_seed_order(p_event_id) o;

  for v_opening in
    select m.number, m.court_one, m.court_two
    from public.team_tally_matchups m
    where m.event_id = p_event_id and m.stage = 'opening'
    order by m.number
  loop
    insert into public.team_tally_matchups
      (event_id, stage, number, flight_letter, court_one, court_two, red_team_id, blue_team_id)
    values (
      p_event_id, 'flight', v_opening.number, chr(64 + v_opening.number),
      v_opening.court_one, v_opening.court_two,
      v_order[2 * v_opening.number - 1], v_order[2 * v_opening.number]
    )
    returning id into v_matchup_id;

    insert into public.team_tally_games (matchup_id, round, kind)
    select v_matchup_id, round, kind
    from generate_series(1, 3) as round,
         unnest(array['captains', 'teammates']) as kind;
  end loop;

  update public.team_tally_events
  set status = 'flights', seeded_at = now(), updated_at = now()
  where id = p_event_id;
end;
$$;

revoke all on function public.team_tally_seed_flights(uuid) from public;

/** Takes the Team Event's row lock and returns its status. Internal. */
create function public.team_tally_lock_event(p_event_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select status from public.team_tally_events where id = p_event_id for update;
$$;

revoke all on function public.team_tally_lock_event(uuid) from public;

/**
 * Marks a Matchup done as `p_editor_team_id` (a Team, by its Score Link) or,
 * when null, the Organizer. The last opening Matchup done places the Flights;
 * the last Flight Matchup done ends the night. Internal: the callers below
 * have decided who may.
 */
create function public.team_tally_finish_matchup(p_matchup_id uuid, p_editor_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_status text;
  v_stage text;
  v_problem text;
begin
  select m.event_id into v_event_id from public.team_tally_matchups m where m.id = p_matchup_id;
  if v_event_id is null then
    raise exception 'Matchup not found' using errcode = 'P0002';
  end if;

  -- Every done on one night queues here, so the last two done at the same
  -- moment can't both miss the Flights or both place them.
  v_status := public.team_tally_lock_event(v_event_id);

  if v_status = 'finished' then
    raise exception 'This Team Event has finished, so its scores are final.' using errcode = '22023';
  end if;

  v_problem := public.team_tally_done_problem(p_matchup_id);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '22023';
  end if;

  update public.team_tally_matchups
  set done_at = now(), done_by_team_id = p_editor_team_id
  where id = p_matchup_id
  returning stage into v_stage;

  if v_stage = 'opening' and v_status = 'opening' and not exists (
    select 1 from public.team_tally_matchups m
    where m.event_id = v_event_id and m.stage = 'opening' and m.done_at is null
  ) then
    perform public.team_tally_seed_flights(v_event_id);
  elsif v_stage = 'flight' and not exists (
    select 1 from public.team_tally_matchups m
    where m.event_id = v_event_id and m.stage = 'flight' and m.done_at is null
  ) then
    update public.team_tally_events set status = 'finished', updated_at = now() where id = v_event_id;
  end if;
end;
$$;

revoke all on function public.team_tally_finish_matchup(uuid, uuid) from public;

/** The Team behind a Score Link, if it plays in this Matchup; raises otherwise. Internal. */
create function public.team_tally_team_in_matchup(p_token text, p_matchup_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team_id uuid := public.team_tally_team_for_token(p_token);
begin
  if v_team_id is null then
    raise exception 'That Score Link isn''t valid.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.team_tally_matchups m
    where m.id = p_matchup_id and v_team_id in (m.red_team_id, m.blue_team_id)
  ) then
    raise exception 'That Matchup isn''t yours.' using errcode = '42501';
  end if;
  return v_team_id;
end;
$$;

revoke all on function public.team_tally_team_in_matchup(text, uuid) from public;

/** A captain's Matchup done, by Score Link: a Matchup their Team plays in. */
create function public.team_tally_mark_done(p_token text, p_matchup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.team_tally_finish_matchup(p_matchup_id, public.team_tally_team_in_matchup(p_token, p_matchup_id));
end;
$$;

comment on function public.team_tally_mark_done(text, uuid) is
  'A Score Link marks its Matchup done; the last opening one places the Flights (issue #624).';

revoke all on function public.team_tally_mark_done(text, uuid) from public;
grant execute on function public.team_tally_mark_done(text, uuid) to anon, authenticated;

/** True when the caller owns the Team Event this Matchup belongs to. Internal. */
create function public.team_tally_owns_matchup(p_matchup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_tally_matchups m
    where m.id = p_matchup_id and public.team_tally_owns_event(m.event_id)
  );
$$;

revoke all on function public.team_tally_owns_matchup(uuid) from public;

/** The Organizer marks any of their Matchups done. */
create function public.team_tally_organizer_mark_done(p_matchup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.team_tally_owns_matchup(p_matchup_id) then
    raise exception 'Matchup not found' using errcode = 'P0002';
  end if;
  perform public.team_tally_finish_matchup(p_matchup_id, null);
end;
$$;

revoke all on function public.team_tally_organizer_mark_done(uuid) from public;
grant execute on function public.team_tally_organizer_mark_done(uuid) to authenticated;

/**
 * The Organizer reopens a done Matchup, so its scores and slots take writes
 * again. Reopening an opening Matchup after Seeding leaves the Flights where
 * they are; reopening a Flight after the night ended puts it back in Flights.
 * Only the Organizer: a Score Link has no way to call this.
 */
create function public.team_tally_organizer_reopen(p_matchup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_status text;
  v_stage text;
begin
  if not public.team_tally_owns_matchup(p_matchup_id) then
    raise exception 'Matchup not found' using errcode = 'P0002';
  end if;

  select m.event_id into v_event_id from public.team_tally_matchups m where m.id = p_matchup_id;
  v_status := public.team_tally_lock_event(v_event_id);

  update public.team_tally_matchups
  set done_at = null, done_by_team_id = null
  where id = p_matchup_id and done_at is not null
  returning stage into v_stage;

  if v_stage is null then
    raise exception 'This Matchup isn''t done.' using errcode = '22023';
  end if;

  if v_stage = 'flight' and v_status = 'finished' then
    update public.team_tally_events set status = 'flights', updated_at = now() where id = v_event_id;
  end if;
end;
$$;

revoke all on function public.team_tally_organizer_reopen(uuid) from public;
grant execute on function public.team_tally_organizer_reopen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The Dreambreaker
-- ---------------------------------------------------------------------------

/**
 * Records who won a tied Matchup's Dreambreaker (null clears it). Only the
 * winner: its points never count. Internal.
 */
create function public.team_tally_write_dreambreaker(p_matchup_id uuid, p_winner_team_id uuid)
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

revoke all on function public.team_tally_write_dreambreaker(uuid, uuid) from public;

/** Either captain of a tied Matchup records the Dreambreaker winner. */
create function public.team_tally_set_dreambreaker(p_token text, p_matchup_id uuid, p_winner_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.team_tally_team_in_matchup(p_token, p_matchup_id);
  perform public.team_tally_write_dreambreaker(p_matchup_id, p_winner_team_id);
end;
$$;

comment on function public.team_tally_set_dreambreaker(text, uuid, uuid) is
  'A Score Link records who won its tied Matchup''s Dreambreaker (issue #624).';

revoke all on function public.team_tally_set_dreambreaker(text, uuid, uuid) from public;
grant execute on function public.team_tally_set_dreambreaker(text, uuid, uuid) to anon, authenticated;

create function public.team_tally_organizer_set_dreambreaker(p_matchup_id uuid, p_winner_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.team_tally_owns_matchup(p_matchup_id) then
    raise exception 'Matchup not found' using errcode = 'P0002';
  end if;
  perform public.team_tally_write_dreambreaker(p_matchup_id, p_winner_team_id);
end;
$$;

revoke all on function public.team_tally_organizer_set_dreambreaker(uuid, uuid) from public;
grant execute on function public.team_tally_organizer_set_dreambreaker(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The Organizer's Seeding controls
-- ---------------------------------------------------------------------------

/** Seed now: places the Flights from the scores as they stand, done or not. Once. */
create function public.team_tally_organizer_seed_now(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.team_tally_owns_event(p_event_id) then
    raise exception 'Team Event not found' using errcode = 'P0002';
  end if;
  if public.team_tally_lock_event(p_event_id) <> 'opening' then
    raise exception 'The Flights are already placed.' using errcode = '22023';
  end if;
  perform public.team_tally_seed_flights(p_event_id);
end;
$$;

revoke all on function public.team_tally_organizer_seed_now(uuid) from public;
grant execute on function public.team_tally_organizer_seed_now(uuid) to authenticated;

/**
 * Orders Teams level on every count before Seeding: the first is placed
 * ahead. Teams left out follow in setup order.
 */
create function public.team_tally_organizer_set_tie_order(p_event_id uuid, p_team_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.team_tally_owns_event(p_event_id) then
    raise exception 'Team Event not found' using errcode = 'P0002';
  end if;
  if public.team_tally_lock_event(p_event_id) <> 'opening' then
    raise exception 'The Flights are already placed.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_team_ids, '{}')) as picked (team_id)
    where not exists (
      select 1 from public.team_tally_teams t where t.id = picked.team_id and t.event_id = p_event_id
    )
  ) then
    raise exception 'That Team isn''t in this Team Event.' using errcode = '22023';
  end if;

  update public.team_tally_events
  set tie_order = coalesce(p_team_ids, '{}'), updated_at = now()
  where id = p_event_id;
end;
$$;

revoke all on function public.team_tally_organizer_set_tie_order(uuid, uuid[]) from public;
grant execute on function public.team_tally_organizer_set_tie_order(uuid, uuid[]) to authenticated;

/** Swaps two Flights' court pairs, before any Flight has a score. */
create function public.team_tally_organizer_swap_flight_courts(p_flight_id uuid, p_other_flight_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_one public.team_tally_matchups;
  v_two public.team_tally_matchups;
begin
  select * into v_one from public.team_tally_matchups where id = p_flight_id and stage = 'flight';
  select * into v_two from public.team_tally_matchups where id = p_other_flight_id and stage = 'flight';

  if v_one.id is null or v_two.id is null or v_one.event_id <> v_two.event_id
     or not public.team_tally_owns_event(v_one.event_id) then
    raise exception 'Flight not found' using errcode = 'P0002';
  end if;

  perform public.team_tally_lock_event(v_one.event_id);

  if exists (
    select 1 from public.team_tally_games g
    join public.team_tally_matchups m on m.id = g.matchup_id
    where m.event_id = v_one.event_id and m.stage = 'flight' and g.red_score is not null
  ) then
    raise exception 'A Flight has a score, so the courts stay.' using errcode = '22023';
  end if;

  update public.team_tally_matchups
  set court_one = case id when v_one.id then v_two.court_one else v_one.court_one end,
      court_two = case id when v_one.id then v_two.court_two else v_one.court_two end
  where id in (v_one.id, v_two.id);
end;
$$;

revoke all on function public.team_tally_organizer_swap_flight_courts(uuid, uuid) from public;
grant execute on function public.team_tally_organizer_swap_flight_courts(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Live: Matchups and the Team Event broadcast too
-- ---------------------------------------------------------------------------

/**
 * #623's "changed" broadcast, now also for a Matchup placed, done, reopened,
 * given a Dreambreaker winner or new courts, and for the Team Event's stage.
 */
create or replace function public.team_tally_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if tg_table_name = 'team_tally_games' then
    select m.event_id into v_event_id
    from public.team_tally_matchups m where m.id = new.matchup_id;
  elsif tg_table_name = 'team_tally_matchups' then
    v_event_id := new.event_id;
  elsif tg_table_name = 'team_tally_events' then
    v_event_id := new.id;
  else
    select t.event_id into v_event_id
    from public.team_tally_teams t where t.id = new.team_id;
  end if;

  if v_event_id is not null then
    perform realtime.send('{}'::jsonb, 'changed', 'team-tally:' || v_event_id, false);
  end if;
  return null;
end;
$$;

create trigger team_tally_matchups_broadcast
  after insert or update on public.team_tally_matchups
  for each row
  execute function public.team_tally_broadcast_change();

create trigger team_tally_events_broadcast
  after update on public.team_tally_events
  for each row
  when (old.status is distinct from new.status
     or old.seeded_at is distinct from new.seeded_at
     or old.tie_order is distinct from new.tie_order)
  execute function public.team_tally_broadcast_change();
