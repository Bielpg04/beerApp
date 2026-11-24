-- US-401-T1 · Mutual friendships: requests through functions only; friends see each other's
-- published posts even on a private profile.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- a, b public; c private with a published post (with photo) and an unpublished one; d not onboarded.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
       ('00000000-0000-0000-0000-00000000000c', 'c@example.com'), ('00000000-0000-0000-0000-00000000000d', 'd@example.com');
update public.profiles p
set username = 'user_' || right(p.id::text, 1), display_name = 'User ' || upper(right(p.id::text, 1)),
    birthdate = '1990-01-01', country = 'ES', onboarded_at = now()
where p.id <> '00000000-0000-0000-0000-00000000000d';
update public.profiles set is_private = true where id = '00000000-0000-0000-0000-00000000000c';
insert into public.beers (id, name, name_key, brand, brand_key, source)
values ('beef0000-0000-0000-0000-00000000000a', 'X', 'x', 'X', 'x', 'off');
insert into public.posts (id, author_id, beer_id, serving, consumed_at, publish_to_feed)
values ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), true),
       ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), false);
insert into public.post_photos (post_id, path, thumb_path, source, width, height)
values ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c/p.jpg',
        '00000000-0000-0000-0000-00000000000c/p_thumb.jpg', 'camera', 10, 10);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-00000000000b') $$,
                 '42501', 'not_authenticated', 'a session is required');

-- ---------- request ----------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000b'), 'pending', 'a sends a request to b');
select results_eq(
  $$ select status, requested_by from public.friendships $$,
  $$ values ('pending'::text, '00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'one pending row requested by a'
);
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000b'), 'pending', 'sending it again changes nothing');
select is((select count(*)::int from public.friendships), 1, 'still one row');
select is((select relationship from public.get_profile('00000000-0000-0000-0000-00000000000b')), 'outgoing', 'a sees it as outgoing');
select is_empty($$ select * from public.my_friend_requests() $$, 'a has no incoming requests');
select throws_ok($$ select public.accept_friend_request('00000000-0000-0000-0000-00000000000b') $$,
                 'P0001', 'request_not_found', 'a cannot accept the request a sent');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-00000000000a') $$,
                 'P0001', 'cannot_befriend_self', 'nobody befriends themselves');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-00000000000d') $$,
                 'P0001', 'user_not_found', 'users who have not finished onboarding cannot be added');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-0000000000ff') $$,
                 'P0001', 'user_not_found', 'unknown users cannot be added');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select is((select relationship from public.get_profile('00000000-0000-0000-0000-00000000000a')), 'incoming', 'b sees it as incoming');
select results_eq(
  $$ select id, username, display_name from public.my_friend_requests() $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid, 'user_a'::text, 'User A'::text) $$,
  'b lists the request from a'
);

-- ---------- accept ----------
select lives_ok($$ select public.accept_friend_request('00000000-0000-0000-0000-00000000000a') $$, 'b accepts');
select is((select relationship from public.get_profile('00000000-0000-0000-0000-00000000000a')), 'friends', 'b and a are friends');
select is((select friends_count from public.get_profile('00000000-0000-0000-0000-00000000000a')), 1, 'a has one friend');
select results_eq($$ select id from public.my_friends() $$, $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
                  'b lists a as a friend');
select is_empty($$ select * from public.my_friend_requests() $$, 'the request is gone');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select results_eq($$ select id from public.my_friends() $$, $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
                  'a lists b as a friend');
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000b'), 'accepted', 'asking a friend again says accepted');

-- ---------- decline / cross requests / cancel ----------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000a'), 'pending', 'c asks a');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.decline_friend_request('00000000-0000-0000-0000-00000000000c') $$, 'a declines c');
select is((select relationship from public.get_profile('00000000-0000-0000-0000-00000000000c')), 'none', 'declining leaves no trace');
select throws_ok($$ select public.decline_friend_request('00000000-0000-0000-0000-00000000000c') $$,
                 'P0001', 'request_not_found', 'nothing left to decline');
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000c'), 'pending', 'a asks c');
select lives_ok($$ select public.remove_friend('00000000-0000-0000-0000-00000000000c') $$, 'a cancels it');
select is((select count(*)::int from public.friendships where '00000000-0000-0000-0000-00000000000c' in (user_low, user_high)), 0,
          'the request is gone');
select lives_ok($$ select public.remove_friend('00000000-0000-0000-0000-00000000000c') $$, 'removing nothing does not fail');

-- ---------- private profile: friends see published posts ----------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select is_empty($$ select id from public.posts where author_id = '00000000-0000-0000-0000-00000000000c' $$,
                'b does not see the posts of private c');
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000c'), 'pending', 'b asks c');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');
select is(public.send_friend_request('00000000-0000-0000-0000-00000000000b'), 'accepted', 'c asking b back accepts it');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select results_eq(
  $$ select id from public.posts where author_id = '00000000-0000-0000-0000-00000000000c' $$,
  $$ values ('c0000000-0000-0000-0000-000000000001'::uuid) $$,
  'a friend sees the published post of a private profile, not the unpublished one'
);
select results_eq(
  $$ select can_see_posts, posts_count, (select count(*)::int from public.post_photos) from public.get_profile('00000000-0000-0000-0000-00000000000c') $$,
  $$ values (true, 1, 1) $$,
  'and its summary and photo'
);
select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ select public.remove_friend('00000000-0000-0000-0000-00000000000b') $$, 'c unfriends b');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select results_eq(
  $$ select can_see_posts, posts_count, (select count(*)::int from public.posts where author_id = '00000000-0000-0000-0000-00000000000c')
     from public.get_profile('00000000-0000-0000-0000-00000000000c') $$,
  $$ values (false, null::int, 0) $$,
  'after unfriending, the posts and summary are hidden again'
);

-- ---------- no direct writes ----------
select throws_ok(
  $$ insert into public.friendships (user_low, user_high, requested_by, status)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'accepted') $$,
  '42501', null, 'no direct inserts'
);

select * from finish();
rollback;
