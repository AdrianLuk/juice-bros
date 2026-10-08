-- Team Tally: Score Links and live scoring (issue #623, spec #621).
--
-- Captains report scores from their Score Link, with no account; either Team
-- of a Matchup can enter or correct any of its six Games, and each Game keeps
-- which Team (or the Organizer) last saved it. Standings are computed on read
-- from these rows (team-tally/docs/adr/0001), so nothing derived is stored.
--
--   team_tally_score_problem     the one score rule, as a message or null
--   team_tally_event_doc         a Team Event as one JSON document (internal)
--   team_tally_public_event      the Public Link read, now via the document
--   team_tally_score_link_event  a Score Link read: the document plus myTeamId
--   team_tally_score_game        a Score Link's write, own Matchup only
--   team_tally_set_slots         a Score Link renames or reorders A, B, C
--   team_tally_organizer_*       the Organizer's read and writes, any Team
--
-- `anon` still has no table access: a link holder reaches the rows only
-- through the token functions below, each SECURITY DEFINER and keyed on the
-- token, the same posture as #622's Public Link read.
--
-- Live: a trigger on Games and Player slots broadcasts "changed" on the
-- public Realtime topic `team-tally:<event id>`, with no data in it. Postgres
-- Changes can't serve a link holder, because Realtime applies the table's
-- SELECT policies per subscriber and `anon` has none. The clients only
-- invalidate on the broadcast and re-read through their token function.

-- ---------------------------------------------------------------------------
-- The score rule
-- ---------------------------------------------------------------------------

/**
 * Why a Game can't have this score, or null when it can. A Game is first to
 * 11, win by 2, or a 15-minute cap, so a side past 11 leading by more than 2
 * can't happen: 13-9 was over at 11-9. Ties and time-capped scores save. Both
 * null clears a Game. Mirrors src/lib/team-tally/score.ts, message for message.
 */
create function public.team_tally_score_problem(p_red integer, p_blue integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_red is null and p_blue is null then null
    when p_red is null or p_blue is null then 'A score needs both sides.'
    when p_red not between 0 and 99 or p_blue not between 0 and 99
      then 'A score is a whole number from 0 to 99.'
    when greatest(p_red, p_blue) <= 11 or abs(p_red - p_blue) <= 2 then null
    when p_red > p_blue then format(
      '%s-%s can''t happen: the game ends at %s-%s',
      p_red, p_blue, case when p_blue <= 9 then 11 else p_blue + 2 end, p_blue)
    else format(
      '%s-%s can''t happen: the game ends at %s-%s',
      p_red, p_blue, p_red, case when p_red <= 9 then 11 else p_red + 2 end)
  end;
$$;

comment on function public.team_tally_score_problem(integer, integer) is
  'Why a Team Tally Game cannot have this score (a side past 11 leading by more than 2), or null (issue #623).';

revoke all on function public.team_tally_score_problem(integer, integer) from public;
grant execute on function public.team_tally_score_problem(integer, integer) to anon, authenticated;

-- The backstop under every write path, the Organizer's direct table access
-- included.
alter table public.team_tally_games
  add constraint team_tally_games_possible_score
  check (public.team_tally_score_problem(red_score, blue_score) is null);

-- ---------------------------------------------------------------------------
-- The document every reader gets
-- ---------------------------------------------------------------------------

/**
 * A Team Event as one JSON document: the night, its Teams with their Player
 * slots, and every Matchup with its Games (each with its id, for a write).
 * Never carries a Score Link token, the Public Link token or the owner.
 * Internal: callable only through the token and Organizer functions below.
 */
create function public.team_tally_event_doc(p_event_id uuid)
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

revoke all on function public.team_tally_event_doc(uuid) from public;

/** #622's Public Link read, now the shared document (it gains each Game's id). */
create or replace function public.team_tally_public_event(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.team_tally_event_doc(e.id)
  from public.team_tally_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and e.public_token = btrim(p_token);
$$;

/** The Team behind a Score Link token, or null. Internal. */
create function public.team_tally_team_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.team_tally_teams t
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and t.score_token = btrim(p_token);
$$;

revoke all on function public.team_tally_team_for_token(text) from public;

/**
 * What a Score Link shows: the whole Team Event (the standings need every
 * Matchup) and `myTeamId`, the Team the token belongs to. Null for any token
 * that isn't a Score Link token.
 */
create function public.team_tally_score_link_event(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.team_tally_event_doc(t.event_id) || jsonb_build_object('myTeamId', t.id)
  from public.team_tally_teams t
  where t.id = public.team_tally_team_for_token(p_token);
$$;

comment on function public.team_tally_score_link_event(text) is
  'The Team Event behind a Score Link token, with myTeamId, or null. Callable by anon; never returns a token (issue #623).';

revoke all on function public.team_tally_score_link_event(text) from public;
grant execute on function public.team_tally_score_link_event(text) to anon, authenticated;

/** The Organizer's own running Team Event as the same document, or null. */
create function public.team_tally_organizer_event(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.team_tally_owns_event(p_event_id)
    then public.team_tally_event_doc(p_event_id)
  end;
$$;

revoke all on function public.team_tally_organizer_event(uuid) from public;
grant execute on function public.team_tally_organizer_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------------

/**
 * Saves a Game's score as `p_editor_team_id` (a Team, by its Score Link) or,
 * when that is null, as the Organizer. Refuses a score no Game can end on,
 * with the reason, and anything once the Team Event has finished. Internal:
 * the callers below have already decided who may write this Game.
 */
create function public.team_tally_write_score(
  p_game_id uuid,
  p_red integer,
  p_blue integer,
  p_editor_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_problem text := public.team_tally_score_problem(p_red, p_blue);
begin
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.team_tally_games g
    join public.team_tally_matchups m on m.id = g.matchup_id
    join public.team_tally_events e on e.id = m.event_id
    where g.id = p_game_id and e.status = 'finished'
  ) then
    raise exception 'This Team Event has finished, so its scores are final.' using errcode = '22023';
  end if;

  update public.team_tally_games
  set red_score = p_red,
      blue_score = p_blue,
      last_edited_by_kind = case when p_editor_team_id is null then 'organizer' else 'team' end,
      last_edited_by_team_id = p_editor_team_id,
      updated_at = now()
  where id = p_game_id;
end;
$$;

revoke all on function public.team_tally_write_score(uuid, integer, integer, uuid) from public;

/**
 * A captain's score, by Score Link: any Game of a Matchup their Team plays in,
 * nothing else.
 */
create function public.team_tally_score_game(
  p_token text,
  p_game_id uuid,
  p_red integer,
  p_blue integer
)
returns void
language plpgsql
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
    select 1
    from public.team_tally_games g
    join public.team_tally_matchups m on m.id = g.matchup_id
    where g.id = p_game_id
      and v_team_id in (m.red_team_id, m.blue_team_id)
  ) then
    raise exception 'That Game isn''t in your Matchup.' using errcode = '42501';
  end if;

  perform public.team_tally_write_score(p_game_id, p_red, p_blue, v_team_id);
end;
$$;

comment on function public.team_tally_score_game(text, uuid, integer, integer) is
  'A Score Link''s write: a Game of a Matchup its Team plays in, recorded as that Team (issue #623).';

revoke all on function public.team_tally_score_game(text, uuid, integer, integer) from public;
grant execute on function public.team_tally_score_game(text, uuid, integer, integer) to anon, authenticated;

/** The Organizer's score: any Game of their own Team Event. */
create function public.team_tally_organizer_score_game(
  p_game_id uuid,
  p_red integer,
  p_blue integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.team_tally_games g
    join public.team_tally_matchups m on m.id = g.matchup_id
    where g.id = p_game_id and public.team_tally_owns_event(m.event_id)
  ) then
    raise exception 'Game not found' using errcode = 'P0002';
  end if;

  perform public.team_tally_write_score(p_game_id, p_red, p_blue, null);
end;
$$;

revoke all on function public.team_tally_organizer_score_game(uuid, integer, integer) from public;
grant execute on function public.team_tally_organizer_score_game(uuid, integer, integer) to authenticated;

/**
 * Renames or reorders a Team's slots A, B and C. Slot N partners the captain
 * in Round N, so a Round with a score (in any Matchup the Team plays) pins
 * its slot. Mirrors src/lib/team-tally/roster.ts, message for message.
 * Internal.
 */
create function public.team_tally_write_slots(
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

revoke all on function public.team_tally_write_slots(uuid, text, text, text) from public;

/** A captain renames or reorders their own Team's slots, by Score Link. */
create function public.team_tally_set_slots(
  p_token text,
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
  v_team_id uuid := public.team_tally_team_for_token(p_token);
begin
  if v_team_id is null then
    raise exception 'That Score Link isn''t valid.' using errcode = '42501';
  end if;

  perform public.team_tally_write_slots(v_team_id, p_slot_a, p_slot_b, p_slot_c);
end;
$$;

comment on function public.team_tally_set_slots(text, text, text, text) is
  'A Score Link renames or reorders its own Team''s slots A, B, C; a scored Round''s slot stays (issue #623).';

revoke all on function public.team_tally_set_slots(text, text, text, text) from public;
grant execute on function public.team_tally_set_slots(text, text, text, text) to anon, authenticated;

/** The Organizer renames or reorders any of their Teams' slots. */
create function public.team_tally_organizer_set_slots(
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
begin
  if not exists (
    select 1 from public.team_tally_teams t
    where t.id = p_team_id and public.team_tally_owns_event(t.event_id)
  ) then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;

  perform public.team_tally_write_slots(p_team_id, p_slot_a, p_slot_b, p_slot_c);
end;
$$;

revoke all on function public.team_tally_organizer_set_slots(uuid, text, text, text) from public;
grant execute on function public.team_tally_organizer_set_slots(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Live: a broadcast on every change, carrying nothing
-- ---------------------------------------------------------------------------

/**
 * Tells the Team Event's Realtime topic that a Game or a Player slot changed.
 * The payload is empty on purpose: a subscriber re-reads through its own
 * token function, so the broadcast leaks nothing but "something changed".
 * SECURITY DEFINER so an Organizer's save can write realtime.messages.
 */
create function public.team_tally_broadcast_change()
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

revoke all on function public.team_tally_broadcast_change() from public;

create trigger team_tally_games_broadcast
  after update on public.team_tally_games
  for each row
  when (old.red_score is distinct from new.red_score
     or old.blue_score is distinct from new.blue_score
     or old.last_edited_by_kind is distinct from new.last_edited_by_kind
     or old.last_edited_by_team_id is distinct from new.last_edited_by_team_id)
  execute function public.team_tally_broadcast_change();

create trigger team_tally_player_slots_broadcast
  after update on public.team_tally_player_slots
  for each row
  when (old.name is distinct from new.name)
  execute function public.team_tally_broadcast_change();
