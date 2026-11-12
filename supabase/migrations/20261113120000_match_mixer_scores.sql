-- Match Mixer: organizer scores, the Game Rule and live Standings (#688).
--
-- No new tables. The first writes to match_mixer_events (#687):
--
--   score_entered      { round, court, score: [a, b] }   a Game's score, by Side
--   score_cleared      { round, court }
--   game_rule_changed  { to: 11 | 15 | 21 | "timed", winBy: 1 | 2 }
--
-- A Game is its Round and its court across the night (ADR 0004). Its score is
-- its latest event; Standings are computed from them on every read, never
-- stored.
--
-- Access, the posture #687 set:
--
--   * Only the Organizer Link token appends, through match_mixer_append. The
--     database checks the token and each payload's shape. The server checks
--     the rest before it calls: that the Game exists on the board rebuilt from
--     the Config, and that the score meets the Game Rule in force.
--   * Every append broadcasts a data-free "changed" on the public topic
--     `match-mixer:<live mixer id>`, Mic Drop's pattern. Whoever holds a link
--     re-reads through match_mixer_live_mixer, so the broadcast leaks nothing
--     but "something changed".

-- ---------------------------------------------------------------------------
-- Payload readers
-- ---------------------------------------------------------------------------

/** Whether a JSON value is a whole number from 0 to p_max. */
create function public.match_mixer_whole(p_value jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_value) = 'number'
      and (p_value::text)::numeric between 0 and p_max
      and (p_value::text)::numeric % 1 = 0,
    false
  );
$$;

/** A Game Rule, as { to, winBy } and nothing else, or null when it isn't one. */
create function public.match_mixer_game_rule(p_rule jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_rule) = 'object'
      and p_rule -> 'to' in ('11'::jsonb, '15'::jsonb, '21'::jsonb, '"timed"'::jsonb)
      and p_rule -> 'winBy' in ('1'::jsonb, '2'::jsonb)
    then jsonb_build_object('to', p_rule -> 'to', 'winBy', p_rule -> 'winBy')
  end;
$$;

revoke all on function public.match_mixer_whole(jsonb, integer) from public, anon, authenticated;
revoke all on function public.match_mixer_game_rule(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Go Live sets the Game Rule
-- ---------------------------------------------------------------------------

drop function public.match_mixer_go_live(text);

/**
 * #687's Go Live, plus the Game Rule the organizer picked: written as the
 * night's first game_rule_changed. A call without one (a browser still on
 * the last deploy) plays the readers' default, to 11 win by 2.
 */
create function public.match_mixer_go_live(p_config text, p_rule jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mixer public.match_mixer_live_mixers;
  v_rule jsonb := public.match_mixer_game_rule(p_rule);
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to go live.' using errcode = '42501';
  end if;

  -- A real organizer takes a night or two live a day; this stops a script.
  if (
    select count(*) from public.match_mixer_live_mixers
    where owner_id = (select auth.uid()) and went_live_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'That''s 20 boards live in a day, the most one account can take. Try again tomorrow.'
      using errcode = '54000';
  end if;

  if char_length(coalesce(p_config, '')) not between 1 and 8000 then
    raise exception 'That board can''t go live.' using errcode = '22023';
  end if;

  if p_rule is not null and v_rule is null then
    raise exception 'That isn''t a Game Rule.' using errcode = '22023';
  end if;

  insert into public.match_mixer_live_mixers (config, owner_id)
  values (p_config, (select auth.uid()))
  returning * into v_mixer;

  if v_rule is not null then
    insert into public.match_mixer_events (live_mixer_id, kind, payload)
    values (v_mixer.id, 'game_rule_changed', v_rule);
  end if;

  return jsonb_build_object(
    'organizerToken', v_mixer.organizer_token,
    'playerToken', v_mixer.player_token
  );
end;
$$;

revoke all on function public.match_mixer_go_live(text, jsonb) from public, anon;
grant execute on function public.match_mixer_go_live(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The Organizer Link's writes
-- ---------------------------------------------------------------------------

/**
 * Appends one event to the Live Mixer behind an Organizer Link token. Refuses
 * any other token (42501), a finished Live Mixer (55000), a payload of the
 * wrong shape (22023) and a log past 5,000 events (54000). Stores the payload
 * rebuilt from the fields it checked, never as sent.
 */
create function public.match_mixer_append(p_token text, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mixer public.match_mixer_live_mixers;
  v_payload jsonb;
begin
  select * into v_mixer
  from public.match_mixer_live_mixers
  where organizer_token = btrim(coalesce(p_token, ''))
    and char_length(btrim(coalesce(p_token, ''))) >= 24
  for update;

  if v_mixer.id is null then
    raise exception 'Only the Organizer Link can do that.' using errcode = '42501';
  end if;

  if v_mixer.finished_at is not null then
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
  end if;

  if v_payload is null then
    raise exception 'That isn''t something the Organizer Link can write.' using errcode = '22023';
  end if;

  if (select count(*) from public.match_mixer_events where live_mixer_id = v_mixer.id) >= 5000 then
    raise exception 'This Live Mixer has taken all the changes it can.' using errcode = '54000';
  end if;

  insert into public.match_mixer_events (live_mixer_id, kind, payload)
  values (v_mixer.id, p_kind, v_payload);
end;
$$;

comment on function public.match_mixer_append(text, text, jsonb) is
  'Appends a score_entered, score_cleared or game_rule_changed event to the Live Mixer behind an Organizer Link token. Callable by anon: the token is the credential.';

revoke all on function public.match_mixer_append(text, text, jsonb) from public;
grant execute on function public.match_mixer_append(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reading a Live Mixer, now with its events
-- ---------------------------------------------------------------------------

/**
 * #687's read, plus `id` (the Realtime topic's name, no credential) and
 * `events`: the whole log in replay order, as [{ id, kind, payload }].
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
    'finishedAt', m.finished_at,
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
-- Live updates
-- ---------------------------------------------------------------------------

/**
 * Broadcasts "changed", with no data, on the Live Mixer's public topic.
 * SECURITY DEFINER so an anon caller's append can write realtime.messages.
 */
create function public.match_mixer_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'match-mixer:' || new.live_mixer_id, false);
  return null;
end;
$$;

revoke all on function public.match_mixer_broadcast_change() from public, anon, authenticated;

create trigger match_mixer_events_broadcast
  after insert on public.match_mixer_events
  for each row
  execute function public.match_mixer_broadcast_change();
