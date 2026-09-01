-- On Deck: the Volunteer Link (issue #248, parent #238).
--
-- A per-Session URL the Organizer shares (in practice via the club's volunteer
-- WhatsApp group) that grants the operational floor surface for that Session
-- only, with no account: open a Game done, view the Queue, pause Players, do a
-- no-show swap. It cannot start or close Sessions, edit Club defaults, or edit a
-- Session's venue / court count. The token is scoped to one Session and stops
-- working when the Session closes (On Deck glossary, "Volunteer Link"; ADR 0005).
--
-- Shape:
--
--   * `on_deck_sessions.volunteer_token` — a random secret minted per Session.
--     Always present, but only *usable* when the Session's Floor Mode admits
--     volunteers (`volunteer-run` / `hybrid`); under `self-serve` the functions
--     below reject it and the Organizer UI never shows it.
--
--   * the token is a bearer credential, so `anon` must not read it off the
--     world-readable open-Session row. The foundation migration's blanket
--     `grant select ... to anon` is narrowed to the non-secret columns; the
--     Organizer (`authenticated`, RLS-scoped to their own Club) keeps full
--     column access and reads the token to show the link.
--
--   * `on_deck_check_volunteer_token(session, token)` — a SECURITY DEFINER
--     boolean the volunteer floor route calls to authenticate a link before it
--     renders. True only for the right token on an *open* Session whose Floor
--     Mode admits volunteers.
--
--   * `on_deck_volunteer_append(session, token, type, payload)` — the single
--     write path for a link-authenticated Volunteer, the same posture as
--     `on_deck_join_session` / `on_deck_queue_player`: the events table carries
--     no `anon` INSERT grant, so this function is the only way a
--     `volunteer`-sourced event lands. It re-checks the token, pins
--     `operator_kind` to `volunteer`, and whitelists the operational turnover
--     events a Volunteer may fire — never SESSION_*, FLOOR_MODE_CHANGED,
--     GROUP_CAP_CHANGED, or the Group / Last Call vocabulary.
--
-- Undo (dropping the last event) is its own ticket, #247 — deliberately not
-- built here.

-- ---------------------------------------------------------------------------
-- volunteer_token on the Session
-- ---------------------------------------------------------------------------

-- 32 hex chars (a UUID with the dashes stripped) — ~122 bits, ample for a
-- bearer link that only lives for one Session's few hours. Adding the column
-- with a volatile default rewrites the table, so every existing open Session
-- picks up its own distinct token.
alter table public.on_deck_sessions
  add column volunteer_token text not null
    default replace(gen_random_uuid()::text, '-', '');

alter table public.on_deck_sessions
  add constraint on_deck_session_volunteer_token_length
    check (char_length(volunteer_token) between 24 and 128);

comment on column public.on_deck_sessions.volunteer_token is
  'Bearer secret behind this Session''s Volunteer Link (issue #248). Never exposed to anon — the column grant below withholds it. Usable only while the Session is open and its Floor Mode admits volunteers.';

-- ---------------------------------------------------------------------------
-- Keep the volunteer token out of anon's reach
-- ---------------------------------------------------------------------------

-- The foundation migration granted `anon` SELECT on the whole table so a Player
-- with no account can read the open Session (ADR 0006). That now also covers
-- `volunteer_token`, which would hand any Player the volunteer surface. Narrow
-- the grant to the columns a Player actually needs. A future column is
-- anon-invisible until deliberately added here — safe by default.
revoke select on public.on_deck_sessions from anon;
grant select (
  id, club_id, venue_name, court_count, group_cap, floor_mode, status, seed,
  started_at, closed_at, created_at
) on public.on_deck_sessions to anon;

-- ---------------------------------------------------------------------------
-- on_deck_check_volunteer_token — authenticate a link before rendering
-- ---------------------------------------------------------------------------

/**
 * True when `p_token` is the Volunteer Link token for an *open* Session whose
 * Floor Mode admits volunteers. SECURITY DEFINER so it can read
 * `volunteer_token`, which the caller (`anon`, the volunteer's phone) cannot.
 * The answer is worthless without the token already in hand, so it is safe to
 * expose directly.
 */
create function public.on_deck_check_volunteer_token(
  p_session_id uuid,
  p_token text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.on_deck_sessions
    where id = p_session_id
      and status = 'open'
      and floor_mode in ('volunteer-run', 'hybrid')
      and char_length(btrim(coalesce(p_token, ''))) >= 24
      and volunteer_token = btrim(coalesce(p_token, ''))
  );
$$;

comment on function public.on_deck_check_volunteer_token(uuid, text) is
  'True when the token is the Volunteer Link for an open Session that admits volunteers. Callable by anon — the volunteer floor route calls it to authenticate a link.';

revoke all on function public.on_deck_check_volunteer_token(uuid, text) from public;
grant execute on function public.on_deck_check_volunteer_token(uuid, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_volunteer_append — the Volunteer's one write path
-- ---------------------------------------------------------------------------

/**
 * Appends one operational event as `operator_kind = 'volunteer'`. The only way
 * a volunteer-sourced event reaches the log — the events table has no `anon`
 * INSERT grant.
 *
 * Enforces the volunteer *scope*, not just the UI's hiding of controls:
 *   * the token must match an open Session that admits volunteers (so a closed
 *     Session, or one flipped to `self-serve`, silently stops granting access);
 *   * only the turnover events a Volunteer may fire are accepted — a Volunteer
 *     cannot SESSION_STARTED / SESSION_CLOSED (start & close are the
 *     Organizer's), FLOOR_MODE_CHANGED / GROUP_CAP_CHANGED (Club/Session
 *     settings), or reach the Player-sourced doors;
 *   * the pause it opens is always a "set aside" — "no-show" rides
 *     FOURSOME_MEMBER_SWAPPED and "left" is the Player's own.
 *
 * Payload shape (Court in range, names resolvable, stale board) is validated in
 * the Server Action before this is called, the same division of labour
 * `on_deck_queue_player` takes; `reduceSession` also skips a malformed row.
 */
create function public.on_deck_volunteer_append(
  p_session_id uuid,
  p_token text,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
begin
  if not exists (
    select 1
    from public.on_deck_sessions
    where id = p_session_id
      and status = 'open'
      and floor_mode in ('volunteer-run', 'hybrid')
      and char_length(v_token) >= 24
      and volunteer_token = v_token
  ) then
    raise exception 'this volunteer link is not valid for an open session'
      using errcode = '42501';
  end if;

  if p_type not in (
    'COURT_FINISHED',
    'PLAYER_PAUSED',
    'PLAYER_REQUEUED',
    'FOURSOME_MEMBER_SWAPPED'
  ) then
    raise exception 'a volunteer cannot fire a % event', p_type
      using errcode = '42501';
  end if;

  if p_type = 'PLAYER_PAUSED'
     and coalesce(p_payload ->> 'reason', '') <> 'set-aside' then
    raise exception 'a volunteer pause is always a set-aside'
      using errcode = '22023';
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, p_type, 'volunteer', null, coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

comment on function public.on_deck_volunteer_append(uuid, text, text, jsonb) is
  'Appends one operational turnover event as operator_kind volunteer, for a link-authenticated Volunteer (issue #248). No account: callable by anon. Rejects a stale/closed/self-serve link and any non-turnover event type.';

revoke all on function public.on_deck_volunteer_append(uuid, text, text, jsonb) from public;
grant execute on function public.on_deck_volunteer_append(uuid, text, text, jsonb)
  to anon, authenticated;
