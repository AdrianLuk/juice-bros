-- Dink Dine & Drink: the 24 Spreads (issue #714, spec #709).
--
-- One Spread per Game of every Team pairing: 6 pairings x 4 Games. `team_a`
-- is the earlier Team (by position) and `team_b` the later; `lower` says
-- which side's Pair is the lower-rated one, and `points` is what it is
-- forecast to score. A Spread always ends in .5 and runs 0.5 to 10.5.
-- `sig` is the two Pairs' players when the Spread was set, so the app can
-- flag a Spread whose Lineup has changed since, without clearing it.

create table public.ddd_spreads (
  team_a uuid not null references public.ddd_teams (id) on delete cascade,
  team_b uuid not null references public.ddd_teams (id) on delete cascade,
  game text not null check (game in ('mens', 'womens', 'mixed1', 'mixed2')),
  lower text not null check (lower in ('a', 'b')),
  points numeric(3, 1) not null check (points between 0.5 and 10.5 and points - floor(points) = 0.5),
  sig text not null,
  primary key (team_a, team_b, game),
  constraint ddd_spreads_two_teams check (team_a <> team_b)
);

create index ddd_spreads_team_b_idx on public.ddd_spreads (team_b);

alter table public.ddd_spreads enable row level security;

create policy "Organizers manage Spreads" on public.ddd_spreads for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));

revoke all on public.ddd_spreads from anon;
grant select, insert, update, delete on public.ddd_spreads to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_link_event, with the Spreads
-- ---------------------------------------------------------------------------

/**
 * As in #713, plus `spreads`: every saved Spread as
 * { teamA, teamB, game, lower, points, sig }. Public as soon as saved.
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
    ), '[]'::jsonb)
  )
  from public.ddd_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and btrim(p_token) in (e.score_token, e.public_token);
$$;
