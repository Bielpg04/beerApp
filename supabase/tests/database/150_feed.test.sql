-- US-501-T1 · get_feed: my posts and my friends' published posts, newest first, strict cursor.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- a sees: a (self), b (friend). c is public but not a friend. d was a friend but blocked a.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || x)::uuid, x || '@example.com' from unnest(array['a','b','c','d']) x;
update public.profiles p
set username = 'user_' || right(p.id::text, 1), display_name = 'User ' || upper(right(p.id::text, 1)),
    birthdate = '1990-01-01', country = 'ES', onboarded_at = now();
insert into public.friendships (user_low, user_high, requested_by, status, accepted_at)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'accepted', now()),
       ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a', 'accepted', now());
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a');
insert into public.beers (id, name, name_key, brand, brand_key, source)
values ('beef0000-0000-0000-0000-00000000000a', 'Lager', 'lager', 'Brew', 'brew', 'off');
insert into public.posts (id, author_id, beer_id, serving, consumed_at, created_at, publish_to_feed)
values
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), now() - interval '1 hour', true),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'beef0000-0000-0000-0000-00000000000a', 'can', now(), now() - interval '2 hours', true),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'beef0000-0000-0000-0000-00000000000a', 'can', now(), now() - interval '3 hours', false),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000c', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), now() - interval '4 hours', true),
  ('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000d', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), now() - interval '5 hours', true),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000a', 'beef0000-0000-0000-0000-00000000000a', 'bottle', now(), now() - interval '6 hours', false);
insert into public.post_photos (post_id, path, thumb_path, source, width, height)
values ('f0000000-0000-0000-0000-000000000002', 'b/p.jpg', 'b/p_thumb.jpg', 'camera', 1080, 1350);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
set local role authenticated;

select throws_ok($$ select * from public.get_feed() $$, '42501', 'not_authenticated', 'a session is required');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select id from public.get_feed() $$,
  $$ values ('f0000000-0000-0000-0000-000000000001'::uuid), ('f0000000-0000-0000-0000-000000000002'::uuid) $$,
  'my published posts and my friends'' ones, newest first; not unpublished, not strangers, not blocked'
);
select results_eq(
  $$ select author_username, author_display_name, beer_name, beer_brand, photo_path, photo_thumb_path, photo_width::int, serving
     from public.get_feed() where id = 'f0000000-0000-0000-0000-000000000002' $$,
  $$ values ('user_b'::text, 'User B'::text, 'Lager'::text, 'Brew'::text, 'b/p.jpg'::text, 'b/p_thumb.jpg'::text, 1080, 'can'::text) $$,
  'each row carries its author, beer and photo'
);
select results_eq(
  $$ select reaction_counts, my_reaction, comment_count from public.get_feed() where id = 'f0000000-0000-0000-0000-000000000001' $$,
  $$ values ('{}'::jsonb, null::text, 0) $$,
  'no reactions or comments yet'
);

-- strict cursor: one per page, and a new post meanwhile does not shift the next page
select results_eq(
  $$ select id from public.get_feed(max => 1) $$,
  $$ values ('f0000000-0000-0000-0000-000000000001'::uuid) $$, 'page 1'
);
reset role;
insert into public.posts (id, author_id, beer_id, serving, consumed_at, created_at)
values ('f0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000b', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), now());
set local role authenticated;
select results_eq(
  $$ select id from public.get_feed(
       before_created_at => (select created_at from public.posts where id = 'f0000000-0000-0000-0000-000000000001'),
       before_id => 'f0000000-0000-0000-0000-000000000001', max => 1) $$,
  $$ values ('f0000000-0000-0000-0000-000000000002'::uuid) $$,
  'page 2 continues after the last post shown even if someone posted meanwhile'
);
select is_empty(
  $$ select id from public.get_feed(
       before_created_at => (select created_at from public.posts where id = 'f0000000-0000-0000-0000-000000000002'),
       before_id => 'f0000000-0000-0000-0000-000000000002', max => 1) $$,
  'and page 3 is empty'
);
select is((select count(*)::int from public.get_feed()), 3, 'the new post shows up on a fresh load');

-- ties on created_at are broken by id
reset role;
update public.posts set created_at = '2026-01-01' where author_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select results_eq(
  $$ select id from public.get_feed(before_created_at => '2026-01-01', before_id => 'f0000000-0000-0000-0000-000000000007') $$,
  $$ values ('f0000000-0000-0000-0000-000000000002'::uuid), ('f0000000-0000-0000-0000-000000000001'::uuid) $$,
  'posts at the same instant are paged by id'
);
select is((select count(*)::int from public.get_feed(max => 500)), 3, 'max is capped (and all three fit)');

select * from finish();
rollback;
