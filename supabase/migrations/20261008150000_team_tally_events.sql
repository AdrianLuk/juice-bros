-- Team Tally: a Team Event, its Teams, Matchups and Games (issue #622, spec
-- #621).
--
-- Plain rows, not an event log (team-tally/docs/adr/0001): a night is about
-- fifty numbers corrected in place, and standings, Seeding and Final places
-- are computed from these rows on read, never stored.
--
--   team_tally_events        one night, owned by the Organizer who built it
--   team_tally_teams         four players for one night, with a home court
--                            and the token behind its Score Link
--   team_tally_player_slots  captain, A, B, C: names only, never accounts
--   team_tally_matchups      two Teams on a court pair; opening or Flight
--   team_tally_games         one scored game: round 1-3, captains' or
--                            teammates', two scores and who last edited it
--
-- Access, three ways (team-tally/CONTEXT.md, "Links"):
--
--   * the Organizer (`authenticated`) reads and writes only their own Team
--     Events, by RLS on every table;
--   * a captain's Score Link and the Public Link are bearer tokens with no
--     account. `anon` gets no table access at all; everything a link holder
--     sees goes through a SECURITY DEFINER function keyed on the token. This
--     migration adds the Public Link read; the Score Link's read and write
--     arrive with live scoring (#623), on the token column added here.
--
-- Teams of a Matchup are tied to the Matchup's own Team Event by composite
-- foreign keys, so no row can pair Teams from two different nights.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.team_tally_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  event_date date not null,
  -- The two stages, then the results page (CONTEXT.md, "Team Event").
  status text not null default 'opening'
    check (status in ('opening', 'flights', 'finished')),
  -- Bearer secret behind the Public Link: 32 hex chars, ~122 bits.
  public_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(public_token) between 24 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_tally_events_owner_date_idx
  on public.team_tally_events (owner_id, event_date desc);

comment on table public.team_tally_events is
  'Team Tally: one night of captained team play, owned by the Organizer who built it (issue #622).';
comment on column public.team_tally_events.public_token is
  'Bearer secret behind the Public Link. Read by the owner to print it in the Brief; anon reaches the Team Event only through team_tally_public_event.';

create table public.team_tally_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.team_tally_events (id) on delete cascade,
  -- Order in the Organizer's setup.
  position smallint not null check (position between 0 and 13),
  nickname text check (nickname is null or char_length(btrim(nickname)) between 1 and 60),
  home_court text not null check (char_length(btrim(home_court)) between 1 and 20),
  -- Bearer secret behind this Team's Score Link (#623 reads it).
  score_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(score_token) between 24 and 128),
  created_at timestamptz not null default now(),
  -- Deferred so a save can reorder Teams, or move home courts between them,
  -- without tripping over its own half-written state.
  constraint team_tally_teams_position_unique
    unique (event_id, position) deferrable initially deferred,
  constraint team_tally_teams_home_court_unique
    unique (event_id, home_court) deferrable initially deferred,
  -- Target of the Matchups' composite foreign keys.
  constraint team_tally_teams_id_event_unique unique (id, event_id)
);

comment on column public.team_tally_teams.score_token is
  'Bearer secret behind this Team''s Score Link. Never returned by team_tally_public_event.';

