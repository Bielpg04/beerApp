-- US-301-T1 · Posts and their photos: created only through create_post, visible to the author
-- and, when published, to everyone signed in if the author's profile is public.
begin;
create extension if not exists pgtap with schema extensions;

select plan(45);

set local storage.allow_delete_query = 'true';

-- A and B: public profiles · C: private profile · D: has not finished onboarding.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.com');

update public.profiles p
set username = 'user_' || right(p.id::text, 1), display_name = 'User', birthdate = '1990-01-01',
    country = 'ES', onboarded_at = now(), is_private = (p.id = '00000000-0000-0000-0000-00000000000c')
where p.id <> '00000000-0000-0000-0000-00000000000d';

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Beers: approved (X), a duplicate merged into X (Y), and one pending beer created by B (P).
insert into public.beers (id, name, name_key, brand, brand_key, source)
values
  ('beef0000-0000-0000-0000-00000000000a', 'X', 'x', 'X', 'x', 'off'),
  ('beef0000-0000-0000-0000-00000000000b', 'Y', 'y', 'X', 'x2', 'off');
update public.beers set merged_into = 'beef0000-0000-0000-0000-00000000000a'
where id = 'beef0000-0000-0000-0000-00000000000b';
insert into public.beers (id, name, name_key, brand, brand_key, source, status, created_by)
values ('beef0000-0000-0000-0000-00000000000c', 'P', 'p', 'P', 'p', 'user', 'pending',
        '00000000-0000-0000-0000-00000000000b');

-- Uploaded files (as the Storage API would leave them).
insert into storage.objects (bucket_id, name, owner_id)
values
  ('post-photos', '00000000-0000-0000-0000-00000000000a/p2.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('post-photos', '00000000-0000-0000-0000-00000000000a/p2_thumb.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('post-photos', '00000000-0000-0000-0000-00000000000a/p3.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('post-photos', '00000000-0000-0000-0000-00000000000a/p3_thumb.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('post-photos', '00000000-0000-0000-0000-00000000000a/stray.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('post-photos', '00000000-0000-0000-0000-00000000000b/b.jpg', '00000000-0000-0000-0000-00000000000b'),
  ('post-photos', '00000000-0000-0000-0000-00000000000b/b_thumb.jpg', '00000000-0000-0000-0000-00000000000b');

-- ---------- schema ----------

select has_table('public', 'posts', 'posts exists');
select has_table('public', 'post_photos', 'post_photos exists');
select is((select public from storage.buckets where id = 'post-photos'), false, 'post photos are private');
select is((select file_size_limit from storage.buckets where id = 'post-photos'), 2097152::bigint, 'post photos are at most 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'post-photos'), array['image/jpeg'], 'only JPEG post photos');

-- ---------- create_post ----------

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select set_config('test.p1', public.create_post('beef0000-0000-0000-0000-00000000000a', 'bottle', 330, '  Bona  ')::text, true);

select results_eq(
  $$ select author_id, beer_id, serving, volume_ml::int, caption, is_retroactive, publish_to_feed, verification_level
     from public.posts where id = current_setting('test.p1')::uuid $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid, 'beef0000-0000-0000-0000-00000000000a'::uuid,
            'bottle', 330, 'Bona', false, true, 'unverified') $$,
  'create_post stores the post for the caller, trimmed, unverified, published and not retroactive'
);
select is((select consumed_at from public.posts where id = current_setting('test.p1')::uuid), now(),
          'a post without a date was drunk now');

select set_config('test.merged', public.create_post('beef0000-0000-0000-0000-00000000000b', 'tap')::text, true);
select is(
  (select beer_id from public.posts where id = current_setting('test.merged')::uuid),
  'beef0000-0000-0000-0000-00000000000a'::uuid,
  'a merged beer is stored as its final beer'
);
select throws_ok($$ select public.create_post('beef0000-0000-0000-0000-00000000000c', 'tap') $$,
                 'P0001', 'beer_not_found', 'someone else''s pending beer cannot be posted');
select throws_ok($$ select public.create_post(gen_random_uuid(), 'tap') $$,
                 'P0001', 'beer_not_found', 'an unknown beer cannot be posted');
select throws_ok($$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'glass') $$,
                 'P0001', 'invalid_serving', 'serving must be tap, bottle or can');
select throws_ok($$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'can', 10) $$,
                 'P0001', 'invalid_volume', 'volume must be 50–5000 ml');
select throws_ok($$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'can', null, repeat('x', 501)) $$,
                 'P0001', 'invalid_caption', 'caption is at most 500 characters');
