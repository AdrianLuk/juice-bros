-- Mic Drop: a Guest can take their Vote back (issue #671, Adrian 2026-11-11).
-- Tapping your own pick again withdraws it, leaving that phone with no Vote.

/**
 * Withdraws a phone's Vote on the Poll behind a Guest Link token. A phone with
 * no Vote is left as it was. Refused, with a reason a Guest can read, when the
 * Poll is closed or the Guest id isn't one. Broadcasts itself: the Votes
 * trigger skips deletes, so a Contestant's removal sends one message rather
 * than one per Vote it takes with it.
 */
create function public.mic_drop_withdraw_vote(p_token text, p_guest_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.mic_drop_polls;
  v_guest_id uuid := public.mic_drop_guest_uuid(p_guest_id);
begin
  if v_guest_id is null then
    raise exception 'This phone''s Guest id isn''t valid. Reload the page and try again.' using errcode = '22023';
  end if;

  -- The same share lock as casting a Vote: a close waits for this, and this for a close.
  select * into v_poll
  from public.mic_drop_polls
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and guest_token = btrim(p_token)
  for share;

  if not found then
    raise exception 'There''s no such Poll.' using errcode = 'P0002';
  end if;

  if v_poll.closed_at is not null then
    raise exception 'Voting is closed.' using errcode = '22023';
  end if;

  delete from public.mic_drop_votes where poll_id = v_poll.id and guest_id = v_guest_id;
  if found then
    perform realtime.send('{}'::jsonb, 'changed', 'mic-drop:' || v_poll.id, false);
  end if;
end;
$$;

comment on function public.mic_drop_withdraw_vote(text, text) is
  'Withdraws one phone''s Vote on the Poll behind a Guest Link token. Callable by anon. Refuses a closed Poll and a malformed Guest id.';

revoke all on function public.mic_drop_withdraw_vote(text, text) from public;
grant execute on function public.mic_drop_withdraw_vote(text, text) to anon, authenticated;
