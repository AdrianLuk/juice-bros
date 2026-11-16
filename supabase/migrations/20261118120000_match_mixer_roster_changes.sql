-- Match Mixer: late arrivals and early departures (#692).
--
-- No new tables. The first writes of the two kinds #687 reserved:
--
--   player_added  { lines: [line] | [line, line], pool }   new Players: one
--                                                          Roster line, or a
--                                                          Pairing's two
--                 { player }                               a Player who left,
--                                                          back on the board
--   player_left   { player }                               off the board
--
-- `player` is a Roster index on the live Roster: the Config's, then everyone
-- who joined, in log order. Neither kind says which Round it starts from: it is
-- the first Round not yet locked when the event lands, read off the log's own
-- order by replay() in lib/live/events.ts. So a change can never move a Round
-- that has started.
--
-- The Schedule is still never stored. The server checks the rest before it
-- calls (the Format's unit, a Marker under mixed doubles, the Pool exists and
-- has room, a Round is left to change); the database checks the token and the
-- shape, as it does for every other kind.

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
  elsif p_kind in ('player_added', 'player_left') and public.match_mixer_whole(p_payload -> 'player', 127) then
    v_payload := jsonb_build_object('player', p_payload -> 'player');
  elsif p_kind = 'player_added'
    and public.match_mixer_whole(p_payload -> 'pool', 63)
    and jsonb_typeof(p_payload -> 'lines') = 'array'
    and jsonb_array_length(p_payload -> 'lines') between 1 and 2
    and not exists (
      select 1 from jsonb_array_elements(p_payload -> 'lines') line
      where jsonb_typeof(line) <> 'string'
        or char_length(line #>> '{}') > 60
        or btrim(line #>> '{}') = ''
    )
  then
    v_payload := jsonb_build_object('lines', p_payload -> 'lines', 'pool', p_payload -> 'pool');
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
  'Appends an event to the Live Mixer behind a link token: scores from either link; round_started, game_rule_changed, player_added, player_left and finished from the Organizer Link or a superadmin. Refuses a finished Live Mixer, except for a superadmin. Callable by anon: the token is the credential.';
