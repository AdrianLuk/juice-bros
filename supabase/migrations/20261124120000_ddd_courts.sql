-- Dink Dine & Drink: courts and Court turns (issue #717, spec #709,
-- glossary dink-dine-drink/CONTEXT.md).
--
-- Which Games of a Matchup share a Court turn, and the court each plays on,
-- are worked out by the app from the Lineups and the Matchup
-- (src/lib/ddd/courts.ts). This table holds only an Organizer's changes to
-- that plan, per Team pairing: the Court turns swapped, and Games moved to
-- another court (Game to court index, court 1 is 0). A pairing meets at
-- most once in the doubles, so the pairing is the key; team_a is the Team
-- earlier in the roster, as in ddd_spreads and ddd_games.

create table public.ddd_court_plans (
  team_a uuid not null references public.ddd_teams (id) on delete cascade,
  team_b uuid not null references public.ddd_teams (id) on delete cascade,
  swapped boolean not null default false,
  moves jsonb not null default '{}'::jsonb check (jsonb_typeof(moves) = 'object'),
  primary key (team_a, team_b),
  constraint ddd_court_plans_two_teams check (team_a <> team_b)
);

create index ddd_court_plans_team_b_idx on public.ddd_court_plans (team_b);

comment on table public.ddd_court_plans is
  'DDD: an Organizer''s changes to a Matchup''s courts. Public through ddd_link_event.';

alter table public.ddd_court_plans enable row level security;
create policy "Organizers manage court plans" on public.ddd_court_plans for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));
revoke all on public.ddd_court_plans from anon;
grant select, insert, update, delete on public.ddd_court_plans to authenticated;

-- ---------------------------------------------------------------------------
-- Live: a moved Game or swapped Court turn reaches every phone
-- ---------------------------------------------------------------------------

/** As in #716, plus ddd_court_plans (keyed by its pairing's team_a). */
create or replace function public.ddd_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record := coalesce(new, old);
  v_event_id uuid;
begin
  if tg_table_name in ('ddd_players', 'ddd_lineup_pairs') then
    select t.event_id into v_event_id from public.ddd_teams t where t.id = v_row.team_id;
  elsif tg_table_name in ('ddd_spreads', 'ddd_matchup_calls', 'ddd_court_plans') then
    select t.event_id into v_event_id from public.ddd_teams t where t.id = v_row.team_a;
  elsif tg_table_name = 'ddd_events' then
    v_event_id := v_row.id;
  else
    v_event_id := v_row.event_id;
  end if;

  if v_event_id is not null then
    perform realtime.send('{}'::jsonb, 'changed', 'ddd:' || v_event_id, false);
  end if;
  return null;
end;
$$;

create trigger ddd_court_plans_broadcast
  after insert or update or delete on public.ddd_court_plans
  for each row execute function public.ddd_broadcast_change();

-- ---------------------------------------------------------------------------
-- ddd_link_event, with the court plans
-- ---------------------------------------------------------------------------

/**
 * As in #716 (`games`, `calls`), plus `courtPlans`: every Organizer's
 * change to a Matchup's courts, as { teamA, teamB, swapped, moves }.
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
