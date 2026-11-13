-- US-103-T1 · profiles: automatic creation, RLS, column permissions, username rules.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- Two users: A signs up by email, B with Apple/Google (full name in metadata).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', '{"full_name": "Anna Puig"}');

-- Acts as the given user for the rest of the transaction (until `reset role`).
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_table('public', 'profiles', 'profiles table exists');

select is(
  (select onboarded_at is null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  true,
  'signing up creates an empty profile pending onboarding'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'Anna Puig',
  'display_name is prefilled from the provider full_name'
);

select hasnt_column('public', 'public_profiles', 'birthdate', 'public_profiles never exposes birthdate');

-- ---- As user A ----
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

with u as (
  update public.profiles set bio = 'hola' where id = '00000000-0000-0000-0000-00000000000a' returning 1
)
select is(count(*)::int, 1, 'a user can update their own bio') from u;

with u as (
  update public.profiles set bio = 'hack' where id = '00000000-0000-0000-0000-00000000000b' returning 1
)
select is(count(*)::int, 0, 'a user cannot update someone else''s profile') from u;

select throws_ok(
  $$ update public.profiles set birthdate = '2000-01-01' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'birthdate cannot be updated directly'
);

select throws_ok(
  $$ update public.profiles set username = 'hacker' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'username cannot be updated directly'
);

select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'a user cannot read another user''s private profile row (birthdate)'
);

select is(
  (select count(*)::int from public.public_profiles where id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'users who have not finished onboarding (e.g. rejected minors) are not listed'
);
reset role;
update public.profiles set onboarded_at = now() where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select is(
  (select count(*)::int from public.public_profiles where id = '00000000-0000-0000-0000-00000000000b'),
  1,
  'onboarded users are visible through public_profiles'
);

select is(public.username_available('biel'), true, 'a free username is available');

reset role;
update public.profiles set username = 'biel' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select is(public.username_available('BIEL'), false, 'usernames are unique regardless of case');

reset role;

-- ---- Username format ----
select is(public.is_valid_username('ab'), false, 'too short');
select is(public.is_valid_username('.biel'), false, 'cannot start with a dot');
select is(public.is_valid_username('biel.'), false, 'cannot end with a dot');
select is(public.is_valid_username('pèl'), false, 'no accents');
select is(public.is_valid_username('Biel Palomar'), false, 'no spaces or capitals');
select ok(public.is_valid_username('biel_04') and public.is_valid_username('b.p'), 'letters, digits, _ and . are valid');

select * from finish();
rollback;
