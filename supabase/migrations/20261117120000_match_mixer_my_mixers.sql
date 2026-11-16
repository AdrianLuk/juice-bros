-- Match Mixer: My Mixers (#691).
--
--   match_mixer_my_mixers()   the Live Mixers the signed-in caller owns,
--                             newest first, each with its Organizer Link's
--                             token so the owner can open it without having
--                             kept the link. A superadmin gets every Live
--                             Mixer.
--
-- Every Live Mixer already has an owner (go live requires an account), so
-- there is nothing to claim and no new write path. Opening a night from this
-- list is the ordinary Organizer Link: the token is the credential, and the
-- owner and the superadmin are the two callers this hands it to.
--
-- Returns at most 100 nights. A weekly organizer is two years in before that
-- cuts anything off; paging can wait until someone is near it.

create function public.match_mixer_my_mixers()
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
        'id', night.id,
        'config', night.config,
        'organizerToken', night.organizer_token,
        'wentLiveAt', night.went_live_at,
        'finishedAt', public.match_mixer_finished_at(night.went_live_at, night.finished_at)
      )
      order by night.went_live_at desc
    )
    from (
      select m.*
      from public.match_mixer_live_mixers m
      where m.owner_id = (select auth.uid()) or public.match_mixer_is_superadmin()
      order by m.went_live_at desc
      limit 100
    ) night
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.match_mixer_my_mixers() from public, anon;
grant execute on function public.match_mixer_my_mixers() to authenticated;
