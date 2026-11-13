-- US-103-T3 · Avatars bucket: public read, owners write only inside their own folder.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- Storage blocks raw DELETEs unless this is set (the Storage API sets it); lets us test RLS.
set local storage.allow_delete_query = 'true';

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select public from storage.buckets where id = 'avatars'), 'avatars are publicly readable');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 1048576::bigint, 'avatars are at most 1 MB');
select is((select allowed_mime_types from storage.buckets where id = 'avatars'), array['image/jpeg'], 'only JPEG avatars');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', '00000000-0000-0000-0000-00000000000a/me.jpg', '00000000-0000-0000-0000-00000000000a') $$,
  'a user can upload into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', '00000000-0000-0000-0000-00000000000b/x.jpg', '00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'a user cannot upload into someone else''s folder'
);

with d as (
  delete from storage.objects where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-00000000000a/me.jpg'
  returning 1
)
select is(count(*)::int, 1, 'a user can delete their own avatar') from d;

reset role;
insert into storage.objects (bucket_id, name, owner_id)
values ('avatars', '00000000-0000-0000-0000-00000000000b/b.jpg', '00000000-0000-0000-0000-00000000000b');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

with d as (
  delete from storage.objects where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-00000000000b/b.jpg'
  returning 1
)
select is(count(*)::int, 0, 'a user cannot delete someone else''s avatar') from d;

select * from finish();
rollback;
