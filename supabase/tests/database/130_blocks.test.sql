-- US-402-T1 · Blocking cuts every tie both ways: friendship, posts, photos, profile, search, requests.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
update public.profiles p
set username = 'user_' || right(p.id::text, 1), display_name = 'User ' || upper(right(p.id::text, 1)), bio = 'Hi',
    avatar_path = p.id || '/a.jpg', birthdate = '1990-01-01', country = 'ES', onboarded_at = now();
insert into public.beers (id, name, name_key, brand, brand_key, source)
values ('beef0000-0000-0000-0000-00000000000a', 'X', 'x', 'X', 'x', 'off');
insert into public.posts (id, author_id, beer_id, serving, consumed_at)
values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'beef0000-0000-0000-0000-00000000000a', 'tap', now()),
       ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'beef0000-0000-0000-0000-00000000000a', 'tap', now());
insert into public.post_photos (post_id, path, thumb_path, source, width, height)
values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a/p.jpg',
        '00000000-0000-0000-0000-00000000000a/p_thumb.jpg', 'camera', 10, 10);
insert into storage.objects (bucket_id, name, owner_id)
values ('post-photos', '00000000-0000-0000-0000-00000000000a/p.jpg', '00000000-0000-0000-0000-00000000000a');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select throws_ok($$ select public.block_user('00000000-0000-0000-0000-00000000000b') $$,
                 '42501', 'not_authenticated', 'a session is required');

-- a and b are friends
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.send_friend_request('00000000-0000-0000-0000-00000000000b');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select public.accept_friend_request('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from storage.objects where bucket_id = 'post-photos'), 1, 'before: b can read the photo of a');

-- a blocks b
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.block_user('00000000-0000-0000-0000-00000000000b') $$, 'a blocks b');
select lives_ok($$ select public.block_user('00000000-0000-0000-0000-00000000000b') $$, 'blocking again does nothing');
select is((select count(*)::int from public.blocks), 1, 'one block row');
select is((select count(*)::int from public.friendships), 0, 'the friendship is gone');
select throws_ok($$ select public.block_user('00000000-0000-0000-0000-00000000000a') $$,
                 'P0001', 'cannot_block_self', 'nobody blocks themselves');
select throws_ok($$ select public.block_user('00000000-0000-0000-0000-0000000000ff') $$,
                 'P0001', 'user_not_found', 'unknown users cannot be blocked');
select results_eq(
  $$ select relationship, display_name, avatar_path, bio, can_see_posts, posts_count from public.get_profile('00000000-0000-0000-0000-00000000000b') $$,
  $$ values ('blocked'::text, 'User B'::text, null::text, null::text, false, null::int) $$,
  'a sees b as blocked, with just the name'
);
select is_empty($$ select id from public.posts where author_id = '00000000-0000-0000-0000-00000000000b' $$,
                'a no longer sees the posts of b');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-00000000000b') $$,
                 'P0001', 'user_not_found', 'a cannot ask b while blocking');
select results_eq($$ select id from public.my_blocked_users() $$, $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
                  'a lists b as blocked');
select is_empty($$ select * from public.find_people('user_b') $$, 'a does not find b');

-- b's side
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select is_empty($$ select * from public.get_profile('00000000-0000-0000-0000-00000000000a') $$,
                'b does not find the profile of a, as if it did not exist');
select is_empty($$ select id from public.posts where author_id = '00000000-0000-0000-0000-00000000000a' $$,
                'b does not see the posts of a');
select is_empty($$ select * from public.post_photos $$, 'nor their photo rows');
select is((select count(*)::int from storage.objects where bucket_id = 'post-photos'), 0,
          'nor the photo file, even knowing its path');
select is_empty($$ select * from public.find_people('user_a') $$, 'b does not find a');
select is_empty($$ select * from public.public_profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
                'public_profiles hides a from b');
select throws_ok($$ select public.send_friend_request('00000000-0000-0000-0000-00000000000a') $$,
                 'P0001', 'user_not_found', 'b cannot ask a');
select is_empty($$ select * from public.blocks $$, 'b cannot see that a blocked them');
select throws_ok(
  $$ delete from public.blocks $$, '42501', null, 'no direct writes to blocks'
);

-- unblock
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.unblock_user('00000000-0000-0000-0000-00000000000b') $$, 'a unblocks b');
select is((select relationship from public.get_profile('00000000-0000-0000-0000-00000000000b')), 'none',
          'they are no longer friends after unblocking');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select results_eq($$ select id from public.posts where author_id = '00000000-0000-0000-0000-00000000000a' $$,
                  $$ values ('a0000000-0000-0000-0000-000000000001'::uuid) $$, 'b sees the public posts of a again');

select * from finish();
rollback;
