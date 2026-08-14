-- A Connection is a mutual, two-sided friendship between two Users. It is
-- symmetric: A→B and B→A describe the same relationship. The row records who
-- asked, because that decides who may accept, but the relationship itself
-- belongs to both Users equally.

create type public.connection_status as enum ('pending', 'accepted');

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,

  constraint no_self_connection check (requester_id <> addressee_id)
);

comment on table public.connections is
  'Mutual friendship between two Users. Symmetric: one row covers the pair in both directions.';

-- One row per *pair*, whichever way round it was asked. Ordering the two ids
-- before indexing them is what makes A→B and B→A collide, so a second,
-- contradictory row for the same pair is impossible rather than merely
-- discouraged. A plain unique (requester_id, addressee_id) would let both
-- directions exist at once.
create unique index connections_unique_pair
  on public.connections (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index connections_addressee_pending
  on public.connections (addressee_id)
  where status = 'pending';

alter table public.connections enable row level security;

/**
 * True when the acting User is party to this Connection.
 *
 * A function rather than repeating the expression: every policy below needs
 * the same notion of "belongs to me", and RLS bugs hide in near-duplicates.
 */
create function public.is_connection_party(requester uuid, addressee uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) in (requester, addressee);
$$;

create policy "connections are visible to both parties"
  on public.connections for select
  to authenticated
  using (public.is_connection_party(requester_id, addressee_id));

-- You may only send requests as yourself.
create policy "a User sends their own requests"
  on public.connections for insert
  to authenticated
  with check ((select auth.uid()) = requester_id and status = 'pending');

-- Only the addressee answers. If the requester could accept, "mutual accept"
-- would mean nothing — see ADR 0003 for why the nuanced rules live in
-- application code and only the coarse boundary is enforced here.
create policy "only the addressee answers a request"
  on public.connections for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id);

-- Either party can walk away: declining and unfriending are the same act.
create policy "either party can remove the connection"
  on public.connections for delete
  to authenticated
  using (public.is_connection_party(requester_id, addressee_id));

-- Automatic table exposure is off on this project, so grants are explicit.
grant select, insert, update, delete on public.connections to authenticated;

/**
 * Profiles of Users you have an accepted Connection with become readable —
 * that is the point of connecting. Pending requests do not qualify: seeing
 * someone's details should require their agreement.
 */
create function public.is_connected_to(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and (
        (c.requester_id = (select auth.uid()) and c.addressee_id = other_user)
        or
        (c.addressee_id = (select auth.uid()) and c.requester_id = other_user)
      )
  );
$$;

create policy "profiles are readable by accepted connections"
  on public.profiles for select
  to authenticated
  using (public.is_connected_to(id));
