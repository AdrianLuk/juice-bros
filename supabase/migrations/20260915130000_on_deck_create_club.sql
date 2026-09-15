-- On Deck: an Organizer creates their own Club (issue #515, parent #512).
--
-- The foundation migration wrote "seeded by hand (self-serve club creation is
-- out of scope, #238)", and for a year that was true: the only Club that ever
-- existed came from a SQL insert. A signed-in Organizer with no Club was shown
-- a panel saying Clubs are made by hand and to get in touch, which is the wall
-- every interested stranger hits. This is the door.
--
-- Creation goes through an RPC and not a table grant. `on_deck_clubs` gains no
-- INSERT grant for anybody but `service_role`, exactly as before, because the
-- posture that keeps a Player out of the Club table is the same posture that
-- keeps a signed-in stranger from writing an `owner_id` that is not theirs.
-- Every other write onto a Club already works this way
-- (`on_deck_update_club_defaults`, `on_deck_set_club_time_zone`), and this
-- mirrors them: `security definer`, empty search path, revoked from public,
-- execute granted to `authenticated` only.
--
-- The guard is the one `on_deck_join_session` already uses against `anon`: an
-- explicit row-count cap checked in the function, with the unique index behind
-- it as the actual guarantee against a racer. There the cap is 500 Players per
-- Session; here it is one Club per owner, which the
-- `on_deck_clubs_one_per_owner` index has enforced since the foundation. This
-- function only has to say so in a sentence rather than in a 23505.
--
-- Two inputs and no more, because an Organizer creating a Club has not run a
-- night yet and has nothing to base a group cap on. Venue name starts as the
-- Club's own name (a club that plays at one place, which is the common one,
-- is then already correct), and group cap, Floor Mode and the clock take what
-- the schema gives them. All of it is editable afterwards in Settings, which
-- is what makes a two-field form safe: nothing typed here is permanent.
--
-- The clock stays untouched on purpose. It is deliberately null at insert so
-- that `on_deck_adopt_club_time_zone` can read it off the Organizer's own
-- browser on their first visit (issue #469) — asking a stranger for a time
-- zone in a create form would undo that.

-- ---------------------------------------------------------------------------
-- on_deck_create_club
-- ---------------------------------------------------------------------------

create function public.on_deck_create_club(
  p_name text,
  p_court_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_owned integer;
  v_club_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- What this function validates, versus what the table backstops. Both layers
  -- hold; the difference is which error the caller gets. A value checked here
  -- comes back as a 22023 the form can turn into a sentence about the field
  -- somebody just typed. A value that only the table refuses comes back as a
  -- 23514 naming a constraint, which is the right outcome for a caller that
  -- bypassed the form but a poor one to show a person.
  if v_name = '' then
    raise exception 'a club name is required' using errcode = '22023';
  end if;
  if char_length(v_name) > 120 then
    raise exception 'a club name is at most 120 characters' using errcode = '22023';
  end if;
  if p_court_count is null or p_court_count not between 1 and 40 then
    raise exception 'court count must be between 1 and 40' using errcode = '22023';
  end if;

  -- The bounded guard. One Club per owner was always a property of the schema;
  -- until now nothing reached the table to test it. The pre-check is what
  -- makes "you already have one" a sentence rather than a constraint name.
  --
  -- `23505` and not `42501`, though both are refusals: this is a uniqueness
  -- collision and nothing else, and the caller has to tell it apart from the
  -- 42501 above, which means "we do not know who you are". The app already
  -- keys its race handling on 23505 elsewhere (`on_deck_start_session`'s
  -- one-open-Session index), so this reads the same way from TypeScript.
  select count(*) into v_owned
  from public.on_deck_clubs
  where owner_id = v_uid;

  if v_owned >= 1 then
    raise exception 'this account already has a Club' using errcode = '23505';
  end if;

  begin
    insert into public.on_deck_clubs (owner_id, name, venue_name, court_count)
    values (v_uid, v_name, v_name, p_court_count)
    returning id into v_club_id;
  exception when unique_violation then
    -- A second tab won the race. Same answer as the pre-check, and the same
    -- code, so the caller has one thing to handle rather than two.
    raise exception 'this account already has a Club' using errcode = '23505';
  end;

  return v_club_id;
end;
$$;

comment on function public.on_deck_create_club(text, integer) is
  'Creates the calling Organizer''s own Club from a name and a court count, and
   returns its id (issue #515). SECURITY DEFINER because `on_deck_clubs` carries
   no INSERT grant for anyone but service_role, and it stays that way. Venue
   name starts as the Club name; group cap, Floor Mode and the clock take the
   schema''s defaults and are all editable in Settings. One Club per owner is
   checked here and guaranteed by on_deck_clubs_one_per_owner.';

revoke all on function public.on_deck_create_club(text, integer) from public;
grant execute on function public.on_deck_create_club(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_update_club_defaults — now the whole of what a create form guessed
-- ---------------------------------------------------------------------------

/**
 * Updates a Club's saved Session defaults, and the two fields that used to be
 * unreachable: the Club's own name and its Floor Mode.
 *
 * Both were fixed at insert when a Club came from a SQL statement somebody ran
 * on purpose, so "untouchable through this path" was a safe thing to write.
 * Neither is fixed any more. The name is now typed by a stranger into a
 * two-field form and rendered to every Player who opens the Club's link
 * (issue #510), so a typo in it is public and permanent. Floor Mode is now
 * never chosen at all — it arrives as the schema's `hybrid` — and a Club that
 * runs without volunteers has no other way to say so.
 *
 * `owner_id` and `created_at` stay untouchable, which is the part of that
 * posture that was ever about safety.
 *
 * The clock is still not here, for the reason `on_deck_set_club_time_zone`
 * gives: a form opened to change a court count must not commit a time zone
 * nobody chose.
 *
 * Replaces the three-argument version rather than overloading it — two
 * functions of the same name differing only in arity is a way to call the
 * wrong one.
 */
drop function public.on_deck_update_club_defaults(text, integer, integer);

create function public.on_deck_update_club_defaults(
  p_name text,
  p_venue_name text,
  p_court_count integer,
  p_group_cap integer,
  p_floor_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.on_deck_clubs
    set name = btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')),
        venue_name = btrim(p_venue_name),
        court_count = p_court_count,
        group_cap = p_group_cap,
        floor_mode = p_floor_mode
    where owner_id = v_uid;

  if not found then
    raise exception 'no Club to update for this account' using errcode = '42501';
  end if;
end;
$$;

comment on function public.on_deck_update_club_defaults(text, text, integer, integer, text) is
  'Updates the caller''s own Club: name, venue, court count, group cap, Floor
   Mode (issues #254, #515). SECURITY DEFINER because `on_deck_clubs` carries no
   UPDATE grant outside service_role. `owner_id` and `created_at` are
   untouchable through this path, and the clock has its own. The table''s CHECK
   constraints backstop every value.';

revoke all on function public.on_deck_update_club_defaults(text, text, integer, integer, text) from public;
grant execute on function public.on_deck_update_club_defaults(text, text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The table's own description, which has said "seeded by hand" since #241
-- ---------------------------------------------------------------------------

comment on table public.on_deck_clubs is
  'On Deck tenant: an owner plus saved Session defaults (venue, court count, group cap, Floor Mode). One per real-world club, and one per owner. Created by the Organizer themselves through on_deck_create_club (issue #515); the table itself still carries no INSERT grant outside service_role. See on-deck/CONTEXT.md.';
