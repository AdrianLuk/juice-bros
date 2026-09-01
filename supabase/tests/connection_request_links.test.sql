-- Connection Request Email (issue #228). Two things to prove at this layer:
--
--   * the `connections` insert trigger mints exactly one
--     `connection_request_links` row per new pending request, with a token and
--     no `consumed_at` — the send job and the respond page both assume it's
--     there;
--   * `connection_request_links` is reachable by nobody through
--     `authenticated`, the same posture as `reminder_sends`/`guest_rsvp_log`:
--     the whole Accept/Decline flow runs through `service_role`, and the
--     requester in particular must never be able to read a token and accept on
--     the addressee's behalf.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_table('public', 'connection_request_links', 'connection_request_links table exists');
select has_column(
  'public', 'notification_preferences', 'connection_request_email_enabled',
  'notification_preferences.connection_request_email_enabled exists'
);
select has_column(
  'public', 'notification_preferences', 'connection_accepted_email_enabled',
  'notification_preferences.connection_accepted_email_enabled exists'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000228', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-228@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000228', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-228@example.com'),
  ('cccccccc-0000-0000-0000-000000000228', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-228@example.com');

-- A brand-new preferences row defaults the friend-request email on.
insert into public.notification_preferences (user_id) values ('aaaaaaaa-0000-0000-0000-000000000228');
select is(
  (select connection_request_email_enabled from public.notification_preferences
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000228'),
  true,
  'the friend-request email is opt-out — on by default'
);
select is(
  (select connection_accepted_email_enabled from public.notification_preferences
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000228'),
  true,
  'the request-accepted email is opt-out — on by default'
);

-- The request. Amy asks Ben.
insert into public.connections (requester_id, addressee_id)
values ('aaaaaaaa-0000-0000-0000-000000000228', 'bbbbbbbb-0000-0000-0000-000000000228');

select is(
  (select count(*)::int from public.connection_request_links l
   join public.connections c on c.id = l.connection_id
   where c.requester_id = 'aaaaaaaa-0000-0000-0000-000000000228'),
  1,
  'the connections insert trigger mints exactly one request link'
);

select isnt(
  (select token::text from public.connection_request_links l
   join public.connections c on c.id = l.connection_id
   where c.requester_id = 'aaaaaaaa-0000-0000-0000-000000000228'),
  null,
  'the minted link carries a token'
);

select is(
  (select consumed_at from public.connection_request_links l
   join public.connections c on c.id = l.connection_id
   where c.requester_id = 'aaaaaaaa-0000-0000-0000-000000000228'),
  null,
  'a fresh link is not yet consumed'
);

-- One per Connection.
select throws_ok(
  $$insert into public.connection_request_links (connection_id)
    select id from public.connections
    where requester_id = 'aaaaaaaa-0000-0000-0000-000000000228'$$,
  '23505',
  null,
  'a second link for the same Connection is refused'
);

-- RLS: no grant to `authenticated` at all.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000228", "role": "authenticated"}';

select throws_ok(
  $$select count(*) from public.connection_request_links$$,
  '42501',
  null,
  'the requester cannot read the Accept/Decline token'
);

select throws_ok(
  $$update public.connection_request_links set consumed_at = now()$$,
  '42501',
  null,
  'no authenticated User can burn a link either'
);

reset role;

select * from finish();

rollback;
