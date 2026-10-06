-- Answering from the Weekly Invite with no sign-in (spec #576, issue #580,
-- ADR 0022). The invite's Yes / No / Maybe links carry a token that can set
-- one Regular's Response to one Slot, and nothing else.
--
-- Same posture as `connection_request_links` (ADR 0017) and `slot_links`:
--   * `weekly_invite_links` is service_role-only. No session reads a token,
--     least of all the organizer's.
--   * the answer page renders on GET through `read_weekly_invite`, which only
--     reads; the write is `answer_weekly_invite`, called from a POST (a
--     Server Action) through the service role.
--   * both functions apply one rule set, so the page and the write can never
--     disagree about whether a token still works.
--
-- Unlike 0017's link the token is reusable, so an answer can be changed. It
-- dies when the Slot starts, when the Slot is deleted (a skipped week, by
-- cascade), and when the Regular stops being the organizer's Connection.
--
-- Re-runnable: every statement is `if not exists` / `or replace` or guarded.

create table if not exists public.weekly_invite_links (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 122 random bits from Postgres's CSPRNG, the same call every other token
  -- in this schema leans on. The token is the only protection on the link.
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),

  constraint weekly_invite_links_token_unique unique (token),
  constraint weekly_invite_links_one_per_regular unique (slot_id, user_id)
);

comment on table public.weekly_invite_links is
  'Session-less answer token behind a Weekly Invite''s Yes / No / Maybe links (issue #580, ADR 0022). One per (Slot, Regular), minted by the invite sender. Reusable until the Slot starts. service_role-only.';

alter table public.weekly_invite_links enable row level security;

-- No policies for `authenticated`/`anon`: default-deny, like
-- `connection_request_links`. The sender mints and the answer page reads
-- through the service role only.
grant select, insert on public.weekly_invite_links to service_role;

/**
 * A link is only ever minted for one of the Slot's Standing Game's Regulars.
 * A trigger, so it binds the service role that does the minting.
 */
create or replace function public.assert_weekly_invite_link_is_for_a_regular()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.slots s
    join public.standing_game_regulars r on r.standing_game_id = s.standing_game_id
    where s.id = new.slot_id
      and r.user_id = new.user_id
  ) then
    raise exception 'a weekly invite link is only for one of the game''s regulars'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists weekly_invite_links_are_for_regulars on public.weekly_invite_links;
create trigger weekly_invite_links_are_for_regulars
  before insert or update on public.weekly_invite_links
  for each row execute function public.assert_weekly_invite_link_is_for_a_regular();

/**
 * What a token opens: its Slot and Regular, and whether the game is still
 * `open` to answer or has `started`. No row at all for a token that doesn't
 * exist, whose Slot is gone, or whose Regular is no longer the organizer's
 * Connection. Read-only (`stable`): the GET of the answer page calls this.
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
  where l.token = invite_token
    and public.are_connected(s.owner_id, l.user_id);
$$;

revoke all on function public.read_weekly_invite(uuid) from public, anon, authenticated;
grant execute on function public.read_weekly_invite(uuid) to service_role;

/**
 * Sets the token's Regular's Response to the token's Slot. The only inputs
 * are the token and the answer, so it cannot answer another Slot or as
 * another User. Returns 'answered', 'started' (the game has begun, nothing
 * changed) or 'invalid' (no such live token, nothing changed).
 *
 * A normal User Response, upserted on the same (slot_id, user_id) index the
 * Slot page's `respondToSlot` uses, so the `responses` triggers (a yes joins
 * the Regulars) fire as for any other answer. Visibility is not consulted:
 * the Regular was given this one game by the organizer (ADR 0022).
 */
create or replace function public.answer_weekly_invite(
  invite_token uuid,
  chosen_answer public.response_answer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_slot uuid;
  target_user uuid;
  link_state text;
begin
  select r.slot_id, r.user_id, r.state
  into target_slot, target_user, link_state
  from public.read_weekly_invite(invite_token) r;

  if target_slot is null then
    return 'invalid';
  end if;
  if link_state <> 'open' then
    return link_state;
  end if;

  insert into public.responses (slot_id, user_id, answer)
  values (target_slot, target_user, chosen_answer)
  on conflict (slot_id, user_id) do update set answer = excluded.answer;

  return 'answered';
end;
$$;

revoke all on function public.answer_weekly_invite(uuid, public.response_answer)
  from public, anon, authenticated;
grant execute on function public.answer_weekly_invite(uuid, public.response_answer)
  to service_role;
