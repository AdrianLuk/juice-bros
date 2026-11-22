-- Dink Dine & Drink: Punishments (issue #718, spec #709 D17, glossary
-- dink-dine-drink/CONTEXT.md "Punishment").
--
-- One Punishment per Final place, 1st place first: short free text an
-- Organizer edits any time, before or after the DDD. Every DDD starts with
-- bottles by place. Organizers write it through the "Organizers manage
-- DDDs" policy; the links read it through ddd_link_event.

alter table public.ddd_events
  add column punishments text[] not null
    default array['1 bottle', '2 bottles', '3 bottles', '4 bottles'],
  -- 40 is MAX_PUNISHMENT in src/lib/ddd/events.ts.
  add constraint ddd_events_punishments check (
    cardinality(punishments) = 4
    and array_position(punishments, null) is null
    and char_length(btrim(punishments[1])) between 1 and 40
    and char_length(btrim(punishments[2])) between 1 and 40
    and char_length(btrim(punishments[3])) between 1 and 40
    and char_length(btrim(punishments[4])) between 1 and 40
  );

-- A Punishment edit reaches every phone and the TV, as a tie call does.
drop trigger ddd_events_broadcast on public.ddd_events;
create trigger ddd_events_broadcast
  after update on public.ddd_events
  for each row
  when (old.tie_order is distinct from new.tie_order or old.punishments is distinct from new.punishments)
  execute function public.ddd_broadcast_change();

-- ---------------------------------------------------------------------------
-- ddd_link_event, with the Punishments
-- ---------------------------------------------------------------------------

/** As in #717, plus `punishments`: the four, 1st place first. */
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
