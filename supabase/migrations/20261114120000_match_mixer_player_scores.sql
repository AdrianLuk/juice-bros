-- Match Mixer: players score their own Games, and the Current Round (#689).
--
-- No new tables. Two changes to match_mixer_append (#688):
--
--   * The Player Link token may now append score_entered and score_cleared.
--     The database can't redraw a board, so the server checks the rest
--     before it calls: that the Selection sent with the score sits in the
--     Game on the board rebuilt from the Config, and that the Game's Round is
--     no later than the Current Round. As with the Organizer Link, a holder
--     of the token who calls this directly skips those checks; the Selection
--     guards against honest mistakes only (#685), and the organizer corrects
--     anything wrong.
--   * The Organizer Link may append round_started { round }, its
--     "Start round N+1". Everything else stays the Organizer Link's alone.
--
-- The Current Round itself is never stored: it is read off the log, the
-- higher of the latest round_started and the latest Round scored plus one.

/**
 * Appends one event to the Live Mixer behind a link's token. The Organizer
 * Link writes any kind below; the Player Link writes scores only. Refuses a
 * token that isn't one, or a kind its link can't write (42501), a finished
 * Live Mixer (55000), a payload of the wrong shape (22023) and a log past
 * 5,000 events (54000). Stores the payload rebuilt from the fields it
 * checked, never as sent.
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
  v_payload jsonb;
begin
  select * into v_mixer
  from public.match_mixer_live_mixers
  where char_length(v_token) >= 24
    and (organizer_token = v_token or player_token = v_token)
  for update;

  if v_mixer.id is null
    or (v_mixer.organizer_token <> v_token and p_kind not in ('score_entered', 'score_cleared'))
  then
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
  elsif p_kind = 'round_started' and public.match_mixer_whole(p_payload -> 'round', 999) then
    v_payload := jsonb_build_object('round', p_payload -> 'round');
  end if;

  if v_payload is null then
    raise exception 'That isn''t something this link can write.' using errcode = '22023';
  end if;

  if (select count(*) from public.match_mixer_events where live_mixer_id = v_mixer.id) >= 5000 then
    raise exception 'This Live Mixer has taken all the changes it can.' using errcode = '54000';
  end if;

  insert into public.match_mixer_events (live_mixer_id, kind, payload)
  values (v_mixer.id, p_kind, v_payload);
end;
$$;

comment on function public.match_mixer_append(text, text, jsonb) is
  'Appends an event to the Live Mixer behind a link token: scores from either link, round_started and game_rule_changed from the Organizer Link only. Callable by anon: the token is the credential.';
