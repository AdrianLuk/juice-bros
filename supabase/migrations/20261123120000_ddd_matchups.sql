-- Dink Dine & Drink: Round 2 and the Playoff (issue #716, spec #709,
-- glossary dink-dine-drink/CONTEXT.md).
--
--   ddd_games          one row per Game final of a doubles Matchup: two Teams,
--                      the Game and their points. A Team pairing meets at most
--                      once in the doubles (Round 2 is 1 v 4 and 2 v 3, so the
--                      Playoff never repeats one), so the pairing and the Game
--                      are the key. Which Matchups exist, every Spread winner,
--                      shot and Matchup winner are worked out by the app
--                      (src/lib/ddd/matchups.ts): plain rows, standings on read
--                      (Team Tally's ADR 0001).
--   ddd_matchup_calls  an Organizer's call on a 2-2 Matchup, with the reason
--                      that shows on it. The tiebreak below Spread margin is
--                      provisional (D12), so the call overrides any 2-2.
--
-- A Score Link holder (anon) writes a final through ddd_save_game with the
-- token; an Organizer through the same function signed in. A Game with no
-- Spread can't be scored. Every change broadcasts on `ddd:<event id>`.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.ddd_games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ddd_events (id) on delete cascade,
  -- team_a is the Team higher in the roster order, as in ddd_spreads; the function orders them.
  team_a_id uuid not null references public.ddd_teams (id) on delete cascade,
  team_b_id uuid not null references public.ddd_teams (id) on delete cascade,
  game text not null check (game in ('mens', 'womens', 'mixed1', 'mixed2')),
  score_a smallint not null,
  score_b smallint not null,
  -- Who last wrote it: an Organizer (with their account) or the Score Link.
  last_edited_by_kind text not null check (last_edited_by_kind in ('organizer', 'score_link')),
  last_edited_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ddd_games_two_teams check (team_a_id <> team_b_id),
  -- Side-out to 11, win by 2: 11 to 0..9, or a 2-point win past 11.
  constraint ddd_games_final check (
    (greatest(score_a, score_b) = 11 and least(score_a, score_b) between 0 and 9)
    or (greatest(score_a, score_b) > 11 and abs(score_a - score_b) = 2)
  ),
  constraint ddd_games_unique unique (team_a_id, team_b_id, game)
);

create index ddd_games_event_idx on public.ddd_games (event_id);
create index ddd_games_team_b_idx on public.ddd_games (team_b_id);

comment on table public.ddd_games is
  'DDD: Round 2 and Playoff Game finals, one per Team pairing and Game. Written only through ddd_save_game.';

alter table public.ddd_games enable row level security;
create policy "Organizers read Games" on public.ddd_games for select to authenticated
  using ((select public.ddd_is_organizer()));
revoke all on public.ddd_games from anon, authenticated;
grant select on public.ddd_games to authenticated;

create table public.ddd_matchup_calls (
  -- The pair in uuid order, so a pairing is one row.
  team_a uuid not null references public.ddd_teams (id) on delete cascade,
  team_b uuid not null references public.ddd_teams (id) on delete cascade,
  winner uuid not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  primary key (team_a, team_b),
  constraint ddd_matchup_calls_order check (team_a < team_b),
  constraint ddd_matchup_calls_winner check (winner in (team_a, team_b))
);

create index ddd_matchup_calls_team_b_idx on public.ddd_matchup_calls (team_b);

comment on table public.ddd_matchup_calls is
  'DDD: an Organizer''s call on a 2-2 Matchup and why. Public through ddd_link_event.';

alter table public.ddd_matchup_calls enable row level security;
create policy "Organizers manage Matchup calls" on public.ddd_matchup_calls for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));
revoke all on public.ddd_matchup_calls from anon;
grant select, insert, update, delete on public.ddd_matchup_calls to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_save_game: enter, correct or clear a Game final
-- ---------------------------------------------------------------------------

/**
 * Saves a Game final between two Teams of one DDD, `p_score_a` for
 * `p_team_a`. With `p_token` it is the Score Link writing and the token must
 * be that DDD's Score Link; without, the caller must be an Organizer. Both
 * may correct any final; both scores null clears it, for an Organizer only.
 * A Game with no Spread is refused ("Spread needed"). An Organizer's call
 * on the Matchup stands through a correction: the app ignores it once the
 * Matchup isn't 2-2. SECURITY DEFINER because the Score Link holder is anon, with no table
 * access.
 */
