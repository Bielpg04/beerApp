-- US-301-T2 · Beer search for the create-post flow: every word must appear in brand + name
-- (accent- and case-insensitive); exact matches first, then the most scanned, then the shortest.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
       ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

insert into public.beers (id, name, name_key, brand, brand_key, source, image_thumb_url, abv, style_code)
values
  ('5e000000-0000-0000-0000-000000000001', 'Estrella Damm', 'estrella', 'Damm', 'damm', 'off', 'https://t/1.jpg', 5.4, 'lager'),
  ('5e000000-0000-0000-0000-000000000002', 'Estrella Damm mini', 'mini', 'Damm', 'damm', 'off', null, null, null),
  ('5e000000-0000-0000-0000-000000000003', 'Voll-Damm', 'voll', 'Damm', 'damm', 'off', null, null, null),
  ('5e000000-0000-0000-0000-000000000004', 'Moritz Radler', 'radler', 'Moritz', 'moritz', 'off', null, null, null),
  ('5e000000-0000-0000-0000-000000000005', 'Bier', 'bier', 'Moritz Fiege', 'moritz fiege', 'off', null, null, null),
  ('5e000000-0000-0000-0000-000000000006', 'Moritz', 'moritz', 'Moritz', 'moritz', 'off', null, null, null),
  ('5e000000-0000-0000-0000-000000000007', 'Cervèsa del Montseny', 'montseny', 'Montseny', 'montseny', 'off', null, null, null),
  ('5e000000-0000-0000-0000-000000000008', 'Estrella Damm old', 'old', 'Damm', 'damm-old', 'off', null, null, null);
update public.beers set merged_into = '5e000000-0000-0000-0000-000000000001'
where id = '5e000000-0000-0000-0000-000000000008';
insert into public.beers (id, name, name_key, brand, brand_key, source, status, created_by)
values
  ('5e000000-0000-0000-0000-000000000009', 'Moritz Secret', 'secret', 'Moritz', 'moritz', 'user', 'pending',
   '00000000-0000-0000-0000-00000000000b'),
  ('5e000000-0000-0000-0000-00000000000a', 'Moritz Mine', 'mine', 'Moritz', 'moritz', 'user', 'pending',
   '00000000-0000-0000-0000-00000000000a');

-- More barcodes = more people scanned it = more likely the one you mean.
insert into public.beer_barcodes (barcode, beer_id)
values
  ('2100000000012', '5e000000-0000-0000-0000-000000000001'),
  ('2100000000029', '5e000000-0000-0000-0000-000000000001'),
  ('2100000000036', '5e000000-0000-0000-0000-000000000005'),
  ('2100000000043', '5e000000-0000-0000-0000-000000000005'),
  ('2100000000050', '5e000000-0000-0000-0000-000000000005');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

select results_eq(
  $$ select id from public.search_beers('estrella damm') $$,
  $$ values ('5e000000-0000-0000-0000-000000000001'::uuid), ('5e000000-0000-0000-0000-000000000002'::uuid) $$,
  'every word must match; the most scanned first; merged beers are left out'
);
select results_eq(
  $$ select name, brand, image_thumb_url, abv, style_code from public.search_beers('estrella damm', 1) $$,
  $$ values ('Estrella Damm', 'Damm', 'https://t/1.jpg', 5.4::numeric, 'lager') $$,
  'returns what the picker shows, and respects the limit'
);
select is((select id from public.search_beers('moritz') limit 1), '5e000000-0000-0000-0000-000000000006'::uuid,
          'an exact name or brand match comes first, even with fewer barcodes');
select ok('5e000000-0000-0000-0000-00000000000a'::uuid in (select id from public.search_beers('moritz')),
          'my own pending beer is found');
select ok('5e000000-0000-0000-0000-000000000009'::uuid not in (select id from public.search_beers('moritz')),
          'someone else''s pending beer is not');
select is((select id from public.search_beers('CERVESA montseny')), '5e000000-0000-0000-0000-000000000007'::uuid,
          'case and accents do not matter');
select is((select count(*)::int from public.search_beers('  v ')), 0, 'one character is not a search');
select is((select count(*)::int from public.search_beers('voll damm')), 1, 'words may come from the brand or the name');

reset role;
set local role anon;
select throws_ok($$ select * from public.search_beers('damm') $$, '42501', null, 'anonymous users cannot search');

select * from finish();
rollback;
