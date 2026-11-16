-- Match Mixer: My Mixers (#691).
--
--   match_mixer_my_mixers()   the Live Mixers the signed-in caller owns,
--                             newest first, each with its Organizer Link's
--                             token so the owner can open it without having
--                             kept the link. A superadmin gets every Live
--                             Mixer.
--
-- Every Live Mixer already has an owner (go live requires an account), so
-- there is nothing to claim and no new write path. Opening a Live Mixer from this
-- list is the ordinary Organizer Link: the token is the credential, and the
-- owner and the superadmin are the two callers this hands it to.
--
-- This is the second place an Organizer Link's token is handed out unasked:
-- match_mixer_go_live's header calls itself the only one, and was true until
-- now. CONTEXT.md's rule is "holds the token, OR is the Owner, OR is a
-- superadmin". It is met here, by giving the Owner the token, not by an Owner
-- branch in match_mixer_append: an Owner on their own Player Link still has
-- player powers, and opens the Organizer Link from this list instead.
--
-- Returns at most 100 Live Mixers. A weekly organizer is two years in before that
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
        'id', mixer.id,
        'config', mixer.config,
        'organizerToken', mixer.organizer_token,
        'wentLiveAt', mixer.went_live_at,
        'finishedAt', public.match_mixer_finished_at(mixer.went_live_at, mixer.finished_at)
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

revoke all on function public.match_mixer_my_mixers() from public, anon;
grant execute on function public.match_mixer_my_mixers() to authenticated;
