-- Dink Dine & Drink: Punishments (issue #718). What this pins down:
--
--   * a new DDD starts with bottles by place, and the links show them;
--   * an Organizer's edit sticks, and free text like "2 bottles + 3 shots" fits;
--   * four, none blank, none past 40 characters;
--   * a signed-in outsider's edit changes nothing.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71871871-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-pn-organizer@example.com'),
  ('71871871-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-pn-outsider@example.com');
insert into public.ddd_organizers (user_id) values ('71871871-0000-0000-0000-00000000000a');

insert into public.ddd_events (id, name, event_date, play_venue, dine_venue, score_token, public_token) values
  ('71871871-1111-0000-0000-000000000001', 'Punishments DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar',
   'score718score718score718score718', 'public718public718public718public');

select is(
  public.ddd_link_event('public718public718public718public') -> 'punishments',
  '["1 bottle", "2 bottles", "3 bottles", "4 bottles"]'::jsonb,
  'a new DDD starts with bottles by place, on the links'
);

-- ---- an outsider -----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "71871871-0000-0000-0000-00000000000c", "role": "authenticated"}';
update public.ddd_events set punishments = array['a', 'b', 'c', 'd']
  where id = '71871871-1111-0000-0000-000000000001';

-- ---- an Organizer ----------------------------------------------------------
set local request.jwt.claims = '{"sub": "71871871-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select punishments from public.ddd_events where id = '71871871-1111-0000-0000-000000000001'),
  array['1 bottle', '2 bottles', '3 bottles', '4 bottles'],
  'a signed-in outsider''s edit changed nothing'
);
select lives_ok(
  $$update public.ddd_events set punishments = array['1 bottle', '2 bottles', '3 bottles', '2 bottles + 3 shots']
    where id = '71871871-1111-0000-0000-000000000001'$$,
  'an Organizer edits a Punishment, free text and all'
);
select throws_ok(
  $$update public.ddd_events set punishments = array['1 bottle', '2 bottles', '3 bottles']
    where id = '71871871-1111-0000-0000-000000000001'$$,
  '23514', null, 'one for each of the 4 places'
);
select throws_ok(
  $$update public.ddd_events set punishments = array['1 bottle', ' ', '3 bottles', repeat('x', 41)]
    where id = '71871871-1111-0000-0000-000000000001'$$,
  '23514', null, 'none blank, none past 40 characters'
);

reset role;
select is(
  public.ddd_link_event('score718score718score718score718') -> 'punishments' ->> 3,
  '2 bottles + 3 shots',
  'the edit reaches the links'
);

select * from finish();
rollback;