create function public.ddd_save_game(
  p_token text,
  p_team_a uuid,
  p_team_b uuid,
  p_game text,
  p_score_a int,
  p_score_b int
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.ddd_events;
  v_a public.ddd_teams;
  v_b public.ddd_teams;
  v_kind text;
  v_first uuid;
  v_second uuid;
  v_score_first int := p_score_a;
  v_score_second int := p_score_b;
begin
  select * into v_a from public.ddd_teams where id = p_team_a;
  select * into v_b from public.ddd_teams where id = p_team_b;
  if v_a.id is null or v_b.id is null or v_a.event_id <> v_b.event_id or v_a.id = v_b.id then
    raise exception 'not two Teams of one DDD' using errcode = '22023';
  end if;
  if p_game is null or p_game not in ('mens', 'womens', 'mixed1', 'mixed2') then
    raise exception 'not a Game of a Lineup' using errcode = '22023';
  end if;
  select * into v_event from public.ddd_events where id = v_a.event_id;

  if nullif(btrim(coalesce(p_token, '')), '') is not null then
    if btrim(p_token) <> v_event.score_token then
      raise exception 'not this DDD''s Score Link' using errcode = '42501';
    end if;
    v_kind := 'score_link';
  elsif public.ddd_is_organizer() then
    v_kind := 'organizer';
  else
    raise exception 'Only the Score Link or an Organizer can enter a score.' using errcode = '42501';
  end if;

  -- Higher in the roster order first, as ddd_spreads stores the pairing.
  v_first := v_a.id;
  v_second := v_b.id;
  if v_a.position > v_b.position then
    v_first := v_b.id;
    v_second := v_a.id;
    v_score_first := p_score_b;
    v_score_second := p_score_a;
  end if;

  if v_score_first is null and v_score_second is null then
    if v_kind <> 'organizer' then
      raise exception 'Only an Organizer can clear a score.' using errcode = '42501';
    end if;
    delete from public.ddd_games where team_a_id = v_first and team_b_id = v_second and game = p_game;
  else
    if v_score_first is null or v_score_second is null or least(v_score_first, v_score_second) < 0
       or not ((greatest(v_score_first, v_score_second) = 11 and least(v_score_first, v_score_second) <= 9)
            or (greatest(v_score_first, v_score_second) > 11 and abs(v_score_first - v_score_second) = 2)) then
      raise exception 'a Game ends 11 to 0..9, or by 2 past 11' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.ddd_spreads s where s.team_a = v_first and s.team_b = v_second and s.game = p_game
    ) then
      raise exception 'Spread needed' using errcode = '55000';
    end if;

    insert into public.ddd_games
      (event_id, team_a_id, team_b_id, game, score_a, score_b, last_edited_by_kind, last_edited_by)
    values
      (v_event.id, v_first, v_second, p_game, v_score_first, v_score_second, v_kind,
       case when v_kind = 'organizer' then (select auth.uid()) end)
    on conflict (team_a_id, team_b_id, game) do update
      set score_a = excluded.score_a,
          score_b = excluded.score_b,
          last_edited_by_kind = excluded.last_edited_by_kind,
          last_edited_by = excluded.last_edited_by,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.ddd_save_game(text, uuid, uuid, text, int, int) from public;
grant execute on function public.ddd_save_game(text, uuid, uuid, text, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Live: Games, calls and Spreads broadcast too
-- ---------------------------------------------------------------------------

/**
 * As in #715, plus the tables keyed by a Team pairing (`team_a`): Spreads,
 * so a Spread filled in at the court opens its Game on every phone, and
 * Matchup calls.
 */
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
  elsif tg_table_name in ('ddd_spreads', 'ddd_matchup_calls') then
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

create trigger ddd_games_broadcast
  after insert or update or delete on public.ddd_games
  for each row execute function public.ddd_broadcast_change();

create trigger ddd_matchup_calls_broadcast
  after insert or update or delete on public.ddd_matchup_calls
  for each row execute function public.ddd_broadcast_change();

create trigger ddd_spreads_broadcast
  after insert or update or delete on public.ddd_spreads
  for each row execute function public.ddd_broadcast_change();

-- ---------------------------------------------------------------------------
-- ddd_link_event, with the Games and calls
-- ---------------------------------------------------------------------------

/**
 * As in #714 (`spreads`), plus `games`: every Game final in, with who last
 * edited it ('organizer' or 'score_link', never an account), and `calls`:
 * every Organizer's call on a 2-2, with its reason.
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
    ), '[]'::jsonb)
  )
  from public.ddd_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and btrim(p_token) in (e.score_token, e.public_token);
$$;
