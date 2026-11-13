-- Match Mixer: Finish, the 12-hour auto-finish and a superadmin (#690).
--
--   match_mixer_superadmins   accounts that run every Live Mixer, finished or
--                             not, to fix a night for another organizer. Meant
--                             for the site's owner alone, so no role can write
--                             it through the API; the one row is added by
--                             hand in the SQL editor (the repo is public, so
--                             the email stays out of it), as Team Tally's is:
--                               insert into public.match_mixer_superadmins (user_id)
--                               select id from auth.users where email = '...';
--
-- A Live Mixer is finished when the organizer taps Finish Mixer (a finished
-- event, which also sets finished_at) or 12 hours after it went live. The
-- 12 hours are checked on every read and write, so nothing has to run on a
-- clock. A finished Live Mixer refuses every write, except a superadmin's.
--
-- A superadmin signed in on either link runs the night as the Organizer Link
-- does. The read still says which link the token is, and never hands the
-- Player Link holder the Organizer Link's token, superadmin or not.

-- ---------------------------------------------------------------------------
-- Superadmins
-- ---------------------------------------------------------------------------

create table public.match_mixer_superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

comment on table public.match_mixer_superadmins is
  'Accounts that run every Live Mixer, finished or not. No policies: only the SQL editor writes it, only match_mixer_is_superadmin reads it.';

alter table public.match_mixer_superadmins enable row level security;
revoke all on public.match_mixer_superadmins from anon, authenticated, service_role;

/** True when the caller is a Match Mixer superadmin. */
create function public.match_mixer_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_mixer_superadmins
    where user_id = (select auth.uid())
  );
$$;

-- Only the functions below ask it, and they run as its owner.
revoke all on function public.match_mixer_is_superadmin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Finished
-- ---------------------------------------------------------------------------

/**
 * When a Live Mixer finished: when the organizer tapped Finish Mixer, else 12
 * hours after it went live once those have passed, else null.
 */
create function public.match_mixer_finished_at(p_went_live_at timestamptz, p_finished_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(
    p_finished_at,
    case when now() >= p_went_live_at + interval '12 hours' then p_went_live_at + interval '12 hours' end
  );
$$;

revoke all on function public.match_mixer_finished_at(timestamptz, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reading a Live Mixer
-- ---------------------------------------------------------------------------

/**
 * #688's read, with `finishedAt` counting the 12 hours, and `superadmin`:
 * true when the signed-in caller runs every Live Mixer, so either link opens
 * with the Organizer Link's controls.
 */
create or replace function public.match_mixer_live_mixer(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'role', case when m.organizer_token = btrim(p_token) then 'organizer' else 'player' end,
    'config', m.config,
    'playerToken', case when m.organizer_token = btrim(p_token) then m.player_token end,
    'wentLiveAt', m.went_live_at,
    'finishedAt', public.match_mixer_finished_at(m.went_live_at, m.finished_at),
    'superadmin', public.match_mixer_is_superadmin(),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'payload', e.payload) order by e.id)
      from public.match_mixer_events e
      where e.live_mixer_id = m.id
    ), '[]'::jsonb)
  )
  from public.match_mixer_live_mixers m
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and (m.organizer_token = btrim(p_token) or m.player_token = btrim(p_token));
$$;

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------

/**
 * Appends one event to the Live Mixer behind a link's token. The Organizer
 * Link, or a superadmin on either link, writes any kind below; the Player
 * Link writes scores only, up to the Current Round. `finished` also sets
 * finished_at. Refuses a token that isn't one, or a kind its link can't write
 * (42501), a Player Link score past the Current Round (MMR01), a finished
 * Live Mixer unless the caller is a superadmin (55000), a payload of the wrong
 * shape (22023) and a log past 5,000 events (54000). Stores the payload
 * rebuilt from the fields it checked, never as sent.
 */
