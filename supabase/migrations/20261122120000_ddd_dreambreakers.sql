-- Dink Dine & Drink: Round 1, the Dreambreakers (issue #715, spec #709,
-- glossary dink-dine-drink/CONTEXT.md).
--
--   ddd_dreambreakers   one row per final: two Teams and their points. No row
--                       until a final is entered. Which pair plays when, and
--                       on which court, is worked out by the app from the
--                       Teams' order (src/lib/ddd/dreambreakers.ts), as is the
--                       Seeding: plain rows, standings on read (Team Tally's
--                       ADR 0001).
--   ddd_players.rotation an Organizer's Rotation order; null until one is set,
--                       and the app falls back to DUPR, highest first.
--   ddd_events.tie_order the Organizer's call on a tie that every other
--                       rule leaves level: Team ids, best first.
--
-- A Score Link holder (anon) writes a final through ddd_save_dreambreaker
-- with the token; an Organizer through the same function signed in. Every
-- change broadcasts "changed" on `ddd:<event id>` so live screens re-read.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

alter table public.ddd_players add column rotation smallint check (rotation between 1 and 30);

alter table public.ddd_events add column tie_order uuid[] not null default '{}'
  check (cardinality(tie_order) <= 4);

create table public.ddd_dreambreakers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ddd_events (id) on delete cascade,
  -- team_a is the Team higher in the roster order; the function orders them.
  team_a_id uuid not null references public.ddd_teams (id) on delete cascade,
  team_b_id uuid not null references public.ddd_teams (id) on delete cascade,
  score_a smallint not null,
  score_b smallint not null,
  -- Who last wrote it: an Organizer (with their account) or the Score Link.
  last_edited_by_kind text not null check (last_edited_by_kind in ('organizer', 'score_link')),
  last_edited_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ddd_dreambreakers_two_teams check (team_a_id <> team_b_id),
  -- Rally to 21, win by 1, freeze at 20: every final is 21 to 0..20.
  constraint ddd_dreambreakers_final check (
    (score_a = 21 and score_b between 0 and 20) or (score_b = 21 and score_a between 0 and 20)
  ),
  constraint ddd_dreambreakers_pair_unique unique (team_a_id, team_b_id)
);

create index ddd_dreambreakers_event_idx on public.ddd_dreambreakers (event_id);

comment on table public.ddd_dreambreakers is
  'DDD: Round 1 finals, one per pair of Teams. Written only through ddd_save_dreambreaker.';

alter table public.ddd_dreambreakers enable row level security;
create policy "Organizers read Dreambreakers" on public.ddd_dreambreakers for select to authenticated
  using ((select public.ddd_is_organizer()));
revoke all on public.ddd_dreambreakers from anon, authenticated;
grant select on public.ddd_dreambreakers to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_save_dreambreaker: enter, correct or clear a final
-- ---------------------------------------------------------------------------

/**
 * Saves the final between two Teams of one DDD, `p_score_a` for
 * `p_team_a`. With `p_token` it is the Score Link writing and the token must
 * be that DDD's Score Link; without, the caller must be an Organizer. Both
 * may correct any final. Both scores null clears it, for an Organizer only.
 * SECURITY DEFINER because the Score Link holder is anon, with no table
 * access.
 */
create function public.ddd_save_dreambreaker(
  p_token text,
  p_team_a uuid,
  p_team_b uuid,
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

  -- Higher in the roster order first, so one pair is always one row.
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
    delete from public.ddd_dreambreakers where team_a_id = v_first and team_b_id = v_second;
    return;
  end if;

  if v_score_first is null or v_score_second is null
     or not ((v_score_first = 21 and v_score_second between 0 and 20)
          or (v_score_second = 21 and v_score_first between 0 and 20)) then
    raise exception 'a Dreambreaker ends 21 to 0..20' using errcode = '22023';
  end if;

  insert into public.ddd_dreambreakers
    (event_id, team_a_id, team_b_id, score_a, score_b, last_edited_by_kind, last_edited_by)
  values
    (v_event.id, v_first, v_second, v_score_first, v_score_second, v_kind,
     case when v_kind = 'organizer' then (select auth.uid()) end)
  on conflict (team_a_id, team_b_id) do update
    set score_a = excluded.score_a,
        score_b = excluded.score_b,
        last_edited_by_kind = excluded.last_edited_by_kind,
        last_edited_by = excluded.last_edited_by,
        updated_at = now();
end;
$$;

revoke all on function public.ddd_save_dreambreaker(text, uuid, uuid, int, int) from public;
grant execute on function public.ddd_save_dreambreaker(text, uuid, uuid, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ddd_set_rotation: an Organizer reorders a Team's Rotation
-- ---------------------------------------------------------------------------

/**
 * Sets a Team's Rotation to `p_player_ids` in order. Players of the Team
 * left out go back to the DUPR order after them. SECURITY INVOKER: RLS keeps
 * it to Organizers.
 */
create function public.ddd_set_rotation(p_team_id uuid, p_player_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.ddd_is_organizer() then
    raise exception 'Only an Organizer can change a Rotation.' using errcode = '42501';
  end if;

  update public.ddd_players p
  set rotation = o.n
  from (
    select id, min(n)::smallint as n
    from unnest(coalesce(p_player_ids, '{}')) with ordinality as x (id, n)
    group by id
  ) o
  where p.id = o.id and p.team_id = p_team_id and o.n <= 30;

  update public.ddd_players
  set rotation = null
  where team_id = p_team_id and not (id = any (coalesce(p_player_ids, '{}')));
end;
$$;

revoke all on function public.ddd_set_rotation(uuid, uuid[]) from public, anon;
grant execute on function public.ddd_set_rotation(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Live: a broadcast on every change, carrying nothing
-- ---------------------------------------------------------------------------

/**
 * Tells a DDD's Realtime topic that something a live screen shows changed:
 * a final, the roster, a Lineup, a Rotation, the Organizer's call. The payload is
 * empty: a subscriber re-reads through its own link or session, so the
 * broadcast leaks nothing but "something changed". SECURITY DEFINER so an
 * anon Score Link write can reach realtime.messages.
 */
create function public.ddd_broadcast_change()
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

revoke all on function public.ddd_broadcast_change() from public, anon, authenticated;

create trigger ddd_dreambreakers_broadcast
  after insert or update or delete on public.ddd_dreambreakers
  for each row execute function public.ddd_broadcast_change();

create trigger ddd_lineup_pairs_broadcast
  after insert or update or delete on public.ddd_lineup_pairs
  for each row execute function public.ddd_broadcast_change();

create trigger ddd_players_broadcast
  after insert or update or delete on public.ddd_players
  for each row execute function public.ddd_broadcast_change();

create trigger ddd_teams_broadcast
  after insert or update or delete on public.ddd_teams
  for each row execute function public.ddd_broadcast_change();

create trigger ddd_events_broadcast
  after update on public.ddd_events
  for each row
  when (old.tie_order is distinct from new.tie_order)
  execute function public.ddd_broadcast_change();

-- ---------------------------------------------------------------------------
-- ddd_link_event, with Round 1
-- ---------------------------------------------------------------------------

/**
 * As in #713 (each Team's `lineup`), plus each player's `rotation`, the DDD's `tieOrder` and its
 * `dreambreakers`: every final in, with who last edited it ('organizer' or
 * 'score_link', never an account).
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
    ), '[]'::jsonb)
  )
  from public.ddd_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and btrim(p_token) in (e.score_token, e.public_token);
$$;
