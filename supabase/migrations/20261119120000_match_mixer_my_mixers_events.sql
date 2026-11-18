-- Match Mixer: Run it again carries the night's Roster (#685).
--
--   match_mixer_my_mixers()   as before, plus each Live Mixer's event log, so
--                             Run it again can open the Roster as the night
--                             ended it: the Config's, plus every late arrival.
--                             The board is still never stored (ADR 0001); the
--                             app rebuilds it from the Config and these events.

create or replace function public.match_mixer_my_mixers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to see your Live Mixers.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', mixer.id,
        'config', mixer.config,
        'organizerToken', mixer.organizer_token,
        'wentLiveAt', mixer.went_live_at,
        'finishedAt', public.match_mixer_finished_at(mixer.went_live_at, mixer.finished_at),
        'events', coalesce((
          select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'payload', e.payload) order by e.id)
          from public.match_mixer_events e
          where e.live_mixer_id = mixer.id
        ), '[]'::jsonb)
      )
      order by mixer.went_live_at desc
    )
    from (
      select m.*
      from public.match_mixer_live_mixers m
      where m.owner_id = (select auth.uid()) or public.match_mixer_is_superadmin()
      order by m.went_live_at desc
      limit 100
    ) mixer
  ), '[]'::jsonb);
end;
$$;
