-- On Deck: the opt-in turn notification (issue #260). What this pins down:
--
--   * a Player subscribes through `on_deck_subscribe_turn_notification` —
--     anon-callable, but only after joining (roster-gated) and only while the
--     Session is open;
--   * re-subscribing on the same endpoint is an upsert, not a duplicate row;
--   * `on_deck_unsubscribe_turn_notification` removes a device by endpoint and
--     is a no-op for an unknown one;
--   * neither `on_deck_push_subscriptions` nor `on_deck_turn_notification_sends`
--     is readable by anon or authenticated — a device token is a Player's whole
--     identity, so the tables are service_role / SECURITY-DEFINER-RPC only;
--   * the send log's unique (session, player, transition) is what makes "one
--     buzz, not a stream" hold.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'on_deck_push_subscriptions',
  'on_deck_push_subscriptions exists');
select has_table('public', 'on_deck_turn_notification_sends',
  'on_deck_turn_notification_sends exists');
select has_function(
  'public', 'on_deck_subscribe_turn_notification',
  array['uuid', 'text', 'text', 'text', 'text'],
  'on_deck_subscribe_turn_notification(uuid, text, text, text, text) exists'
);
select has_function(
  'public', 'on_deck_unsubscribe_turn_notification', array['text'],
  'on_deck_unsubscribe_turn_notification(text) exists'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-00000000026a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-turnnotify@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c2c2c2c2-0000-0000-0000-00000000026a', '11111111-0000-0000-0000-00000000026a', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'self-serve');

insert into public.on_deck_sessions (id, club_id, venue_name, court_count, group_cap, floor_mode) values
  ('5e552022-0000-0000-0000-00000000026a', 'c2c2c2c2-0000-0000-0000-00000000026a', 'Ramsden Park', 8, 4, 'self-serve');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e552022-0000-0000-0000-00000000026a', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-00000000026a');

-- ---- as an anonymous Player -------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.on_deck_subscribe_turn_notification(
      '5e552022-0000-0000-0000-00000000026a', 'device-token-nadia',
      'https://push.example/nadia', 'p256dh-key', 'auth-key')$$,
  '42501',
  null,
  'a Player cannot subscribe before joining the Session'
);

select public.on_deck_join_session(
  '5e552022-0000-0000-0000-00000000026a', 'device-token-nadia', 'Nadia', 'K', 'intermediate'
);

select lives_ok(
  $$select public.on_deck_subscribe_turn_notification(
      '5e552022-0000-0000-0000-00000000026a', 'device-token-nadia',
      'https://push.example/nadia', 'p256dh-key', 'auth-key')$$,
  'a joined Player subscribes with no account'
);

-- Re-subscribing on the same endpoint is an upsert.
select lives_ok(
  $$select public.on_deck_subscribe_turn_notification(
      '5e552022-0000-0000-0000-00000000026a', 'device-token-nadia',
      'https://push.example/nadia', 'p256dh-key-2', 'auth-key-2')$$,
  're-subscribing on the same endpoint does not error'
);

-- anon holds no read grant on the subscriptions table.
select throws_ok(
  $$select count(*) from public.on_deck_push_subscriptions$$,
  '42501',
  null,
  'anon cannot read on_deck_push_subscriptions'
);

select throws_ok(
  $$select count(*) from public.on_deck_turn_notification_sends$$,
  '42501',
  null,
  'anon cannot read on_deck_turn_notification_sends'
);

-- Unsubscribe by endpoint; a no-op for an unknown one.
select lives_ok(
  $$select public.on_deck_unsubscribe_turn_notification('https://push.example/unknown')$$,
  'unsubscribing an unknown endpoint is a no-op'
);
select lives_ok(
  $$select public.on_deck_unsubscribe_turn_notification('https://push.example/nadia')$$,
  'a Player unsubscribes their own device'
);

-- ---- back as the table owner (service_role posture) ------------------------
reset role;

select is(
  (select count(*)::int from public.on_deck_push_subscriptions
   where endpoint = 'https://push.example/nadia'),
  0,
  'the unsubscribed row is gone'
);

-- One row per (session, player, per-turn key) — the "one buzz" guarantee.
-- `transition` carries the per-turn key (court:<n>:<since> / on-deck:<at>), so
-- the check pins only the prefix shape.
select throws_ok(
  $$insert into public.on_deck_turn_notification_sends (session_id, player_token, transition)
    values ('5e552022-0000-0000-0000-00000000026a', 'device-token-nadia', 'bogus')$$,
  '23514',
  null,
  'a transition not shaped like a per-turn key is rejected'
);

insert into public.on_deck_turn_notification_sends (session_id, player_token, transition) values
  ('5e552022-0000-0000-0000-00000000026a', 'device-token-nadia', 'on-deck:1699999999999');

select throws_ok(
  $$insert into public.on_deck_turn_notification_sends (session_id, player_token, transition)
    values ('5e552022-0000-0000-0000-00000000026a', 'device-token-nadia', 'on-deck:1699999999999')$$,
  '23505',
  null,
  'the same (session, player, per-turn key) cannot be logged twice'
);

select lives_ok(
  $$insert into public.on_deck_turn_notification_sends (session_id, player_token, transition)
    values ('5e552022-0000-0000-0000-00000000026a', 'device-token-nadia', 'court:1:1699999999999')$$,
  'a different turn for the same Player is a separate row'
);

select * from finish();

rollback;