create table public.team_tally_player_slots (
  team_id uuid not null references public.team_tally_teams (id) on delete cascade,
  position text not null check (position in ('captain', 'A', 'B', 'C')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  primary key (team_id, position)
);

create table public.team_tally_matchups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.team_tally_events (id) on delete cascade,
  stage text not null check (stage in ('opening', 'flight')),
  -- Opening: the Brief's "MATCH n". Flight: 1 for Flight A, 2 for B...
  number smallint not null check (number between 1 and 7),
  flight_letter text check (flight_letter in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  court_one text not null check (char_length(btrim(court_one)) between 1 and 20),
  court_two text not null check (char_length(btrim(court_two)) between 1 and 20),
  -- The Brief prints the first Team with 🔴 and the second with 🔵.
  red_team_id uuid not null,
  blue_team_id uuid not null,
  created_at timestamptz not null default now(),
  constraint team_tally_matchups_two_teams check (red_team_id <> blue_team_id),
  constraint team_tally_matchups_court_pair check (court_one <> court_two),
  constraint team_tally_matchups_flight_letter check (
    (stage = 'opening' and flight_letter is null)
    or (stage = 'flight' and flight_letter is not null)
  ),
  constraint team_tally_matchups_number_unique
    unique (event_id, stage, number) deferrable initially deferred,
  foreign key (red_team_id, event_id)
    references public.team_tally_teams (id, event_id) on delete cascade,
  foreign key (blue_team_id, event_id)
    references public.team_tally_teams (id, event_id) on delete cascade
);

create index team_tally_matchups_event_idx on public.team_tally_matchups (event_id);
create index team_tally_matchups_red_idx on public.team_tally_matchups (red_team_id);
create index team_tally_matchups_blue_idx on public.team_tally_matchups (blue_team_id);

create table public.team_tally_games (
  id uuid primary key default gen_random_uuid(),
  matchup_id uuid not null references public.team_tally_matchups (id) on delete cascade,
  round smallint not null check (round between 1 and 3),
  kind text not null check (kind in ('captains', 'teammates')),
  red_score smallint check (red_score between 0 and 99),
  blue_score smallint check (blue_score between 0 and 99),
  -- Who last edited the score: a Team (by its Score Link) or the Organizer.
  last_edited_by_kind text check (last_edited_by_kind in ('team', 'organizer')),
  last_edited_by_team_id uuid references public.team_tally_teams (id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint team_tally_games_scores_together
    check ((red_score is null) = (blue_score is null)),
  constraint team_tally_games_editor check (
    (last_edited_by_kind = 'team') = (last_edited_by_team_id is not null)
  ),
  unique (matchup_id, round, kind)
);

create index team_tally_games_editor_idx on public.team_tally_games (last_edited_by_team_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: an Organizer reaches only their own Team Events
-- ---------------------------------------------------------------------------

/**
 * True when the caller owns this Team Event. SECURITY DEFINER so the child
 * tables' policies can ask without each re-running the events policy; it
 * answers only for the caller's own `auth.uid()`.
 */
create function public.team_tally_owns_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_tally_events
    where id = p_event_id and owner_id = (select auth.uid())
  );
$$;

revoke all on function public.team_tally_owns_event(uuid) from public;
grant execute on function public.team_tally_owns_event(uuid) to authenticated;

alter table public.team_tally_events enable row level security;
alter table public.team_tally_teams enable row level security;
alter table public.team_tally_player_slots enable row level security;
alter table public.team_tally_matchups enable row level security;
alter table public.team_tally_games enable row level security;

create policy "Organizers manage their own Team Events"
  on public.team_tally_events for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Organizers manage their own Teams"
  on public.team_tally_teams for all to authenticated
  using (public.team_tally_owns_event(event_id))
  with check (public.team_tally_owns_event(event_id));

create policy "Organizers manage their own Player slots"
  on public.team_tally_player_slots for all to authenticated
  using (public.team_tally_owns_event(
    (select t.event_id from public.team_tally_teams t where t.id = team_id)))
  with check (public.team_tally_owns_event(
    (select t.event_id from public.team_tally_teams t where t.id = team_id)));

create policy "Organizers manage their own Matchups"
  on public.team_tally_matchups for all to authenticated
  using (public.team_tally_owns_event(event_id))
  with check (public.team_tally_owns_event(event_id));

create policy "Organizers manage their own Games"
  on public.team_tally_games for all to authenticated
  using (public.team_tally_owns_event(
    (select m.event_id from public.team_tally_matchups m where m.id = matchup_id)))
  with check (public.team_tally_owns_event(
    (select m.event_id from public.team_tally_matchups m where m.id = matchup_id)));

-- Supabase's default privileges hand every new public table to anon. Link
-- holders go through the token functions instead, so take it back.
revoke all on public.team_tally_events, public.team_tally_teams,
  public.team_tally_player_slots, public.team_tally_matchups,
  public.team_tally_games
  from anon;
grant select, insert, update, delete on public.team_tally_events, public.team_tally_teams,
  public.team_tally_player_slots, public.team_tally_matchups,
  public.team_tally_games
  to authenticated;

-- ---------------------------------------------------------------------------
-- team_tally_save_event: build or edit a Team Event in one transaction
-- ---------------------------------------------------------------------------

/**
 * Saves the Organizer's setup form: the night, its Teams with their Player
 * slots, and the opening Matchups. Creates a Team Event when `p_event_id` is
 * null, and edits that one otherwise.
 *
 * SECURITY INVOKER: every write runs under the caller's RLS, so another User's
 * Team Event is simply not found.
 *
 * `p_teams` is an array of `{id?, nickname, homeCourt, captain, slotA, slotB,
 * slotC}` in setup order; `p_matchups` is an array of `{red, blue}`, indexes
 * into `p_teams`, in MATCH order. An edit matches Teams by `id` and keeps
 * their rows, so the Score Links already printed in a Brief keep working, and
 * keeps an opening Matchup whose two Teams are unchanged, with its Games.
 *
 * The form validates first (src/lib/team-tally/setup.ts); the count and
 * one-Matchup-per-Team checks here are the backstop.
 */
create function public.team_tally_save_event(
  p_event_id uuid,
  p_name text,
  p_event_date date,
  p_teams jsonb,
  p_matchups jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_team_count int := jsonb_array_length(coalesce(p_teams, '[]'::jsonb));
  v_matchup_count int := jsonb_array_length(coalesce(p_matchups, '[]'::jsonb));
  v_team jsonb;
  v_team_id uuid;
  v_team_ids uuid[] := '{}';
  v_matchup jsonb;
  v_matchup_id uuid;
  v_kept_matchups uuid[] := '{}';
  v_red uuid;
  v_blue uuid;
  v_red_index int;
  v_blue_index int;
  v_flipped boolean;
begin
  if v_team_count < 4 or v_team_count > 14 or v_team_count % 2 <> 0 then
    raise exception 'a Team Event needs an even number of Teams, 4 to 14'
      using errcode = '22023';
  end if;

  if v_matchup_count <> v_team_count / 2
     or (select count(distinct pair.team_index)
         from jsonb_array_elements(p_matchups) as m (matchup),
              lateral (values (m.matchup ->> 'red'), (m.matchup ->> 'blue')) as pair (team_index))
        <> v_team_count then
    raise exception 'every Team plays in exactly one opening Matchup'
      using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.team_tally_events (name, event_date)
    values (btrim(p_name), p_event_date)
    returning id into v_event_id;
  else
    update public.team_tally_events
    set name = btrim(p_name), event_date = p_event_date, updated_at = now()
    where id = p_event_id
    returning id into v_event_id;

    if v_event_id is null then
      raise exception 'Team Event not found' using errcode = 'P0002';
    end if;
  end if;

  -- Teams, in setup order. A known id keeps its row (and its Score Link).
  for i in 0 .. v_team_count - 1 loop
    v_team := p_teams -> i;
    v_team_id := null;

    if nullif(v_team ->> 'id', '') is not null then
      update public.team_tally_teams
      set position = i,
          nickname = nullif(btrim(coalesce(v_team ->> 'nickname', '')), ''),
          home_court = btrim(v_team ->> 'homeCourt')
      where id = (v_team ->> 'id')::uuid and event_id = v_event_id
      returning id into v_team_id;
    end if;

    if v_team_id is null then
      insert into public.team_tally_teams (event_id, position, nickname, home_court)
      values (
        v_event_id, i,
        nullif(btrim(coalesce(v_team ->> 'nickname', '')), ''),
        btrim(v_team ->> 'homeCourt')
      )
      returning id into v_team_id;
    end if;

    insert into public.team_tally_player_slots (team_id, position, name)
    values
      (v_team_id, 'captain', btrim(v_team ->> 'captain')),
      (v_team_id, 'A', btrim(v_team ->> 'slotA')),
      (v_team_id, 'B', btrim(v_team ->> 'slotB')),
      (v_team_id, 'C', btrim(v_team ->> 'slotC'))
    on conflict (team_id, position) do update set name = excluded.name;

    v_team_ids := v_team_ids || v_team_id;
  end loop;

  -- A Team left out of the form is gone, and its Matchups with it.
  delete from public.team_tally_teams
  where event_id = v_event_id and not (id = any (v_team_ids));

  -- Opening Matchups, in MATCH order. The court pair is the two home courts.
  for i in 0 .. v_matchup_count - 1 loop
    v_matchup := p_matchups -> i;
    v_red_index := (v_matchup ->> 'red')::int;
    v_blue_index := (v_matchup ->> 'blue')::int;

    if v_red_index is null or v_blue_index is null
       or v_red_index not between 0 and v_team_count - 1
       or v_blue_index not between 0 and v_team_count - 1 then
      raise exception 'Matchup % names a Team that is not in this Team Event', i + 1
        using errcode = '22023';
    end if;

    v_red := v_team_ids[v_red_index + 1];
    v_blue := v_team_ids[v_blue_index + 1];

    select id, red_team_id = v_blue
    into v_matchup_id, v_flipped
    from public.team_tally_matchups
    where event_id = v_event_id
      and stage = 'opening'
      and ((red_team_id = v_red and blue_team_id = v_blue)
        or (red_team_id = v_blue and blue_team_id = v_red));

    if v_matchup_id is not null then
      update public.team_tally_matchups
      set number = i + 1,
          red_team_id = v_red,
          blue_team_id = v_blue,
          court_one = (select home_court from public.team_tally_teams where id = v_red),
          court_two = (select home_court from public.team_tally_teams where id = v_blue)
      where id = v_matchup_id;

      -- Same two Teams printed the other way round: their scores swap sides.
      if v_flipped then
        update public.team_tally_games
        set red_score = blue_score, blue_score = red_score
        where matchup_id = v_matchup_id;
      end if;
    else
      insert into public.team_tally_matchups
        (event_id, stage, number, court_one, court_two, red_team_id, blue_team_id)
      values (
        v_event_id, 'opening', i + 1,
        (select home_court from public.team_tally_teams where id = v_red),
        (select home_court from public.team_tally_teams where id = v_blue),
        v_red, v_blue
      )
      returning id into v_matchup_id;

      insert into public.team_tally_games (matchup_id, round, kind)
      select v_matchup_id, round, kind
      from generate_series(1, 3) as round,
           unnest(array['captains', 'teammates']) as kind;
    end if;

    v_kept_matchups := v_kept_matchups || v_matchup_id;
  end loop;

  delete from public.team_tally_matchups
  where event_id = v_event_id
    and stage = 'opening'
    and not (id = any (v_kept_matchups));

  return v_event_id;
end;
$$;

comment on function public.team_tally_save_event(uuid, text, date, jsonb, jsonb) is
  'Creates (p_event_id null) or edits the caller''s Team Event from the setup form: Teams with Player slots, and opening Matchups. Runs under the caller''s RLS (issue #622).';

revoke all on function public.team_tally_save_event(uuid, text, date, jsonb, jsonb) from public;
grant execute on function public.team_tally_save_event(uuid, text, date, jsonb, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- team_tally_public_event: what the Public Link shows
-- ---------------------------------------------------------------------------

/**
 * The Team Event behind a Public Link token, as one JSON document: the night,
 * its Teams with their Player slots, and every Matchup with its Games. Null
 * for any token that isn't a Public Link token, a Score Link token included.
 *
 * SECURITY DEFINER because the caller is `anon`, with no table access. It
 * never returns a Score Link token, the Public Link token itself, or the
 * owner. The answer is worthless without the token already in hand.
 */
create function public.team_tally_public_event(p_token text)
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
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and e.public_token = btrim(p_token);
$$;

comment on function public.team_tally_public_event(text) is
  'The Team Event behind a Public Link token (teams, slots, matchups, games), or null. Callable by anon; never returns a Score Link token (issue #622).';

revoke all on function public.team_tally_public_event(text) from public;
grant execute on function public.team_tally_public_event(text) to anon, authenticated;
