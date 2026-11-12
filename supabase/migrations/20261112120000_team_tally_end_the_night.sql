-- Team Tally: the Organizer ends a night with Flights still open (issue #684).
--
-- A Team Event only ended when its last Flight Matchup was done, and Matchup
-- done needs all six scores. A night that broke up before a Flight was played
-- out never ended: its Public Link stayed on the live standings and its open
-- Flight's Score Links kept taking scores.
--
--   team_tally_organizer_end_event     marks done every open Flight that could
--                                      be marked done, then ends the night.
--                                      Every other open Flight stays open with
--                                      its scores as they were.
--   team_tally_organizer_resume_event  the undo: an ended night with a Flight
--                                      still open goes back to its Flights.
--
-- Both are the Organizer's, and a Superadmin's, through team_tally_owns_event.
-- A Score Link has no way to call either. Mirrored by endNight and resumeNight
-- in src/lib/team-tally/transitions.ts, and checked against it in
-- transitions.db-test.ts.

create function public.team_tally_organizer_end_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.team_tally_owns_event(p_event_id) then
    raise exception 'Team Event not found' using errcode = 'P0002';
  end if;

  -- Queues behind every Matchup done on this night, as team_tally_finish_matchup does.
  v_status := public.team_tally_lock_event(p_event_id);
  if v_status = 'opening' then
    raise exception 'The Flights aren''t placed yet.' using errcode = '22023';
  end if;
  if v_status = 'finished' then
    raise exception 'This Team Event has already finished.' using errcode = '22023';
  end if;

  -- The same rule as Matchup done: all six Games in, and a Dreambreaker winner when tied.
  update public.team_tally_matchups m
  set done_at = now(), done_by_team_id = null
  where m.event_id = p_event_id
    and m.stage = 'flight'
    and m.done_at is null
    and public.team_tally_done_problem(m.id) is null;

  update public.team_tally_events set status = 'finished', updated_at = now() where id = p_event_id;
end;
$$;

revoke all on function public.team_tally_organizer_end_event(uuid) from public;
grant execute on function public.team_tally_organizer_end_event(uuid) to authenticated;

create function public.team_tally_organizer_resume_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.team_tally_owns_event(p_event_id) then
    raise exception 'Team Event not found' using errcode = 'P0002';
  end if;

  v_status := public.team_tally_lock_event(p_event_id);
  if v_status <> 'finished' then
    raise exception 'This Team Event is still running.' using errcode = '22023';
  end if;

  -- A night that finished on its own has every Flight done: reopening one brings it back.
  if not exists (
    select 1 from public.team_tally_matchups m
    where m.event_id = p_event_id and m.stage = 'flight' and m.done_at is null
  ) then
    raise exception 'Every Flight is done. Reopen a Flight to play it again.' using errcode = '22023';
  end if;

  -- Flights that ending the night marked done stay done.
  update public.team_tally_events set status = 'flights', updated_at = now() where id = p_event_id;
end;
$$;

revoke all on function public.team_tally_organizer_resume_event(uuid) from public;
grant execute on function public.team_tally_organizer_resume_event(uuid) to authenticated;
