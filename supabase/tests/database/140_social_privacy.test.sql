-- Sprint 4 review · Nobody can ask the server directly who is friends with whom or who blocked
-- whom: a blocked user must not be able to find out (anti-goal of US-402).
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'), ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
update public.profiles p
set username = 'user_' || right(p.id::text, 1), display_name = 'U', birthdate = '1990-01-01', country = 'ES', onboarded_at = now();
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

select ok(not has_function_privilege('authenticated', 'public.is_blocked_between(uuid, uuid)', 'execute'),
          'users cannot call is_blocked_between');
select ok(not has_function_privilege('authenticated', 'public.are_friends(uuid, uuid)', 'execute'),
          'users cannot call are_friends');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$ select public.is_blocked_between('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'so b cannot find out that a blocked them'
);
-- What still works through the functions that use them:
select is_empty($$ select * from public.public_profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
                'public_profiles still hides a from b');
select is_empty($$ select * from public.get_profile('00000000-0000-0000-0000-00000000000a') $$,
                'get_profile still hides a from b');

select * from finish();
rollback;
