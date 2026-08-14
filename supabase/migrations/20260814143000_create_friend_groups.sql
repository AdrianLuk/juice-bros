-- A Friend Group is a named, user-owned collection of that User's own
-- Connections, carrying a default Visibility level. Groups are private to
-- their owner: how Amy groups Ben has no effect on how Ben groups Amy, and Ben
-- is never shown which of Amy's groups he is in.
--
-- Per ADR 0003, the precedence chain (override beats most-permissive group
-- default) lives in application code. What is enforced here is only the coarse
-- boundary — these rows belong to their owner and nobody else — plus the
-- integrity rules the app must not be trusted to re-check.

create type public.visibility_level as enum ('none', 'slots', 'calendar');

comment on type public.visibility_level is
  'How much of a User''s calendar/Slot data a Connection can see. Ordered least to most permissive; the app resolves "most permissive wins" off this order.';

create table public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  default_visibility public.visibility_level not null default 'slots',
  created_at timestamptz not null default now(),

  constraint friend_group_name_not_blank check (btrim(name) <> ''),
  constraint friend_group_name_length check (char_length(name) <= 60)
);

comment on table public.friend_groups is
  'A User''s own named grouping of their Connections, with a default Visibility level. Private to the owner.';

-- Two groups called "Tuesday crew" would be indistinguishable in the picker,
-- so the same owner cannot have both. Case-insensitive, because "tuesday crew"
-- is not a second group either.
create unique index friend_groups_unique_name_per_owner
  on public.friend_groups (owner_id, lower(btrim(name)));

create table public.friend_group_members (
  group_id uuid not null references public.friend_groups (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (group_id, connection_id)
);

comment on table public.friend_group_members is
  'Which of the owner''s Connections are in which of their Friend Groups. Keyed by Connection, not User, so removing a friend removes them from every group.';

-- Keyed by Connection rather than by the friend's user id, so unfriending
-- cascades the membership away with it — a stale grouping of someone you are
-- no longer connected to has no meaning.

create table public.visibility_overrides (
  owner_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  level public.visibility_level not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (owner_id, connection_id)
);

comment on table public.visibility_overrides is
  'A per-friend Visibility level that wins over every group default, in both directions.';

/**
 * True when the acting User is party to this Connection and it is accepted.
 *
 * Security definer so it can see the Connection row while checking — the
 * caller's own select policy already permits that, but the check must not
 * depend on policy evaluation order to be correct.
 */
create function public.owns_accepted_connection(connection uuid, owner_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connections c
    where c.id = connection
      and c.status = 'accepted'
      and owner_user in (c.requester_id, c.addressee_id)
  );
$$;

/**
 * Only accepted Connections are groupable, and only into the grouper's own
 * groups.
 *
 * A trigger rather than a check constraint: both parts need a subquery. It
 * fires on update too, so a row cannot be edited into a state the insert would
 * have refused.
 */
create function public.assert_groupable_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_owner uuid;
begin
  select owner_id into group_owner
  from public.friend_groups
  where id = new.group_id;

  if group_owner is null then
    raise exception 'friend group % does not exist', new.group_id;
  end if;

  if not public.owns_accepted_connection(new.connection_id, group_owner) then
    raise exception 'only your own accepted connections can be grouped'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger friend_group_members_groupable
  before insert or update on public.friend_group_members
  for each row execute function public.assert_groupable_connection();

/** The same rule for overrides: you can only override a friend of yours. */
create function public.assert_overridable_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_accepted_connection(new.connection_id, new.owner_id) then
    raise exception 'only your own accepted connections can have an override'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger visibility_overrides_overridable
  before insert or update on public.visibility_overrides
  for each row execute function public.assert_overridable_connection();

-- Row Level Security: the coarse net. Everything below is "this is mine".

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.visibility_overrides enable row level security;

create policy "a User sees only their own friend groups"
  on public.friend_groups for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

/**
 * True when the acting User owns this Friend Group.
 *
 * Security definer because the membership policies below have to look at
 * `friend_groups` from a context where the caller may not have selected it.
 */
create function public.owns_friend_group(group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friend_groups g
    where g.id = group_id
      and g.owner_id = (select auth.uid())
  );
$$;

create policy "a User sees only memberships of their own groups"
  on public.friend_group_members for all
  to authenticated
  using (public.owns_friend_group(group_id))
  with check (public.owns_friend_group(group_id));

create policy "a User sees only their own visibility overrides"
  on public.visibility_overrides for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Automatic table exposure is off on this project, so grants are explicit.
grant select, insert, update, delete on public.friend_groups to authenticated;
grant select, insert, update, delete on public.friend_group_members to authenticated;
grant select, insert, update, delete on public.visibility_overrides to authenticated;
