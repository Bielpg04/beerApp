-- US-302-T3 · Past posts: create_post takes when the beer was drunk, marks it retroactive when it
-- was more than 1 h ago and, unless told otherwise, keeps posts older than 48 h off the feed.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@example.com');
update public.profiles
set username = 'user_a', display_name = 'A', birthdate = '1990-01-01', country = 'ES', onboarded_at = now()
where id = '00000000-0000-0000-0000-00000000000a';
insert into public.beers (id, name, name_key, brand, brand_key, source)
values ('beef0000-0000-0000-0000-00000000000a', 'X', 'x', 'X', 'x', 'off');

select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

-- create_post runs before the select reads (one row per call, read in its own statement).
select set_config('test.now', (public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap'))::text, true);
select results_eq(
  $$ select consumed_at = now(), is_retroactive, publish_to_feed from public.posts where id = current_setting('test.now')::uuid $$,
  $$ values (true, false, true) $$,
  'without a date it was drunk now, is not retroactive and goes to the feed'
);

select set_config('test.p', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => now() - interval '30 minutes')::text, true);
select is((select is_retroactive from public.posts where id = current_setting('test.p')::uuid), false, '30 minutes ago is not retroactive');

select set_config('test.p', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => now() - interval '61 minutes')::text, true);
select is((select is_retroactive from public.posts where id = current_setting('test.p')::uuid), true, 'more than 1 h ago is retroactive');

select set_config('test.p', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => now() - interval '2 hours')::text, true);
select is((select publish_to_feed from public.posts where id = current_setting('test.p')::uuid), true, 'a post from 2 h ago goes to the feed by default');

select set_config('test.p', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => now() - interval '3 days')::text, true);
select results_eq(
  $$ select is_retroactive, publish_to_feed, consumed_at = now() - interval '3 days' from public.posts where id = current_setting('test.p')::uuid $$,
  $$ values (true, false, true) $$,
  'a post from 3 days ago is retroactive, keeps its date and stays off the feed by default'
);

select set_config('test.p', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => now() - interval '3 days', publish_to_feed => true)::text, true);
select is((select publish_to_feed from public.posts where id = current_setting('test.p')::uuid), true, 'an old post can still be sent to the feed');

select set_config('test.p', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', publish_to_feed => false)::text, true);
select is((select publish_to_feed from public.posts where id = current_setting('test.p')::uuid), false, 'a post of now can be kept off the feed');

select set_config('test.p', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => now() + interval '2 minutes')::text, true);
select is((select is_retroactive from public.posts where id = current_setting('test.p')::uuid), false, 'a clock 2 minutes ahead is tolerated');

select throws_ok(
  $$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => now() + interval '10 minutes') $$,
  'P0001', 'consumed_in_future', 'a beer cannot be drunk in the future'
);
select throws_ok(
  $$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', consumed_at => '1999-12-31T23:00:00Z') $$,
  'P0001', 'consumed_too_old', 'dates before 2000 are rejected'
);
select is((select count(*)::int from public.posts where verification_level <> 'unverified'), 0, 'every post is unverified');

select * from finish();
rollback;
