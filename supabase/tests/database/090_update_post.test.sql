-- US-303-T1 · Editing a post: only its author, only serving, volume, caption, date and feed.
-- The beer and the photo never change; a verified post keeps its date; retroactive never goes back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
update public.profiles p
set username = 'user_' || right(p.id::text, 1), display_name = 'U', birthdate = '1990-01-01', country = 'ES', onboarded_at = now();
insert into public.beers (id, name, name_key, brand, brand_key, source)
values ('beef0000-0000-0000-0000-00000000000a', 'X', 'x', 'X', 'x', 'off');

insert into public.posts (id, author_id, beer_id, serving, volume_ml, caption, consumed_at, created_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   'beef0000-0000-0000-0000-00000000000a', 'tap', 500, 'Old', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a',
   'beef0000-0000-0000-0000-00000000000a', 'tap', null, null, now() - interval '3 days', now());
update public.posts set is_retroactive = true where id = 'a0000000-0000-0000-0000-000000000002';
insert into public.posts (id, author_id, beer_id, serving, consumed_at, verification_level)
values ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a',
        'beef0000-0000-0000-0000-00000000000a', 'bottle', now() - interval '10 minutes', 'verified');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select lives_ok(
  $$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'can', 330, '  New  ', now(), false) $$,
  'the author edits a post'
);
select results_eq(
  $$ select serving, volume_ml::int, caption, publish_to_feed, is_retroactive, beer_id
     from public.posts where id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values ('can', 330, 'New', false, false, 'beef0000-0000-0000-0000-00000000000a'::uuid) $$,
  'serving, volume, caption and feed change; the beer does not'
);
select lives_ok(
  $$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'can', null, ' ', now() - interval '3 days', false) $$,
  'the author can move the date back'
);
select results_eq(
  $$ select volume_ml, caption, is_retroactive from public.posts where id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values (null::smallint, null::text, true) $$,
  'clearing volume and caption, and a date more than 1 h before posting makes it retroactive'
);
select lives_ok(
  $$ select public.update_post('a0000000-0000-0000-0000-000000000002', 'tap', null, null, now(), true) $$,
  'a retroactive post can be moved to now'
);
select is((select is_retroactive from public.posts where id = 'a0000000-0000-0000-0000-000000000002'), true,
          'but it stays retroactive');

select throws_ok(
  $$ select public.update_post('a0000000-0000-0000-0000-000000000003', 'bottle', null, null, now() - interval '2 days', true) $$,
  'P0001', 'locked_by_verification', 'a verified post keeps its date'
);
select lives_ok(
  $$ select public.update_post('a0000000-0000-0000-0000-000000000003', 'can', 330, 'ok',
       (select consumed_at from public.posts where id = 'a0000000-0000-0000-0000-000000000003'), true) $$,
  'other fields of a verified post can change'
);

select throws_ok($$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'glass', null, null, now(), true) $$,
                 'P0001', 'invalid_serving', 'serving is validated');
select throws_ok($$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'tap', 9000, null, now(), true) $$,
                 'P0001', 'invalid_volume', 'volume is validated');
select throws_ok($$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'tap', null, repeat('x', 501), now(), true) $$,
                 'P0001', 'invalid_caption', 'caption is validated');
select throws_ok($$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'tap', null, null, now() + interval '1 hour', true) $$,
                 'P0001', 'consumed_in_future', 'the date is validated');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'tap', null, 'hacked', now(), true) $$,
                 'P0001', 'post_not_found', 'nobody else can edit it');
reset role;
set local role anon;
select throws_ok($$ select public.update_post('a0000000-0000-0000-0000-000000000001', 'tap', null, null, now(), true) $$,
                 '42501', null, 'anonymous users cannot edit');

select * from finish();
rollback;
