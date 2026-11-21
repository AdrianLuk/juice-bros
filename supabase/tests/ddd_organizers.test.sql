-- Dink Dine & Drink: Organizers, invites and DDDs (issue #711). What this
-- pins down:
--
--   * a signed-in account off the Organizer list can't see, create or edit a
--     DDD, a Venue or an invite;
--   * an Organizer creates a DDD with its two venues and courts, and every
--     other Organizer sees and edits it;
--   * an invite link puts the account that opens it on the list, once, and
--     not after it expires;
--   * the Superadmin, off the list, does everything an Organizer does;
--   * `anon` reaches a DDD only through its Score Link or Public Link token,
--     and never sees a token.

begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71171171-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-organizer-a@example.com'),
  ('71171171-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-organizer-b@example.com'),
  ('71171171-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-outsider@example.com'),
  ('71171171-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-super@example.com'),
  ('71171171-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-late@example.com');

-- The first Organizer is added by hand, as on prod.
insert into public.ddd_organizers (user_id) values ('71171171-0000-0000-0000-00000000000a');

-- ---- an outsider: signed in, not on the list ---------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "71171171-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(public.ddd_is_organizer(), false, 'an outsider is not an Organizer');
select throws_ok(
  $$select public.ddd_save_event(null, 'Sneaky DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar', array['1', '2'])$$,
  '42501',
  null,
  'an outsider can''t create a DDD'
);
select throws_ok(
  $$select public.ddd_create_invite()$$,
  '42501',
  null,
  'nor copy an invite link'
);
select throws_ok(
  $$insert into public.ddd_venues (name, grid) values ('Hall', '{"courts": [{"row": 0, "col": 0, "number": 1}]}')$$,
  '42501',
  null,
  'nor save a Venue'
);

-- ---- Organizer A -------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71171171-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(public.ddd_is_organizer(), true, 'an account on the list is an Organizer');
select lives_ok(
  $$select public.ddd_save_event(null, 'DDD November', '2026-11-28', 'Rec Hall', 'Noodle Bar', array['16', '17', '18', '19'])$$,
  'an Organizer creates a DDD with both venues and its courts'
);
select results_eq(
  $$select c.name from public.ddd_courts c join public.ddd_events e on e.id = c.event_id order by c.position$$,
  $$values ('16'), ('17'), ('18'), ('19')$$,
  'its courts keep their order'
);
select throws_ok(
  $$select public.ddd_save_event(null, 'Twin courts', '2026-11-28', 'Rec Hall', 'Noodle Bar', array['16', '16'])$$,
  '22023',
  null,
  'two courts with one name are refused'
);
select throws_ok(
  $$select public.ddd_save_event(null, 'No courts', '2026-11-28', 'Rec Hall', 'Noodle Bar', array[]::text[])$$,
  '22023',
  null,
  'a DDD with no courts is refused'
);
select throws_ok(
  $$select public.ddd_save_event(null, 'No dinner', '2026-11-28', 'Rec Hall', '  ', array['1'])$$,
  '23514',
  null,
  'a DDD with no dine & drink venue is refused'
);
select lives_ok(
  $$insert into public.ddd_venues (name, grid) values ('Rec Hall', '{"courts": [{"row": 0, "col": 0, "number": 16}]}')$$,
  'an Organizer saves a Venue'
);

create temporary table ddd_invite (token text) on commit drop;
grant all on ddd_invite to authenticated;
insert into ddd_invite select public.ddd_create_invite();
select ok((select char_length(token) >= 24 from ddd_invite), 'an Organizer copies an invite link');

-- ---- the outsider opens the invite -------------------------------------------
set local request.jwt.claims = '{"sub": "71171171-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is((select count(*)::int from public.ddd_events), 0, 'an outsider sees no DDD');
select is((select count(*)::int from public.ddd_venues), 0, 'nor any Venue');
select is(public.ddd_join((select token from ddd_invite)), true, 'opening the invite after signing in joins the list');
select is(public.ddd_is_organizer(), true, 'and they are an Organizer');
select is((select count(*)::int from public.ddd_events), 1, 'who sees the DDD another Organizer made');
select is((select count(*)::int from public.ddd_venues), 1, 'and the shared Venues');
select lives_ok(
  $$select public.ddd_save_event(
      (select id from public.ddd_events), 'DDD November', '2026-11-28', 'Rec Hall', 'Dumpling House', array['16', '17', '18', '19'])$$,
  'and edits it'
);
select is((select dine_venue from public.ddd_events), 'Dumpling House', 'the edit stuck');

-- An edit updates courts in place (later tickets hang Games on them), so a
-- swap passes through two courts briefly sharing a name.
select lives_ok(
  $$select public.ddd_save_event(
      (select id from public.ddd_events), 'DDD November', '2026-11-28', 'Rec Hall', 'Dumpling House', array['17', '16', '18'])$$,
  'an edit can swap two courts and drop one'
);
select results_eq(
  $$select name from public.ddd_courts order by position$$,
  $$values ('17'), ('16'), ('18')$$,
  'the courts take the new order'
);

-- ---- a second account tries the same, used invite ----------------------------
set local request.jwt.claims = '{"sub": "71171171-0000-0000-0000-00000000000e", "role": "authenticated"}';

select is(public.ddd_join((select token from ddd_invite)), false, 'an invite works once');
select is(public.ddd_join('not-a-real-token-at-all-000000'), false, 'a made-up token does nothing');
select is(public.ddd_is_organizer(), false, 'so they are still not an Organizer');

reset role;
update public.ddd_organizer_invites set used_by = null, used_at = null, expires_at = now() - interval '1 minute';
set local role authenticated;
select is(public.ddd_join((select token from ddd_invite)), false, 'an expired invite does nothing');

-- ---- the Superadmin, off the list --------------------------------------------
reset role;
insert into public.ddd_superadmins (user_id) values ('71171171-0000-0000-0000-00000000000d');
set local role authenticated;
set local request.jwt.claims = '{"sub": "71171171-0000-0000-0000-00000000000d", "role": "authenticated"}';

select is(public.ddd_is_organizer(), true, 'the Superadmin passes the one check');
select is((select count(*)::int from public.ddd_events), 1, 'sees every DDD');
select lives_ok(
  $$select public.ddd_create_invite()$$,
  'and copies an invite link'
);

-- ---- anon, holding a link ----------------------------------------------------
reset role;
create temporary table ddd_tokens on commit drop as
  select score_token, public_token from public.ddd_events;
grant all on ddd_tokens to anon;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select count(*) from public.ddd_events$$,
  '42501',
  null,
  'anon can''t read DDDs'
);
select is(
  public.ddd_link_event((select public_token from ddd_tokens)) ->> 'link',
  'public',
  'the Public Link token opens the DDD as the Public Link'
);
select is(
  public.ddd_link_event((select score_token from ddd_tokens)) - 'link',
  public.ddd_link_event((select public_token from ddd_tokens)) - 'link',
  'the Score Link token opens the same DDD'
);
select is(
  public.ddd_link_event((select score_token from ddd_tokens)) ->> 'link',
  'score',
  'as the Score Link'
);
select ok(
  public.ddd_link_event((select public_token from ddd_tokens))::text
    not like '%' || (select score_token from ddd_tokens) || '%',
  'and the Public Link never shows the Score Link token'
);

select * from finish();
rollback;
