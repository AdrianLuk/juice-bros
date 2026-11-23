-- Dink Dine & Drink: short Public and Score Links.
--
-- The links were 32 hex characters, hard to type on a venue TV. They become:
--   * Public Link: 5 characters. It only reads, so a guess shows scores and
--     nothing more (32^5, about 33 million).
--   * Score Link: 10 characters. It writes scores, so it stays out of reach
--     of guessing (32^10, about 10^15).
-- The alphabet leaves out 0, 1, l and o, which read alike. 32 symbols, so a
-- random byte mod 32 picks one with no bias.
-- Invite tokens are not touched: they make an Organizer and stay long.
-- Existing DDDs get new links here, so links shared before this stop working.

-- ---------------------------------------------------------------------------
-- The generator
-- ---------------------------------------------------------------------------

/** A random token of `p_length` characters from the 32 that don't read alike. */
create function public.ddd_short_token(p_length integer)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('23456789abcdefghijkmnpqrstuvwxyz', 1 + get_byte(b.bytes, i) % 32, 1), '' order by i)
  from (select extensions.gen_random_bytes(p_length) as bytes) b,
       generate_series(0, p_length - 1) i;
$$;

-- Column defaults run as whoever inserts: an Organizer through ddd_save_event.
revoke all on function public.ddd_short_token(integer) from public, anon;
grant execute on function public.ddd_short_token(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- The columns
-- ---------------------------------------------------------------------------

-- shortcut: a 5-character Public Link collides about once in 8,000 DDDs, and
-- the unique constraint then refuses that save. Retry in the insert if DDDs
-- ever number in the thousands.
alter table public.ddd_events
  drop constraint ddd_events_score_token_check,
  drop constraint ddd_events_public_token_check,
  alter column score_token set default public.ddd_short_token(10),
  alter column public_token set default public.ddd_short_token(5),
  add constraint ddd_events_score_token_check check (char_length(score_token) between 10 and 128),
  add constraint ddd_events_public_token_check check (char_length(public_token) between 5 and 128);

update public.ddd_events
set score_token = public.ddd_short_token(10),
    public_token = public.ddd_short_token(5);

-- ---------------------------------------------------------------------------
-- ddd_link_event, opening a 5-character token
-- ---------------------------------------------------------------------------


/** As in #734, but a token of 5 characters or more opens it: the Public Link is 5. */
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
  where char_length(btrim(coalesce(p_token, ''))) >= 5
    and btrim(p_token) in (e.score_token, e.public_token);
$$;
