-- US-102-T2 · Onboarding: legal drinking age validated on the server, then the profile.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select is(public.min_drinking_age('US'), 21::smallint, 'US needs 21');
select is(public.min_drinking_age('ES'), 18::smallint, 'everywhere else needs 18');

-- ---- As user A ----
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select throws_ok(
  format($$ select public.set_birthdate(%L, 'ES') $$, (current_date - interval '18 years' + interval '1 day')::date),
  'P0001', 'underage', 'one day before turning 18 in Spain is rejected'
);
select lives_ok(
  format($$ select public.set_birthdate(%L, 'ES') $$, (current_date - interval '18 years')::date),
  'turning 18 today in Spain is accepted'
);
select throws_ok(
  format($$ select public.set_birthdate(%L, 'US') $$, (current_date - interval '20 years')::date),
  'P0001', 'underage', '20 in the US is rejected'
);
select lives_ok(
  format($$ select public.set_birthdate(%L, 'us') $$, (current_date - interval '21 years')::date),
  '21 in the US is accepted'
);
select is(
  (select country::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'US',
  'the country is stored upper-case'
);
select throws_ok(
  $$ select public.set_birthdate('2000-01-01', 'XX1') $$,
  'P0001', 'invalid_country', 'the country must be a 2-letter code'
);

-- complete_profile
select throws_ok(
  $$ select public.complete_profile('Biel', 'Biel') $$,
  'P0001', 'invalid_username', 'usernames must already be normalized'
);
select throws_ok(
  $$ select public.complete_profile('biel', '   ') $$,
  'P0001', 'invalid_display_name', 'the display name cannot be blank'
);

reset role;
update public.profiles set username = 'pere' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select throws_ok(
  $$ select public.complete_profile('pere', 'Biel') $$,
  'P0001', 'username_taken', 'a taken username is rejected'
);
select lives_ok($$ select public.complete_profile('biel', ' Biel ') $$, 'a valid profile completes onboarding');
select ok(
  (select onboarded_at is not null and username = 'biel' and display_name = 'Biel'
     from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'onboarding is marked complete with the trimmed name'
);
select throws_ok(
  $$ select public.set_birthdate('1990-01-01', 'ES') $$,
  'P0001', 'already_onboarded', 'birthdate and country cannot change after onboarding'
);

reset role;
select throws_ok(
  $$ update public.profiles set birthdate = '1990-01-01' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'P0001', 'already_onboarded', 'even a privileged update cannot change the birthdate after onboarding'
);
set local role authenticated;

-- ---- As user B, still without birthdate ----
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.complete_profile('pere2', 'Pere') $$,
  'P0001', 'birthdate_required', 'the age step must come first'
);

-- ---- Anonymous ----
reset role;
set local role anon;
select throws_ok(
  $$ select public.set_birthdate('2000-01-01', 'ES') $$,
  '42501', null, 'anonymous users cannot call onboarding functions'
);

select * from finish();
rollback;
