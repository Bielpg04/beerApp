-- US-401-T5 · Finding people by the start of their username.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, n || '@example.com'
from generate_series(1, 30) n;
update public.profiles p set display_name = 'U', birthdate = '1990-01-01', country = 'ES', onboarded_at = now(),
  username = case right(p.id::text, 2)
    when '01' then 'meu' when '02' then 'bie' when '03' then 'biel' when '04' then 'bielet'
    when '05' then 'abiel' when '06' then 'pending' when '07' then 'b_x'
    else 'bulk' || right(p.id::text, 2) end;
update public.profiles set onboarded_at = null, username = 'bianca' where id = '00000000-0000-0000-0000-000000000006';

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select throws_ok($$ select * from public.find_people('bi') $$, '42501', 'not_authenticated', 'a session is required');

select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select username from public.find_people('BIE') $$,
  $$ values ('bie'::text), ('biel'::text), ('bielet'::text) $$,
  'prefix match ignoring case, exact match first, then by username; not onboarded users are left out'
);
select results_eq($$ select username from public.find_people('@biel ') $$,
                  $$ values ('biel'::text), ('bielet'::text) $$, 'a leading @ and spaces are ignored');
select is_empty($$ select * from public.find_people('b') $$, 'one character finds nobody');
select is_empty($$ select * from public.find_people('meu') $$, 'I do not find myself');
select is_empty($$ select * from public.find_people('%') $$, '% is not a wildcard');
select results_eq($$ select username from public.find_people('b_') $$, $$ values ('b_x'::text) $$,
                  '_ is matched literally');
select is((select count(*)::int from public.find_people('bulk', 50)), 20, 'at most 20 results');
select is((select count(*)::int from public.find_people('bulk', 5)), 5, 'or fewer if asked');

select pg_temp.login_as('00000000-0000-0000-0000-000000000003');
select public.send_friend_request('00000000-0000-0000-0000-000000000001');
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select results_eq(
  $$ select username, relationship from public.find_people('biel') $$,
  $$ values ('biel'::text, 'incoming'::text), ('bielet'::text, 'none'::text) $$,
  'each result says how I relate to them'
);

select * from finish();
rollback;
