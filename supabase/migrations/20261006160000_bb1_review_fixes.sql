-- BB-1 review fixes (spec #576).
--
-- 1. A Weekly Invite's answer token dies when its Regular is taken off the
--    Regulars list. Before this, `read_weekly_invite` only checked the
--    Connection, so an un-ticked Regular's link still opened the game, and a
--    yes through it re-added them by way of `responses_yes_joins_regulars`,
--    undoing the organizer's removal. Spec: "Nobody leaves except by the
--    organizer's hand". `answer_weekly_invite` reads through
--    `read_weekly_invite`, so replacing that one function covers both the
--    answer page and the write.
--
-- 2. "Make this weekly" (#581) skips the original game's date. A Standing
--    Game started from a one-off Slot that hasn't started records that Slot's
--    date as a week with no Slot and no skip mark, so it never posts a second
--    game that day and nobody is invited to one. The original Slot is left
--    exactly as it was: not adopted, no `standing_game_id`.
--
-- Re-runnable: `or replace` throughout.

/**
 * What a token opens: its Slot and Regular, and whether the game is still
 * `open` to answer or has `started`. No row at all for a token that doesn't
 * exist, whose Slot is gone, whose Regular is no longer the organizer's
 * Connection, or who is no longer on the Standing Game's Regulars list.
 * Read-only (`stable`): the GET of the answer page calls this.
 */
create or replace function public.read_weekly_invite(invite_token uuid)
returns table (slot_id uuid, user_id uuid, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.slot_id,
    l.user_id,
    case when s.proposed_start <= now() then 'started' else 'open' end
  from public.weekly_invite_links l
  join public.slots s on s.id = l.slot_id
  join public.standing_game_regulars r
    on r.standing_game_id = s.standing_game_id
   and r.user_id = l.user_id
  where l.token = invite_token
    and public.are_connected(s.owner_id, l.user_id);
$$;

revoke all on function public.read_weekly_invite(uuid) from public, anon, authenticated;
grant execute on function public.read_weekly_invite(uuid) to service_role;

comment on table public.weekly_invite_links is
  'Session-less answer token behind a Weekly Invite''s Yes / No / Maybe links (issue #580, ADR 0022). One per (Slot, Regular), minted by the invite sender. Reusable until the Slot starts; dead once the Regular leaves the Regulars list or stops being a Connection. service_role-only.';

/**
 * "Make this weekly": mark the original one-off Slot's date as covered on the
 * new Standing Game, so the Standing Game starts posting from the week after.
 * The week row has no Slot and no `skipped_at`: it isn't a skip (nobody
 * skipped anything, and it never shows in the skipped-weeks list), it is a
 * date this Standing Game will never post.
 *
 * Returns the covered date, or null when there is nothing to cover: the Slot
 * has started, it falls on another weekday in the Standing Game's own zone
 * (the organizer moved the day on the form), or the date is already recorded.
 * Refuses (42501) a Standing Game or Slot that isn't the caller's, and (23514)
 * a Slot that a Standing Game posted, or an ended Standing Game.
 */
create or replace function public.cover_standing_game_date_with_slot(
  target_standing_game uuid,
  original_slot uuid
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  sg public.standing_games%rowtype;
  original public.slots%rowtype;
  covered date;
  week_id uuid;
begin
  select * into sg from public.standing_games where id = target_standing_game;
  if not found or sg.owner_id is distinct from (select auth.uid()) then
    raise exception 'not your standing game' using errcode = 'insufficient_privilege';
  end if;

  select * into original from public.slots where id = original_slot;
  if not found or original.owner_id is distinct from sg.owner_id then
    raise exception 'not your game' using errcode = 'insufficient_privilege';
  end if;

  if original.standing_game_id is not null then
    raise exception 'that game was posted by a weekly game' using errcode = 'check_violation';
  end if;

  if sg.ended_at is not null then
    raise exception 'this standing game has ended' using errcode = 'check_violation';
  end if;

  if original.proposed_start <= now() then
    return null;
  end if;

  covered := (original.proposed_start at time zone sg.time_zone)::date;
  if extract(dow from covered)::smallint <> sg.weekday then
    return null;
  end if;

  insert into public.standing_game_weeks (standing_game_id, game_date)
  values (sg.id, covered)
  on conflict (standing_game_id, game_date) do nothing
  returning id into week_id;

  if week_id is null then
    return null;
  end if;
  return covered;
end;
$$;

revoke all on function public.cover_standing_game_date_with_slot(uuid, uuid) from public, anon;
grant execute on function public.cover_standing_game_date_with_slot(uuid, uuid) to authenticated;
