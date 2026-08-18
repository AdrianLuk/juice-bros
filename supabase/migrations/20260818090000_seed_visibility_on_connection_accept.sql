-- A newly accepted Connection starts at the most permissive Visibility
-- ("calendar" — Slots and open time both) instead of the lattice's bottom.
-- Without this, two Users who just became friends see nothing of each other
-- until one of them thinks to open the visibility picker — the opposite of
-- what accepting a friend request should feel like. Recorded as an explicit
-- override on both sides, not a change to `resolveVisibility`'s own fallback:
-- "a friend in no Group and with no override sees nothing" is a deliberate
-- lattice-bottom (ADR 0007, issue #6's 3.6) and stays true for any Connection
-- whose override later gets cleared — this only seeds a starting point, which
-- either side can still dial back per-friend or by leaving it out of a Group.
--
-- A trigger rather than app code in `acceptConnectionRequest`: that action
-- runs as the addressee alone, and RLS on `visibility_overrides` only lets a
-- User write rows where they are `owner_id` — the requester's own override
-- can't be inserted from the addressee's session. Security definer sidesteps
-- that for both sides at once, matching this schema's usual preference for a
-- database invariant over app bookkeeping (see `orgs_default_first_facility`
-- for the same pattern). `on conflict do nothing` is belt-and-suspenders: an
-- override can only exist on an accepted Connection in the first place (see
-- `assert_overridable_connection`), so nothing can be sitting there already
-- the moment this trigger runs.

create function public.seed_visibility_overrides_on_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.visibility_overrides (owner_id, connection_id, level)
    values
      (new.requester_id, new.id, 'calendar'),
      (new.addressee_id, new.id, 'calendar')
    on conflict (owner_id, connection_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger connections_seed_visibility_on_accept
  after update on public.connections
  for each row execute function public.seed_visibility_overrides_on_accept();
