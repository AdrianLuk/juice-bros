-- Skipping a Standing Game's week (spec #576, issue #578; ADR 0023).
--
-- A skipped week is a `standing_game_weeks` row like a posted one, so
-- `post_standing_game_week`'s unique key already stops it ever being posted,
-- by the cron or anything else. This adds the mark that tells the two apart,
-- and the three ways an organizer changes it:
--
--   * `skip_standing_game_date` records a week that hasn't been posted yet as
--     skipped, so it never posts and nobody is ever invited to it;
--   * `unskip_standing_game_date` takes that back while the date is still to
--     come (the next posting run, or the caller, then posts it as usual);
--   * `skip_posted_standing_game_week` marks a posted week skipped and
--     deletes its Slot in one transaction. The delete is the same hard delete
--     `deleteSlot` does: Responses, Slot Link and reminder markers cascade,
--     Bookings are untouched. Telling the yes and maybe answerers is the
--     app's job (it reads them first).
--
-- All three are security definer because `standing_game_weeks` has no write
-- grants for `authenticated`; each checks the caller owns the Standing Game.
--
-- Re-runnable: `if not exists` and `or replace` throughout.

alter table public.standing_game_weeks
  add column if not exists skipped_at timestamptz;

comment on column public.standing_game_weeks.skipped_at is
  'Set when the organizer skipped this week, before or after it was posted. A skipped week has no Slot and is never posted (#578).';

/**
 * Skip a week before it is posted. Returns 'skipped' (also when it already
 * was) or 'posted' when that week already has a Slot, which is skipped from
 * the Slot's own page instead. Refuses a date off the Standing Game's day, one
 * already gone on its own wall clock, and an ended Standing Game.
 */
create or replace function public.skip_standing_game_date(
  target_standing_game uuid,
  target_game_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  sg public.standing_games%rowtype;
  existing public.standing_game_weeks%rowtype;
begin
  select * into sg from public.standing_games where id = target_standing_game;

  if not found or sg.owner_id is distinct from (select auth.uid()) then
    raise exception 'not your standing game' using errcode = 'insufficient_privilege';
  end if;

  if sg.ended_at is not null then
    raise exception 'this standing game has ended' using errcode = 'check_violation';
  end if;

  if extract(dow from target_game_date)::smallint <> sg.weekday then
    raise exception 'that date is not on this standing game''s day' using errcode = 'check_violation';
  end if;

  if target_game_date < (now() at time zone sg.time_zone)::date then
    raise exception 'that date has already gone' using errcode = 'check_violation';
  end if;

  insert into public.standing_game_weeks (standing_game_id, game_date, skipped_at)
  values (sg.id, target_game_date, now())
  on conflict (standing_game_id, game_date) do nothing;

  select * into existing
  from public.standing_game_weeks
  where standing_game_id = sg.id and game_date = target_game_date;

  if existing.slot_id is not null then
    return 'posted';
  end if;

  return 'skipped';
end;
$$;

revoke all on function public.skip_standing_game_date(uuid, date) from public, anon;
grant execute on function public.skip_standing_game_date(uuid, date) to authenticated;

/**
 * Take back a skip while the date is still to come, so the week posts as
 * usual. Returns whether a skipped week was removed. Touches only skipped
 * weeks with no Slot, so it can never un-record a posted week.
 */
create or replace function public.unskip_standing_game_date(
  target_standing_game uuid,
  target_game_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  sg public.standing_games%rowtype;
begin
  select * into sg from public.standing_games where id = target_standing_game;

  if not found or sg.owner_id is distinct from (select auth.uid()) then
    raise exception 'not your standing game' using errcode = 'insufficient_privilege';
  end if;

  if sg.ended_at is not null or target_game_date < (now() at time zone sg.time_zone)::date then
    return false;
  end if;

  delete from public.standing_game_weeks
  where standing_game_id = sg.id
    and game_date = target_game_date
    and skipped_at is not null
    and slot_id is null;

  return found;
end;
$$;

revoke all on function public.unskip_standing_game_date(uuid, date) from public, anon;
grant execute on function public.unskip_standing_game_date(uuid, date) to authenticated;

/**
 * "Skip this week" on a posted Slot: mark its week skipped and delete the
 * Slot, together. Returns the week's game date. Works on an ended Standing
 * Game's Slots too, since they can't be deleted silently either. Refuses a
 * Slot that didn't come from a Standing Game, or isn't the caller's.
 */
create or replace function public.skip_posted_standing_game_week(target_slot uuid)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  posted public.slots%rowtype;
  skipped_date date;
begin
  select * into posted from public.slots where id = target_slot;

  if not found or posted.owner_id is distinct from (select auth.uid()) then
    raise exception 'not your game' using errcode = 'insufficient_privilege';
  end if;

  if posted.standing_game_id is null then
    raise exception 'this game is not a weekly game''s week' using errcode = 'check_violation';
  end if;

  update public.standing_game_weeks
  set skipped_at = now()
  where standing_game_id = posted.standing_game_id and slot_id = posted.id
  returning game_date into skipped_date;

  -- Every posted Slot has its week row; recreate it defensively if not, on
  -- the Slot's own wall clock (the zone it was posted with).
  if skipped_date is null then
    skipped_date := (posted.proposed_start at time zone posted.time_zone)::date;
    insert into public.standing_game_weeks (standing_game_id, game_date, skipped_at)
    values (posted.standing_game_id, skipped_date, now())
    on conflict (standing_game_id, game_date) do update set skipped_at = excluded.skipped_at;
  end if;

  delete from public.slots where id = posted.id;

  return skipped_date;
end;
$$;

revoke all on function public.skip_posted_standing_game_week(uuid) from public, anon;
grant execute on function public.skip_posted_standing_game_week(uuid) to authenticated;
