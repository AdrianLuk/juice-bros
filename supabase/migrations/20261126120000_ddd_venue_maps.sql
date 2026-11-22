-- Dink Dine & Drink: map links for both venues (issue #734).
--
-- Each venue can carry a map link, so players tap through to find it. The
-- dine & drink venue takes a name, a map link or both. Only http(s) links
-- save: the header renders them as hrefs. 500 is MAX_MAP_LINK in
-- src/lib/ddd/events.ts.

alter table public.ddd_events
  add column play_venue_map text check (
    play_venue_map ~* '^https?://[^/\s]+\.[^\s]*$' and char_length(play_venue_map) <= 500
  ),
  add column dine_venue_map text check (
    dine_venue_map ~* '^https?://[^/\s]+\.[^\s]*$' and char_length(dine_venue_map) <= 500
  ),
  drop constraint ddd_events_dine_venue_check,
  add constraint ddd_events_dine_venue_check check (
    char_length(btrim(dine_venue)) <= 60
    and (btrim(dine_venue) <> '' or dine_venue_map is not null)
  );

-- ---------------------------------------------------------------------------
-- ddd_save_event, with the map links
-- ---------------------------------------------------------------------------

drop function public.ddd_save_event(uuid, text, date, text, text, text[]);

/**
 * As in #711, plus a map link for each venue (null for none). The links
 * default to null, so a call without them still saves.
 */
create function public.ddd_save_event(
  p_event_id uuid,
  p_name text,
  p_event_date date,
  p_play_venue text,
  p_dine_venue text,
  p_courts text[],
  p_play_venue_map text default null,
  p_dine_venue_map text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_courts text[] := array(select btrim(c) from unnest(coalesce(p_courts, '{}')) as c);
begin
  if not public.ddd_is_organizer() then
    raise exception 'Only an Organizer can set up a DDD.' using errcode = '42501';
  end if;

  if cardinality(v_courts) not between 1 and 20 then
    raise exception 'a DDD needs 1 to 20 courts' using errcode = '22023';
  end if;

  if (select count(distinct c) from unnest(v_courts) as c) <> cardinality(v_courts) then
    raise exception 'two courts share a name' using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.ddd_events (name, event_date, play_venue, dine_venue, play_venue_map, dine_venue_map)
    values (
      btrim(p_name), p_event_date, btrim(p_play_venue), btrim(p_dine_venue),
      nullif(btrim(p_play_venue_map), ''), nullif(btrim(p_dine_venue_map), '')
    )
    returning id into v_event_id;
  else
    update public.ddd_events
    set name = btrim(p_name), event_date = p_event_date,
        play_venue = btrim(p_play_venue), dine_venue = btrim(p_dine_venue),
        play_venue_map = nullif(btrim(p_play_venue_map), ''),
        dine_venue_map = nullif(btrim(p_dine_venue_map), ''),
        updated_at = now()
    where id = p_event_id
    returning id into v_event_id;

    if v_event_id is null then
      raise exception 'DDD not found' using errcode = 'P0002';
    end if;
  end if;

  -- In place by position, not delete-and-insert: Games and court
  -- assignments hang on these rows, and a setup edit must not drop them.
  insert into public.ddd_courts (event_id, position, name)
  select v_event_id, ordinality, name
  from unnest(v_courts) with ordinality as c (name, ordinality)
  on conflict (event_id, position) do update set name = excluded.name;

  delete from public.ddd_courts
  where event_id = v_event_id and position > cardinality(v_courts);

  return v_event_id;
end;
$$;

revoke all on function public.ddd_save_event(uuid, text, date, text, text, text[], text, text) from public, anon;
grant execute on function public.ddd_save_event(uuid, text, date, text, text, text[], text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_link_event, with the map links
-- ---------------------------------------------------------------------------

/** As in #718, plus `playVenueMap` and `dineVenueMap`: null for a venue with no link. */
create or replace function public.ddd_link_event(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'link', case when e.score_token = btrim(p_token) then 'score' else 'public' end,
    'id', e.id,
    'name', e.name,
    'date', e.event_date,
    'playVenue', e.play_venue,
    'dineVenue', e.dine_venue,
    'playVenueMap', e.play_venue_map,
    'dineVenueMap', e.dine_venue_map,
    'courts', coalesce((
      select jsonb_agg(c.name order by c.position)
      from public.ddd_courts c
      where c.event_id = e.id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'players', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'gender', p.gender,
                'dupr', p.dupr,
                'duar', p.duar,
                'dusr', p.dusr,
                'rotation', p.rotation
              ) order by p.position
            )
            from public.ddd_players p
            where p.team_id = t.id
          ), '[]'::jsonb),
          'lineup', (
            select jsonb_object_agg(l.game, jsonb_build_array(l.player_a, l.player_b))
            from public.ddd_lineup_pairs l
            where l.team_id = t.id
          )
        ) order by t.position
      )
      from public.ddd_teams t
      where t.event_id = e.id
    ), '[]'::jsonb),
    'tieOrder', to_jsonb(e.tie_order),
    'punishments', to_jsonb(e.punishments),
    'dreambreakers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teamA', d.team_a_id,
          'teamB', d.team_b_id,
          'scoreA', d.score_a,
          'scoreB', d.score_b,
          'editedBy', d.last_edited_by_kind,
          'editedAt', d.updated_at
        ) order by d.updated_at
      )
      from public.ddd_dreambreakers d
      where d.event_id = e.id
    ), '[]'::jsonb),
    'spreads', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teamA', s.team_a,
          'teamB', s.team_b,
          'game', s.game,
          'lower', s.lower,
          'points', s.points,
          'sig', s.sig
        )
      )
      from public.ddd_spreads s
      join public.ddd_teams t on t.id = s.team_a
      where t.event_id = e.id
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teamA', g.team_a_id,
          'teamB', g.team_b_id,
          'game', g.game,
          'scoreA', g.score_a,
          'scoreB', g.score_b,
          'editedBy', g.last_edited_by_kind,
          'editedAt', g.updated_at
        ) order by g.updated_at
      )
      from public.ddd_games g
      where g.event_id = e.id
    ), '[]'::jsonb),
    'calls', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teamA', c.team_a,
          'teamB', c.team_b,
          'winner', c.winner,
          'reason', c.reason
        )
      )
      from public.ddd_matchup_calls c
      join public.ddd_teams t on t.id = c.team_a
      where t.event_id = e.id
    ), '[]'::jsonb),
    'courtPlans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teamA', p.team_a,
          'teamB', p.team_b,
          'swapped', p.swapped,
          'moves', p.moves
        )
      )
      from public.ddd_court_plans p
      join public.ddd_teams t on t.id = p.team_a
      where t.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.ddd_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and btrim(p_token) in (e.score_token, e.public_token);
$$;