create or replace function public.match_mixer_append(p_token text, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_mixer public.match_mixer_live_mixers;
  v_superadmin boolean := public.match_mixer_is_superadmin();
  v_runs boolean;
  v_payload jsonb;
  v_current integer;
begin
  select * into v_mixer
  from public.match_mixer_live_mixers
  where char_length(v_token) >= 24
    and (organizer_token = v_token or player_token = v_token)
  for update;

  v_runs := v_mixer.organizer_token = v_token or v_superadmin;

  if v_mixer.id is null or (not v_runs and p_kind not in ('score_entered', 'score_cleared')) then
    raise exception 'Only the Organizer Link can do that.' using errcode = '42501';
  end if;

  if public.match_mixer_finished_at(v_mixer.went_live_at, v_mixer.finished_at) is not null
    and not v_superadmin
  then
    raise exception 'This Live Mixer has finished.' using errcode = '55000';
  end if;

  if p_kind in ('score_entered', 'score_cleared')
    and public.match_mixer_whole(p_payload -> 'round', 999)
    and public.match_mixer_whole(p_payload -> 'court', 999)
  then
    v_payload := jsonb_build_object('round', p_payload -> 'round', 'court', p_payload -> 'court');
    if p_kind = 'score_entered' then
      if jsonb_typeof(p_payload -> 'score') = 'array'
        and jsonb_array_length(p_payload -> 'score') = 2
        and public.match_mixer_whole(p_payload -> 'score' -> 0, 99)
        and public.match_mixer_whole(p_payload -> 'score' -> 1, 99)
        and p_payload -> 'score' -> 0 <> p_payload -> 'score' -> 1
      then
        v_payload := v_payload || jsonb_build_object(
          'score', jsonb_build_array(p_payload -> 'score' -> 0, p_payload -> 'score' -> 1)
        );
      else
        v_payload := null;
      end if;
    end if;
  elsif p_kind = 'game_rule_changed' then
    v_payload := public.match_mixer_game_rule(p_payload);
  elsif p_kind = 'round_started' and public.match_mixer_whole(p_payload -> 'round', 999) then
    v_payload := jsonb_build_object('round', p_payload -> 'round');
  elsif p_kind = 'finished' then
    v_payload := '{}'::jsonb;
  end if;

  if v_payload is null then
    raise exception 'That isn''t something this link can write.' using errcode = '22023';
  end if;

  -- The Player Link scores up to the Current Round (#689). Same rule as
  -- replay() in lib/live/events.ts; stored payloads were shape-checked on
  -- the way in, so the casts hold.
  if not v_runs then
    select greatest(
      coalesce(max((e.payload ->> 'round')::integer) filter (where e.kind = 'round_started'), 0),
      coalesce(max((e.payload ->> 'round')::integer + 1) filter (where e.kind = 'score_entered'), 0)
    ) into v_current
    from public.match_mixer_events e
    where e.live_mixer_id = v_mixer.id;

    if (v_payload ->> 'round')::integer > v_current then
      raise exception 'Round % hasn''t started yet.', (v_payload ->> 'round')::integer + 1
        using errcode = 'MMR01';
    end if;
  end if;

  if (select count(*) from public.match_mixer_events where live_mixer_id = v_mixer.id) >= 5000 then
    raise exception 'This Live Mixer has taken all the changes it can.' using errcode = '54000';
  end if;

  if p_kind = 'finished' then
    update public.match_mixer_live_mixers
    set finished_at = coalesce(finished_at, now())
    where id = v_mixer.id;
  end if;

  insert into public.match_mixer_events (live_mixer_id, kind, payload)
  values (v_mixer.id, p_kind, v_payload);
end;
$$;

comment on function public.match_mixer_append(text, text, jsonb) is
  'Appends an event to the Live Mixer behind a link token: scores from either link; round_started, game_rule_changed and finished from the Organizer Link or a superadmin. Refuses a finished Live Mixer, except for a superadmin. Callable by anon: the token is the credential.';