select set_config('test.blank', public.create_post('beef0000-0000-0000-0000-00000000000a', 'can', null, '   ')::text, true);
select is(
  (select caption from public.posts where id = current_setting('test.blank')::uuid),
  null,
  'a blank caption is stored as null'
);

select throws_ok(
  $$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'can', null, null,
       '{"path":"00000000-0000-0000-0000-00000000000a/none.jpg","thumbPath":"00000000-0000-0000-0000-00000000000a/none_thumb.jpg","source":"camera","width":1080,"height":1440}') $$,
  'P0001', 'photo_not_found', 'a photo must have been uploaded'
);
select throws_ok(
  $$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'can', null, null,
       '{"path":"00000000-0000-0000-0000-00000000000b/b.jpg","thumbPath":"00000000-0000-0000-0000-00000000000b/b_thumb.jpg","source":"camera","width":1080,"height":1440}') $$,
  'P0001', 'photo_not_found', 'someone else''s photo cannot be attached'
);
select throws_ok(
  $$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'can', null, null,
       '{"path":"00000000-0000-0000-0000-00000000000a/p2.jpg","thumbPath":"00000000-0000-0000-0000-00000000000a/p2_thumb.jpg","source":"screenshot","width":1080,"height":1440}') $$,
  'P0001', 'invalid_photo', 'the photo source must be camera or library'
);

select set_config('test.p2', public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap', 500, null,
  '{"path":"00000000-0000-0000-0000-00000000000a/p2.jpg","thumbPath":"00000000-0000-0000-0000-00000000000a/p2_thumb.jpg","source":"library","exifTakenAt":"2026-11-20T20:15:00Z","width":1080,"height":810}')::text, true);
select results_eq(
  $$ select path, thumb_path, source, exif_taken_at, width::int, height::int
     from public.post_photos where post_id = current_setting('test.p2')::uuid $$,
  $$ values ('00000000-0000-0000-0000-00000000000a/p2.jpg', '00000000-0000-0000-0000-00000000000a/p2_thumb.jpg',
            'library', '2026-11-20T20:15:00Z'::timestamptz, 1080, 810) $$,
  'an uploaded photo is attached to the post'
);
select throws_ok(
  $$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'can', null, null,
       '{"path":"00000000-0000-0000-0000-00000000000a/p2.jpg","thumbPath":"00000000-0000-0000-0000-00000000000a/p2_thumb.jpg","source":"camera","width":1080,"height":1440}') $$,
  'P0001', 'photo_in_use', 'a photo belongs to one post only'
);

select pg_temp.login_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap') $$,
                 'P0001', 'not_onboarded', 'users who have not finished onboarding cannot post');

select set_config('request.jwt.claims', '', true);
select throws_ok($$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap') $$,
                 '42501', null, 'signed-in callers only');

reset role;

-- More posts written directly: A's unpublished post with a photo, and C's (private profile).
insert into public.posts (id, author_id, beer_id, serving, consumed_at, publish_to_feed)
values
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a',
   'beef0000-0000-0000-0000-00000000000a', 'tap', now(), false),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c',
   'beef0000-0000-0000-0000-00000000000a', 'tap', now(), true);
insert into public.post_photos (post_id, path, thumb_path, source, width, height)
values ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a/p3.jpg',
        '00000000-0000-0000-0000-00000000000a/p3_thumb.jpg', 'camera', 1080, 1440);

