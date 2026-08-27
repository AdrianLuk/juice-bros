-- Personal invite link (issue #175): every User carries a rotatable
-- `profiles.invite_token`, surfaced as `/booking-buddy/join/<token>`. Opening
-- the link auto-creates a *pending* friend request back to the owner — the
-- schema has to enforce token uniqueness, auto-assignment on signup,
-- rotation, and that the auto-request can't become a second row for a pair
-- that already has one.

begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- Shape.
select has_column('public', 'profiles', 'invite_token', 'profiles.invite_token exists');
select col_not_null('public', 'profiles', 'invite_token', 'invite_token is NOT NULL');
select has_index(
  'public', 'profiles', 'profiles_invite_token_unique',
  'invite_token has a unique index'
);
select hasnt_table('public', 'invite_links', 'no invite_links table — one rotatable column, no history');

-- Two Users, created the way a real signup does (the trigger fills the profile).
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@example.com');

-- Keep the pre-rotation tokens: Amy's to prove the old URL dies, Ben's to
-- prove rotation touches one User only.
create temporary table token_before on commit drop as
  select id, invite_token from public.profiles
  where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select isnt(
  (select invite_token from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  null,
  'signup assigns an invite token automatically'
);

select matches(
  (select invite_token from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '^[A-Za-z0-9_-]{16,64}$',
  'the assigned token is URL-safe and within the format bound'
);

select isnt(
  (select invite_token from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  (select invite_token from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'two Users get different tokens'
);

-- A token collision is refused rather than silently duplicated.
select throws_ok(
  $$update public.profiles
    set invite_token = (select invite_token from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002')
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23505',
  null,
  'a duplicate invite token is refused by the unique index'
);

-- A malformed token is refused by the format check.
select throws_ok(
  $$update public.profiles set invite_token = 'has a space' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'a token that breaks the format check is refused'
);

-- invite_link_owner resolves a valid token, and only a valid one.
select is(
  (select id from public.invite_link_owner(
     (select invite_token from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')
   )),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'invite_link_owner returns the owner for a real token'
);

select is(
  (select count(*)::int from public.invite_link_owner('nope-not-a-real-token-000')),
  0,
  'invite_link_owner returns nothing for an unknown token'
);

select is(
  (select display_name is null and username is not null
   from public.invite_link_owner(
     (select invite_token from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002')
   )),
  true,
  'invite_link_owner exposes name/handle only — no token, no email'
);

-- Rotation, as the User themselves — `rotate_invite_token` runs as the
-- caller and RLS is what scopes the UPDATE to their own row.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.rotate_invite_token()$$,
  'a User can rotate their own invite token'
);

reset role;

select is(
  (select public.profiles.invite_token = token_before.invite_token
   from public.profiles join token_before using (id)
   where public.profiles.id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  false,
  'rotation replaces the caller''s token'
);

select is(
  (select count(*)::int from public.invite_link_owner(
     (select invite_token from token_before where id = 'aaaaaaaa-0000-0000-0000-000000000001')
   )),
  0,
  'the old token stops resolving after rotation'
);

select is(
  (select public.profiles.invite_token = token_before.invite_token
   from public.profiles join token_before using (id)
   where public.profiles.id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  true,
  'rotating one User''s token leaves everyone else''s alone'
);

-- The auto-created request reuses the ordinary connections insert, so the
-- symmetric-pair unique index still applies: a link opened by someone who
-- already has a request with the owner can't mint a second row.
insert into public.connections (requester_id, addressee_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select throws_ok(
  $$insert into public.connections (requester_id, addressee_id)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'the invite auto-request cannot become a second row for an already-linked pair'
);

select is(
  (select count(*)::int from public.connections
   where least(requester_id, addressee_id) = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'still exactly one Connection row for the pair'
);

select * from finish();

rollback;
