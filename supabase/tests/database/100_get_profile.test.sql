-- US-104-T1 · get_profile: someone's header, how I relate to them, and the summary I may see.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- a: public, 2 published posts of 1 beer + 1 not on the feed. c: private with 1 post. d: not onboarded.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
       ('00000000-0000-0000-0000-00000000000c', 'c@example.com'), ('00000000-0000-0000-0000-00000000000d', 'd@example.com');
update public.profiles p
set username = 'user_' || right(p.id::text, 1), display_name = 'User ' || upper(right(p.id::text, 1)), bio = 'Hi',
    birthdate = '1990-01-01', country = 'ES', onboarded_at = now()
where p.id <> '00000000-0000-0000-0000-00000000000d';
update public.profiles set is_private = true where id = '00000000-0000-0000-0000-00000000000c';
insert into public.beers (id, name, name_key, brand, brand_key, source)
values ('beef0000-0000-0000-0000-00000000000a', 'X', 'x', 'X', 'x', 'off'),
       ('beef0000-0000-0000-0000-00000000000b', 'Y', 'y', 'Y', 'y', 'off');
insert into public.posts (author_id, beer_id, serving, consumed_at, publish_to_feed)
values ('00000000-0000-0000-0000-00000000000a', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), true),
       ('00000000-0000-0000-0000-00000000000a', 'beef0000-0000-0000-0000-00000000000a', 'can', now(), true),
       ('00000000-0000-0000-0000-00000000000a', 'beef0000-0000-0000-0000-00000000000b', 'can', now(), false),
       ('00000000-0000-0000-0000-00000000000c', 'beef0000-0000-0000-0000-00000000000a', 'tap', now(), true);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select throws_ok(
  $$ select * from public.get_profile('00000000-0000-0000-0000-00000000000a') $$,
  '42501', 'not_authenticated', 'a session is required'
);

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select username, display_name, bio, is_private, relationship, can_see_posts, posts_count, beers_count, friends_count
     from public.get_profile('00000000-0000-0000-0000-00000000000a') $$,
  $$ values ('user_a'::text, 'User A'::text, 'Hi'::text, false, 'self'::text, true, 3, 2, 0) $$,
  'my own profile counts all my posts'
);

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select results_eq(
  $$ select relationship, can_see_posts, posts_count, beers_count, friends_count
     from public.get_profile('00000000-0000-0000-0000-00000000000a') $$,
  $$ values ('none'::text, true, 2, 1, 0) $$,
  'a public profile shows only the posts I can see'
);
select results_eq(
  $$ select username, is_private, relationship, can_see_posts, posts_count, beers_count, friends_count
     from public.get_profile('00000000-0000-0000-0000-00000000000c') $$,
  $$ values ('user_c'::text, true, 'none'::text, false, null::int, null::int, null::int) $$,
  'a private profile shows the header but no summary'
);
select is_empty(
  $$ select * from public.get_profile('00000000-0000-0000-0000-00000000000d') $$,
  'a user who has not finished onboarding is not found'
);
select is_empty(
  $$ select * from public.get_profile('00000000-0000-0000-0000-0000000000ff') $$,
  'an unknown id is not found'
);
select is(
  (select avatar_path from public.get_profile('00000000-0000-0000-0000-00000000000a')),
  null, 'the avatar path is returned (null when there is none)'
);

reset role;
select ok(
  not has_function_privilege('anon', 'public.get_profile(uuid)', 'execute'),
  'anon cannot call get_profile'
);
select ok(
  (select prosecdef from pg_proc where proname = 'get_profile'),
  'get_profile runs with owner rights'
);

select * from finish();
rollback;
