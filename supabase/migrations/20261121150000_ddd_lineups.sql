-- Dink Dine & Drink: Lineups (issue #713, spec #709).
--
-- One Lineup per Team for the whole day: four Pairs (men's doubles, women's
-- doubles, mixed 1, mixed 2), two players each. The rules (3 Games, left out,
-- wrong gender, same player twice) are warnings the app shows and never
-- enforces, so a Pair may hold any two players of the Team, the same one
-- twice, or an empty slot. A player who is removed leaves an empty slot.

create table public.ddd_lineup_pairs (
  team_id uuid not null references public.ddd_teams (id) on delete cascade,
  game text not null check (game in ('mens', 'womens', 'mixed1', 'mixed2')),
  player_a uuid references public.ddd_players (id) on delete set null,
  player_b uuid references public.ddd_players (id) on delete set null,
  primary key (team_id, game)
);

alter table public.ddd_lineup_pairs enable row level security;

create policy "Organizers manage Lineups" on public.ddd_lineup_pairs for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));

revoke all on public.ddd_lineup_pairs from anon;
grant select, insert, update, delete on public.ddd_lineup_pairs to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_link_event, with each Team's Lineup
-- ---------------------------------------------------------------------------

/**
 * As in #712, plus `lineup` on each Team: { game: [player id, player id] } for
 * the Pairs that are saved, or null when none is. Public as soon as saved.
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
    ), '[]'::jsonb)
  )
  from public.ddd_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and btrim(p_token) in (e.score_token, e.public_token);
$$;
