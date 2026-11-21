-- Dink Dine & Drink: the roster paste (issue #712, spec #709).
--
-- The Teams and players tables came with #711. This adds the one call that
-- replaces a roster in a single transaction, and puts the Teams with their
-- players on what a Score Link or Public Link opens. Editing, adding,
-- removing and moving a player are plain row writes under the Organizer RLS
-- policies; they need nothing here.

-- ---------------------------------------------------------------------------
-- ddd_replace_roster
-- ---------------------------------------------------------------------------

/**
 * Replaces a DDD's Teams and players with `p_teams`:
 *   [{ "name": "...", "players": [{ "name", "gender", "dupr", "duar", "dusr" }] }]
 * in order. SECURITY INVOKER, so RLS refuses anyone off the Organizer list.
 * Exactly 4 Teams (D21). The app parses and validates the paste first
 * (src/lib/ddd/roster.ts); the table checks are the backstop.
 */
create function public.ddd_replace_roster(p_event_id uuid, p_teams jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_team jsonb;
  v_team_id uuid;
  v_team_n int := 0;
  v_player jsonb;
  v_player_n int;
begin
  if not public.ddd_is_organizer() then
    raise exception 'Only an Organizer can set the roster.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.ddd_events where id = p_event_id) then
    raise exception 'DDD not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_teams) is distinct from 'array' or jsonb_array_length(p_teams) <> 4 then
    raise exception 'a DDD has exactly 4 Teams' using errcode = '22023';
  end if;

  delete from public.ddd_teams where event_id = p_event_id;

  for v_team in select * from jsonb_array_elements(p_teams) loop
    v_team_n := v_team_n + 1;
    insert into public.ddd_teams (event_id, name, position)
    values (p_event_id, btrim(v_team ->> 'name'), v_team_n)
    returning id into v_team_id;

    v_player_n := 0;
    for v_player in select * from jsonb_array_elements(v_team -> 'players') loop
      v_player_n := v_player_n + 1;
      insert into public.ddd_players (team_id, position, name, gender, dupr, duar, dusr)
      values (
        v_team_id,
        v_player_n,
        btrim(v_player ->> 'name'),
        v_player ->> 'gender',
        (v_player ->> 'dupr')::numeric,
        (v_player ->> 'duar')::numeric,
        (v_player ->> 'dusr')::numeric
      );
    end loop;
  end loop;

  update public.ddd_events set updated_at = now() where id = p_event_id;
end;
$$;

revoke all on function public.ddd_replace_roster(uuid, jsonb) from public, anon;
grant execute on function public.ddd_replace_roster(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_link_event, with the Teams
-- ---------------------------------------------------------------------------

/**
 * As in #711, plus `teams`: each Team with its players, in order. Ratings
 * come as numbers or null; the Average Rating is computed by the app.
 */
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
                'dusr', p.dusr
              ) order by p.position
            )
            from public.ddd_players p
            where p.team_id = t.id
          ), '[]'::jsonb)
        ) order by t.position
      )
      from public.ddd_teams t
      where t.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.ddd_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and btrim(p_token) in (e.score_token, e.public_token);
$$;