-- ---------- who sees what ----------

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
set local role authenticated;

select ok(exists (select 1 from public.posts where id = current_setting('test.p1')::uuid),
          'a published post of a public profile is visible to others');
select ok(not exists (select 1 from public.posts where id = 'a0000000-0000-0000-0000-000000000003'),
          'a post that is not on the feed is only visible to its author');
select ok(not exists (select 1 from public.posts where id = 'c0000000-0000-0000-0000-000000000001'),
          'posts of a private profile are not visible to others');
select is((select count(*)::int from public.post_photos where post_id = current_setting('test.p2')::uuid), 1,
          'the photo of a visible post is visible');
select is((select count(*)::int from public.post_photos where post_id = 'a0000000-0000-0000-0000-000000000003'), 0,
          'the photo of a hidden post is hidden');

select is((select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-00000000000a/p2.jpg'), 1,
          'others can read the photo file of a visible post');
select is((select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-00000000000a/p3_thumb.jpg'), 0,
          'others cannot read the photo file of a hidden post, even knowing its path');
select is((select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-00000000000a/stray.jpg'), 0,
          'others cannot read files that belong to no post');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('post-photos', '00000000-0000-0000-0000-00000000000a/x.jpg', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'nobody can upload into someone else''s folder'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('post-photos', '00000000-0000-0000-0000-00000000000b/new.jpg', '00000000-0000-0000-0000-00000000000b') $$,
  'users upload into their own folder'
);

select throws_ok(
  $$ insert into public.posts (author_id, beer_id, serving, consumed_at)
     values ('00000000-0000-0000-0000-00000000000b', 'beef0000-0000-0000-0000-00000000000a', 'tap', now()) $$,
  '42501', null, 'posts cannot be inserted directly'
);
select throws_ok($$ update public.posts set caption = 'hacked' $$, '42501', null, 'posts cannot be updated directly');
select throws_ok(
  $$ insert into public.post_photos (post_id, path, thumb_path, source, width, height)
     values ('a0000000-0000-0000-0000-000000000003', 'x', 'y', 'camera', 1, 1) $$,
  '42501', null, 'photos cannot be inserted directly'
);
with d as (delete from public.posts where id = current_setting('test.p1')::uuid returning 1)
select is(count(*)::int, 0, 'nobody can delete someone else''s post') from d;
with d as (delete from storage.objects where name = '00000000-0000-0000-0000-00000000000a/p2.jpg' returning 1)
select is(count(*)::int, 0, 'nobody can delete someone else''s photo file') from d;

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.posts), 5, 'authors see all their own posts, published or not');
select is((select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-00000000000a/stray.jpg'), 1,
          'authors can read their own files');
select is((select count(*)::int from public.post_photos where post_id = 'a0000000-0000-0000-0000-000000000003'), 1,
          'authors see the photos of their hidden posts');
with d as (delete from public.posts where id = current_setting('test.p2')::uuid returning 1)
select is(count(*)::int, 1, 'authors can delete their own post') from d;
reset role;
select is((select count(*)::int from public.post_photos where path = '00000000-0000-0000-0000-00000000000a/p2.jpg'), 0,
          'deleting a post deletes its photo rows');
set local role authenticated;
with d as (delete from storage.objects where name = '00000000-0000-0000-0000-00000000000a/p2.jpg' returning 1)
select is(count(*)::int, 1, 'authors can delete their own photo files') from d;

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.posts $$, '42501', null, 'anonymous users cannot read posts');
select throws_ok($$ select public.create_post('beef0000-0000-0000-0000-00000000000a', 'tap') $$,
                 '42501', null, 'anonymous users cannot post');
reset role;

select is((select count(*)::int from public.posts where author_id = '00000000-0000-0000-0000-00000000000a'), 4,
          'sanity: A has 4 posts left');

select * from finish();
rollback;
